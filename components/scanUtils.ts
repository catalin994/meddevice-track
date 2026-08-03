
import { encodePage } from '../services/scanQuality';
export type Orientation = 'portrait' | 'landscape';

/** Normalised rectangle (0..1) in source-video coordinates. */
export interface DocRect { x: number; y: number; w: number; h: number }

const DETECT_WIDTH = 160;

/**
 * The slice of the sensor frame an object-cover <video> actually shows.
 *
 * The preview fills its box by scaling the frame up and cropping the overflow,
 * so the sensor sees more than the user does. Detecting over the whole frame
 * means locking onto things outside the preview, and drawing the result over
 * the preview puts the outline in the wrong place — the two coordinate systems
 * are not the same one.
 */
export const visibleSourceRect = (
  srcW: number,
  srcH: number,
  displayW: number,
  displayH: number,
): DocRect => {
  if (!srcW || !srcH || !displayW || !displayH) return { x: 0, y: 0, w: 1, h: 1 };
  const scale = Math.max(displayW / srcW, displayH / srcH);
  const w = Math.min(1, displayW / scale / srcW);
  const h = Math.min(1, displayH / scale / srcH);
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
};

/** Source-frame rectangle to a position over the preview, both normalised. */
export const sourceRectToDisplay = (
  rect: DocRect,
  srcW: number,
  srcH: number,
  displayW: number,
  displayH: number,
): DocRect => {
  const view = visibleSourceRect(srcW, srcH, displayW, displayH);
  if (!view.w || !view.h) return rect;
  return {
    x: (rect.x - view.x) / view.w,
    y: (rect.y - view.y) / view.h,
    w: rect.w / view.w,
    h: rect.h / view.h,
  };
};

/** What one look at the camera frame tells us. */
export interface FrameAnalysis {
  /** The sheet, in normalised video coordinates, or null if none is convincing. */
  rect: DocRect | null;
  /** Laplacian variance inside the sheet. Motion blur drives it toward zero. */
  sharpness: number;
  /** Share of the bounding box the sheet actually fills — low means we merged
   *  two separate bright things and the box is meaningless. */
  fill: number;
}

/** Otsu: picks the brightness that best separates the frame into two groups.
 *  A fixed offset from the mean cannot cope with a bright window in shot or a
 *  sheet lying on a pale desk; this adapts to whatever the histogram shows. */
const otsuThreshold = (hist: Int32Array, total: number): number => {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) { bestVar = between; best = t; }
  }
  return best;
};

const erode = (mask: Uint8Array, w: number, h: number): Uint8Array => {
  const out = new Uint8Array(mask.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const q = y * w + x;
      out[q] = (mask[q] && mask[q - 1] && mask[q + 1] && mask[q - w] && mask[q + w]) ? 1 : 0;
    }
  }
  return out;
};

const dilate = (mask: Uint8Array, w: number, h: number): Uint8Array => {
  const out = new Uint8Array(mask.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const q = y * w + x;
      out[q] = (mask[q] || mask[q - 1] || mask[q + 1] || mask[q - w] || mask[q + w]) ? 1 : 0;
    }
  }
  return out;
};

/**
 * Cleans the mask before anything is measured on it, in this order:
 *
 *   close  — dilate then erode: fills the dark holes the page punches in its
 *            own mask, namely the lines of text. Skipping this and eroding
 *            first cuts the sheet into horizontal strips along its own text.
 *   open   — erode then dilate: removes thin bridges, so a sheet joined to a
 *            lit window by a seam of noise stops counting as one object.
 */
const cleanMask = (mask: Uint8Array, w: number, h: number): Uint8Array => {
  const closed = erode(dilate(mask, w, h), w, h);
  return dilate(erode(closed, w, h), w, h);
};

interface Blob { area: number; x0: number; x1: number; y0: number; y1: number }

/** The biggest connected run of set pixels, with its bounding box. */
const largestBlob = (mask: Uint8Array, w: number, h: number): Blob => {
  const seen = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  let best: Blob = { area: 0, x0: 0, x1: 0, y0: 0, y1: 0 };

  for (let seed = 0; seed < mask.length; seed++) {
    if (seen[seed] || !mask[seed]) continue;
    let sp = 0;
    stack[sp++] = seed;
    seen[seed] = 1;
    let area = 0, x0 = w, x1 = -1, y0 = h, y1 = -1;

    while (sp > 0) {
      const q = stack[--sp];
      const qx = q % w, qy = (q / w) | 0;
      area++;
      if (qx < x0) x0 = qx;
      if (qx > x1) x1 = qx;
      if (qy < y0) y0 = qy;
      if (qy > y1) y1 = qy;

      if (qx > 0     && !seen[q - 1] && mask[q - 1]) { seen[q - 1] = 1; stack[sp++] = q - 1; }
      if (qx < w - 1 && !seen[q + 1] && mask[q + 1]) { seen[q + 1] = 1; stack[sp++] = q + 1; }
      if (qy > 0     && !seen[q - w] && mask[q - w]) { seen[q - w] = 1; stack[sp++] = q - w; }
      if (qy < h - 1 && !seen[q + w] && mask[q + w]) { seen[q + w] = 1; stack[sp++] = q + w; }
    }
    if (area > best.area) best = { area, x0, x1, y0, y1 };
  }
  return best;
};

