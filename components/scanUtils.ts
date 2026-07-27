
export type Orientation = 'portrait' | 'landscape';

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
  quality = 0.9,
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
    return canvas.toDataURL('image/jpeg', quality);
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
    return canvas.toDataURL('image/jpeg', quality);
  }

  canvas.width = sw;
  canvas.height = sh;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/jpeg', quality);
};
