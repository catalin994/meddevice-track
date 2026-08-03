
import { encodePage } from '../services/scanQuality';
export type Orientation = 'portrait' | 'landscape';

/** Normalised rectangle (0..1) in source-video coordinates. */
export interface DocRect { x: number; y: number; w: number; h: number }

const DETECT_WIDTH = 160;
// Wide enough to place an edge within a pixel, and the last width that still
// costs almost nothing: past ~200 the per-frame time jumps four-fold.
const REFINE_WIDTH = 192;

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

/** Brightness below which p of the samples fall, read off a histogram. */
const percentile = (hist: Int32Array, total: number, p: number): number => {
  let seen = 0;
  for (let t = 0; t < 256; t++) {
    seen += hist[t];
    if (seen >= total * p) return t;
  }
  return 255;
};

/**
 * Re-measures the four edges of a coarse detection on the full-resolution frame.
 *
 * The search runs at 160 pixels wide, so one detection pixel is four to six
 * sensor pixels and the morphology rounds the corners of whatever it finds:
 * the box lands within a few pixels of the sheet, never on it. Cropping on that
 * shaves a strip of text off one side and leaves a band of desk on the other.
 *
 * So look again, only around the edges the coarse pass proposed and at real
 * resolution. Paper and desk are separated by a level derived from both — the
 * bright three-quarters of the sheet's own interior against the median of the
 * surrounding ring — and each edge is placed where the profile across it
 * crosses halfway, interpolated between samples. Any edge that cannot be found
 * that way keeps its coarse value rather than inventing one.
 */