/**
 * Finds the sheet of paper in the current video frame.
 *
 * Downscale, split light from dark with Otsu, then keep the largest connected
 * blob rather than the bounding box of every bright pixel. That distinction is
 * the whole point: projecting rows and columns cannot tell one sheet from a
 * sheet plus a lit window, and quietly returns a box containing both.
 *
 * Returns null when nothing plausible is found, so the caller keeps showing
 * the manual frame instead of a confident wrong answer.
 */
export const analyzeFrame = (
  video: HTMLVideoElement,
  work: HTMLCanvasElement,
  /** Restricts the search to what the preview shows. Defaults to the whole frame. */
  view: DocRect = { x: 0, y: 0, w: 1, h: 1 },
): FrameAnalysis => {
  const empty: FrameAnalysis = { rect: null, sharpness: 0, fill: 0 };
  const srcW = video.videoWidth || (video as any).width;
  const srcH = video.videoHeight || (video as any).height;
  if (!srcW || !srcH) return empty;

  // Sample only the visible slice, at its own aspect ratio
  const viewW = Math.max(1, Math.round(view.w * srcW));
  const viewH = Math.max(1, Math.round(view.h * srcH));
  const w = DETECT_WIDTH;
  const h = Math.max(1, Math.round((viewH / viewW) * w));
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d', { willReadFrequently: true });
  if (!ctx) return empty;
  ctx.drawImage(video, Math.round(view.x * srcW), Math.round(view.y * srcH), viewW, viewH, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  const lum = new Uint8ClampedArray(w * h);
  const hist = new Int32Array(256);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
    lum[p] = l;
    hist[l]++;
  }

  const threshold = otsuThreshold(hist, w * h);

  // Otsu always returns something, even for a blank wall. Reject frames where
  // the two groups are not actually far apart.
  let sumLow = 0, nLow = 0, sumHigh = 0, nHigh = 0;
  for (let t = 0; t < 256; t++) {
    if (t <= threshold) { sumLow += t * hist[t]; nLow += hist[t]; }
    else { sumHigh += t * hist[t]; nHigh += hist[t]; }
  }
  if (!nLow || !nHigh) return empty;
  if (sumHigh / nHigh - sumLow / nLow < 22) return empty;

  // ── largest connected bright region ────────────────────────────────────
  const buildMask = (level: number) => {
    const m = new Uint8Array(w * h);
    for (let p = 0; p < lum.length; p++) m[p] = lum[p] > level ? 1 : 0;
    return cleanMask(m, w, h);
  };

  let level = threshold;
  let best = largestBlob(buildMask(level), w, h);

  // A blob covering almost the whole frame means the split failed — paper on a
  // pale desk, where the sheet is barely brighter than what it lies on.
  //
  // Re-thresholding the bright half once is not enough: the anti-aliased edges
  // of the text spread thinly across the middle of the histogram, and Otsu
  // happily separates *those* from everything else, leaving desk and paper
  // still together. So walk the threshold up until the blob stops filling the
  // frame, at most a few times.
  for (let pass = 0; pass < 3 && best.area > w * h * 0.8; pass++) {
    const brightHist = new Int32Array(256);
    let brightTotal = 0;
    for (let t = level + 1; t < 256; t++) { brightHist[t] = hist[t]; brightTotal += hist[t]; }
    if (brightTotal < w * h * 0.03) break;

    const next = otsuThreshold(brightHist, brightTotal);
    if (next <= level) break;
    level = next;

    const retry = largestBlob(buildMask(level), w, h);
    if (retry.area === 0) break;
    best = retry;
  }

  if (best.area === 0) return empty;

  const rw = (best.x1 - best.x0 + 1) / w;
  const rh = (best.y1 - best.y0 + 1) / h;
  const fill = best.area / ((best.x1 - best.x0 + 1) * (best.y1 - best.y0 + 1));

  // A sheet nearly fills its own bounding box. Much less means the blob is an
  // odd shape — a desk edge, a shadow, a hand — not a page.
  if (fill < 0.62) return { rect: null, sharpness: 0, fill };

  const area = rw * rh;
  // The old floor of 0.15 refused a page simply held further away.
  if (area < 0.05 || area > 0.98) return { rect: null, sharpness: 0, fill };

  const ratio = (rw * viewW) / (rh * viewH);
  if (ratio < 0.3 || ratio > 3.4) return { rect: null, sharpness: 0, fill };

  // ── sharpness, measured inside the sheet only ──────────────────────────
  let lapSum = 0, lapSq = 0, lapN = 0;
  for (let y = Math.max(1, best.y0); y <= Math.min(h - 2, best.y1); y++) {
    for (let x = Math.max(1, best.x0); x <= Math.min(w - 2, best.x1); x++) {
      const q = y * w + x;
      const lap = 4 * lum[q] - lum[q - 1] - lum[q + 1] - lum[q - w] - lum[q + w];
      lapSum += lap;
      lapSq += lap * lap;
      lapN++;
    }
  }
  const variance = lapN > 1 ? lapSq / lapN - (lapSum / lapN) ** 2 : 0;

  return {
    // Back to source coordinates: the capture crops the sensor frame, not the
    // preview, so it must be told where the sheet is on the sensor.
    rect: {
      x: view.x + (best.x0 / w) * view.w,
      y: view.y + (best.y0 / h) * view.h,
      w: rw * view.w,
      h: rh * view.h,
    },
    sharpness: variance,
    fill,
  };
};

