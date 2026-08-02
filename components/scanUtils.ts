
import { encodePage } from '../services/scanQuality';
export type Orientation = 'portrait' | 'landscape';

/** Normalised rectangle (0..1) in source-video coordinates. */
export interface DocRect { x: number; y: number; w: number; h: number }

const DETECT_WIDTH = 160;

/**
 * Finds the sheet of paper in the current video frame.
 *
 * Paper is almost always brighter than whatever it lies on, so we downscale the
 * frame, mark pixels well above the average brightness, then take row/column
 * projections to get the dominant bright block. That is far cheaper than full
 * contour detection and holds up well for documents on a desk.
 *
 * Returns null when nothing plausible is found (too small, too large, or an
 * implausible aspect ratio) so the caller can keep showing the manual frame.
 */
export const detectDocumentRect = (
  video: HTMLVideoElement,
  work: HTMLCanvasElement,
): DocRect | null => {
  const srcW = video.videoWidth || (video as any).width;
  const srcH = video.videoHeight || (video as any).height;
  if (!srcW || !srcH) return null;

  const w = DETECT_WIDTH;
  const h = Math.max(1, Math.round((srcH / srcW) * w));
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  const lum = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    lum[p] = l;
    sum += l;
  }
  const mean = sum / (w * h);

  // Spread tells us whether there is a real light/dark separation at all
  let variance = 0;
  for (let p = 0; p < lum.length; p++) variance += (lum[p] - mean) ** 2;
  const std = Math.sqrt(variance / lum.length);
  if (std < 12) return null; // flat frame — nothing to lock on to

  const threshold = mean + std * 0.35;

  const colCount = new Int32Array(w);
  const rowCount = new Int32Array(h);
  let bright = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (lum[y * w + x] > threshold) {
        colCount[x]++;
        rowCount[y]++;
        bright++;
      }
    }
  }
  if (bright < w * h * 0.08) return null;

  // Keep rows/cols where a good share of pixels are paper-bright
  const firstAbove = (arr: Int32Array, total: number, frac: number) => {
    const need = total * frac;
    for (let i = 0; i < arr.length; i++) if (arr[i] >= need) return i;
    return -1;
  };
  const lastAbove = (arr: Int32Array, total: number, frac: number) => {
    const need = total * frac;
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] >= need) return i;
    return -1;
  };

  const x0 = firstAbove(colCount, h, 0.3);
  const x1 = lastAbove(colCount, h, 0.3);
  const y0 = firstAbove(rowCount, w, 0.3);
  const y1 = lastAbove(rowCount, w, 0.3);
  if (x0 < 0 || y0 < 0 || x1 <= x0 || y1 <= y0) return null;

  const rw = (x1 - x0 + 1) / w;
  const rh = (y1 - y0 + 1) / h;
  const area = rw * rh;
  if (area < 0.15 || area > 0.97) return null;

  const ratio = (rw * srcW) / (rh * srcH);
  if (ratio < 0.35 || ratio > 3) return null;

  return { x: x0 / w, y: y0 / h, w: rw, h: rh };
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