const refineRect = (
  video: HTMLVideoElement | HTMLCanvasElement,
  srcW: number,
  srcH: number,
  coarse: DocRect,
  view: DocRect,
  work: HTMLCanvasElement,
): DocRect => {
  // Look a little outside the coarse box, but never outside the preview
  const mx = coarse.w * 0.08, my = coarse.h * 0.08;
  const rx0 = Math.max(view.x, coarse.x - mx);
  const ry0 = Math.max(view.y, coarse.y - my);
  const rx1 = Math.min(view.x + view.w, coarse.x + coarse.w + mx);
  const ry1 = Math.min(view.y + view.h, coarse.y + coarse.h + my);
  const regW = Math.round((rx1 - rx0) * srcW);
  const regH = Math.round((ry1 - ry0) * srcH);
  if (regW < 32 || regH < 32) return coarse;

  const w = Math.min(REFINE_WIDTH, regW);
  const h = Math.max(1, Math.round(regH * (w / regW)));
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d', { willReadFrequently: true });
  if (!ctx) return coarse;
  ctx.drawImage(video as CanvasImageSource,
    Math.round(rx0 * srcW), Math.round(ry0 * srcH), regW, regH, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  const lum = new Uint8ClampedArray(w * h);
  const wholeHist = new Int32Array(256);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
    lum[p] = l;
    wholeHist[l]++;
  }

  // The coarse box, in this region's own pixels
  const kx = w / regW, ky = h / regH;
  const cx0 = (coarse.x - rx0) * srcW * kx;
  const cy0 = (coarse.y - ry0) * srcH * ky;
  const cx1 = cx0 + coarse.w * srcW * kx;
  const cy1 = cy0 + coarse.h * srcH * ky;
  const cw = cx1 - cx0, ch = cy1 - cy0;
  if (cw < 8 || ch < 8) return coarse;

  /** Brightness histogram of a box of the region, clipped to it. */
  const sample = (x0: number, x1: number, y0: number, y1: number) => {
    const hist = new Int32Array(256);
    let n = 0;
    const ax0 = Math.max(0, Math.round(x0)), ax1 = Math.min(w - 1, Math.round(x1));
    const ay0 = Math.max(0, Math.round(y0)), ay1 = Math.min(h - 1, Math.round(y1));
    for (let y = ay0; y <= ay1; y++) {
      for (let x = ax0; x <= ax1; x++) { hist[lum[y * w + x]]++; n++; }
    }
    return { hist, n };
  };

  // Paper against desk over the whole sheet: the bright three-quarters of the
  // interior, so the text is ignored, against the median of everything outside.
  const inside = sample(cx0 + cw * 0.2, cx1 - cw * 0.2, cy0 + ch * 0.2, cy1 - ch * 0.2);
  const outside = new Int32Array(256);
  let outN = 0;
  for (let t = 0; t < 256; t++) {
    const n = wholeHist[t] - inside.hist[t];
    if (n > 0) { outside[t] = n; outN += n; }
  }
  if (inside.n < 64 || outN < 64) return coarse;

  const paper = percentile(inside.hist, inside.n, 0.75);
  const desk = percentile(outside, outN, 0.5);
  if (paper - desk < 18) return coarse; // too little contrast to place an edge
  const wholeLevel = desk + (paper - desk) * 0.5;

  // Profiles are taken across the middle half of each edge: the corners are
  // where a rounded or lifted sheet misleads, and where a shadow pools.
  const bandY0 = Math.max(0, Math.round(cy0 + ch * 0.25));
  const bandY1 = Math.min(h - 1, Math.round(cy1 - ch * 0.25));
  const bandX0 = Math.max(0, Math.round(cx0 + cw * 0.25));
  const bandX1 = Math.min(w - 1, Math.round(cx1 - cw * 0.25));
  if (bandY1 - bandY0 < 4 || bandX1 - bandX0 < 4) return coarse;

  /**
   * Each edge gets its own paper/desk split, read from the strips either side
   * of it. One number for the whole sheet cannot survive a shadow across one
   * half: the shaded margin then reads darker than the desk does in the light,
   * and that edge is cut off inside the page. Falls back to the sheet-wide
   * level whenever a strip is too small or too flat to say anything.
   */
  const levelAt = (pb: [number, number, number, number], db: [number, number, number, number]) => {
    const pi = sample(...pb), di = sample(...db);
    if (pi.n < 32 || di.n < 32) return wholeLevel;
    const pl = percentile(pi.hist, pi.n, 0.75);
    const dl = percentile(di.hist, di.n, 0.5);
    if (pl - dl < 18) return wholeLevel;
    return dl + (pl - dl) * 0.5;
  };

  const colFrac = (x: number, level: number) => {
    let n = 0;
    for (let y = bandY0; y <= bandY1; y++) if (lum[y * w + x] > level) n++;
    return n / (bandY1 - bandY0 + 1);
  };
  const rowFrac = (y: number, level: number) => {
    let n = 0;
    for (let x = bandX0; x <= bandX1; x++) if (lum[y * w + x] > level) n++;
    return n / (bandX1 - bandX0 + 1);
  };

  // How many samples past the crossing must stay on paper before it counts —
  // otherwise a bright speck on the desk reads as the edge of the sheet.
  const run = Math.max(2, Math.round(Math.min(w, h) * 0.015));

  const findEdge = (
    frac: (i: number, level: number) => number,
    level: number, from: number, to: number, last: number,
  ) => {
    const step = to > from ? 1 : -1;
    let prev = frac(from, level);
    for (let i = from + step; step > 0 ? i <= to : i >= to; i += step) {
      const cur = frac(i, level);
      if (cur >= 0.5 && prev < 0.5) {
        let solid = true;
        for (let k = 1; k <= run; k++) {
          const j = i + step * k;
          if (j < 0 || j > last) break;
          if (frac(j, level) < 0.5) { solid = false; break; }
        }
        if (solid) {
          const t = cur > prev ? (0.5 - prev) / (cur - prev) : 0;
          return (i - step) + step * t;
        }
      }
      prev = cur;
    }
    return null;
  };

  const left = findEdge(colFrac,
    levelAt([cx0 + cw * 0.02, cx0 + cw * 0.14, bandY0, bandY1], [cx0 - cw * 0.07, cx0 - cw * 0.02, bandY0, bandY1]),
    0, Math.min(w - 1, Math.round(cx1)), w - 1);
  const right = findEdge(colFrac,
    levelAt([cx1 - cw * 0.14, cx1 - cw * 0.02, bandY0, bandY1], [cx1 + cw * 0.02, cx1 + cw * 0.07, bandY0, bandY1]),
    w - 1, Math.max(0, Math.round(cx0)), w - 1);
  const top = findEdge(rowFrac,
    levelAt([bandX0, bandX1, cy0 + ch * 0.02, cy0 + ch * 0.14], [bandX0, bandX1, cy0 - ch * 0.07, cy0 - ch * 0.02]),
    0, Math.min(h - 1, Math.round(cy1)), h - 1);
  const bottom = findEdge(rowFrac,
    levelAt([bandX0, bandX1, cy1 - ch * 0.14, cy1 - ch * 0.02], [bandX0, bandX1, cy1 + ch * 0.02, cy1 + ch * 0.07]),
    h - 1, Math.max(0, Math.round(cy0)), h - 1);

  const nx0 = left != null ? rx0 + (left / kx) / srcW : coarse.x;
  const nx1 = right != null ? rx0 + (right / kx) / srcW : coarse.x + coarse.w;
  const ny0 = top != null ? ry0 + (top / ky) / srcH : coarse.y;
  const ny1 = bottom != null ? ry0 + (bottom / ky) / srcH : coarse.y + coarse.h;

  const nw = nx1 - nx0, nh = ny1 - ny0;
  if (nw <= 0 || nh <= 0) return coarse;
  // A refinement is a correction of a few pixels. Anything larger means the
  // profile latched onto something else, and the coarse box was the better bet.
  if (Math.abs(nw - coarse.w) > coarse.w * 0.3 || Math.abs(nh - coarse.h) > coarse.h * 0.3) return coarse;

  return { x: nx0, y: ny0, w: nw, h: nh };
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

  // Back to source coordinates: the capture crops the sensor frame, not the
  // preview, so it must be told where the sheet is on the sensor.
  const coarse: DocRect = {
    x: view.x + (best.x0 / w) * view.w,
    y: view.y + (best.y0 / h) * view.h,
    w: rw * view.w,
    h: rh * view.h,
  };

  return {
    rect: refineRect(video, srcW, srcH, coarse, view, work),
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

  // A margin of the same few pixels on all four sides. Taking a percentage of
  // the frame instead made it wider than it was tall, and on a page held close
  // it added a fat band of desk to keep a hairline of paper.
  const pad = Math.round(Math.min(rect.w * srcW, rect.h * srcH) * 0.012);
  const sx = Math.max(0, Math.round(rect.x * srcW) - pad);
  const sy = Math.max(0, Math.round(rect.y * srcH) - pad);
  const sw = Math.min(srcW - sx, Math.round(rect.w * srcW) + pad * 2);
  const sh = Math.min(srcH - sy, Math.round(rect.h * srcH) + pad * 2);
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