/** Overlap ratio between two rects — used to tell when the framing has settled. */
export const rectIoU = (a: DocRect, b: DocRect): number => {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
};

/** Captures exactly the given normalised region of the source video. */
export const cropVideoToRect = (
  video: HTMLVideoElement,
  rect: DocRect,
  canvas: HTMLCanvasElement,
): string => {
  const srcW = video.videoWidth || (video as any).width;
  const srcH = video.videoHeight || (video as any).height;
  if (!srcW || !srcH) return '';

  const pad = 0.01; // a hair of margin so edges aren't shaved off
  const sx = Math.max(0, Math.round((rect.x - pad) * srcW));
  const sy = Math.max(0, Math.round((rect.y - pad) * srcH));
  const sw = Math.min(srcW - sx, Math.round((rect.w + pad * 2) * srcW));
  const sh = Math.min(srcH - sy, Math.round((rect.h + pad * 2) * srcH));
  if (sw <= 0 || sh <= 0) return '';

  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext('2d')!.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  return encodePage(canvas);
};

// A4 ratio — the guide frame uses it so the captured page matches paper proportions
export const FRAME_ASPECT: Record<Orientation, string> = {
  portrait: '1 / 1.414',
  landscape: '1.414 / 1',
};

/**
 * Captures only the region inside the on-screen guide frame.
 *
 * The <video> is rendered with `object-cover`, so the source frame is scaled up
 * and centre-cropped to fill its box. To save just the document we map the
 * frame's screen rectangle back into source-video coordinates and draw that
 * region alone — otherwise every page would carry the surrounding desk/floor.
 *
 * Falls back to the full frame if the geometry isn't measurable yet.
 */
export const cropVideoToFrame = (
  video: HTMLVideoElement,
  frame: HTMLElement | null,
  canvas: HTMLCanvasElement,
): string => {
  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  if (!srcW || !srcH) return '';

  const ctx = canvas.getContext('2d')!;
  const videoRect = video.getBoundingClientRect();
  const frameRect = frame?.getBoundingClientRect();

  if (!frameRect || !videoRect.width || !videoRect.height) {
    canvas.width = srcW;
    canvas.height = srcH;
    ctx.drawImage(video, 0, 0);
    return encodePage(canvas);
  }

  // object-cover: the source is scaled by the larger of the two ratios, then centred
  const scale = Math.max(videoRect.width / srcW, videoRect.height / srcH);
  const offsetX = (videoRect.width - srcW * scale) / 2;
  const offsetY = (videoRect.height - srcH * scale) / 2;

  const toSource = (clientX: number, clientY: number) => ({
    x: (clientX - videoRect.left - offsetX) / scale,
    y: (clientY - videoRect.top - offsetY) / scale,
  });

  const topLeft = toSource(frameRect.left, frameRect.top);
  const bottomRight = toSource(frameRect.right, frameRect.bottom);

  const sx = Math.max(0, Math.round(topLeft.x));
  const sy = Math.max(0, Math.round(topLeft.y));
  const sw = Math.min(srcW - sx, Math.round(bottomRight.x - topLeft.x));
  const sh = Math.min(srcH - sy, Math.round(bottomRight.y - topLeft.y));

  if (sw <= 0 || sh <= 0) {
    canvas.width = srcW;
    canvas.height = srcH;
    ctx.drawImage(video, 0, 0);
    return encodePage(canvas);
  }

  canvas.width = sw;
  canvas.height = sh;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  return encodePage(canvas);
};
