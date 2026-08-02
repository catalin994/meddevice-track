/**
 * How hard scanned pages are compressed.
 *
 * A page came out at ~410 KB before this existed: full sensor resolution,
 * colour, JPEG quality 0.9. That is generous for a sheet of paper, and on a
 * 1 GB storage quota it is the difference between roughly 550 and 1100
 * documents.
 *
 * It is a setting rather than a fixed value because the right answer is not
 * ours to pick: a blue stamp or a red annotation on a service report can
 * matter, so nothing turns a scan monochrome unless someone asks for it.
 */

export type ScanQualityId = 'high' | 'balanced' | 'compact';

export interface ScanQuality {
  id: ScanQualityId;
  label: string;
  description: string;
  /** JPEG quality, 0-1 */
  quality: number;
  /** Longest edge in pixels; 0 keeps the sensor's own resolution. */
  maxEdge: number;
  grayscale: boolean;
  /** Measured on a representative A4 page captured at 1080p. */
  approxKb: number;
}

export const SCAN_QUALITIES: ScanQuality[] = [
  {
    id: 'high',
    label: 'Inalta',
    description: 'Color, rezolutie completa. Pentru documente cu detalii fine sau poze.',
    quality: 0.9,
    maxEdge: 0,
    grayscale: false,
    approxKb: 410,
  },
  {
    id: 'balanced',
    label: 'Echilibrat',
    description: 'Color, pana la 2000px. Diferenta fata de "Inalta" nu se vede pe hartie scrisa.',
    quality: 0.8,
    maxEdge: 2000,
    grayscale: false,
    approxKb: 247,
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'Alb-negru, pana la 1600px. Ocupa cel mai putin, dar pierde stampilele colorate.',
    quality: 0.75,
    maxEdge: 1600,
    grayscale: true,
    approxKb: 205,
  },
];

const KEY = 'meditrack_scan_quality';
const DEFAULT: ScanQualityId = 'balanced';

export const getScanQuality = (): ScanQuality => {
  let id: ScanQualityId = DEFAULT;
  try {
    const stored = localStorage.getItem(KEY) as ScanQualityId | null;
    if (stored && SCAN_QUALITIES.some(q => q.id === stored)) id = stored;
  } catch { /* private mode — use the default */ }
  return SCAN_QUALITIES.find(q => q.id === id)!;
};

export const setScanQuality = (id: ScanQualityId) => {
  try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
};

/**
 * Applies the chosen profile to an already-cropped page.
 * Downscaling and desaturating happen here rather than at capture time so the
 * detection code keeps working on the full-resolution frame.
 */
export const encodePage = (source: HTMLCanvasElement, profile = getScanQuality()): string => {
  const { maxEdge, grayscale, quality } = profile;
  const longest = Math.max(source.width, source.height);
  const scale = maxEdge > 0 && longest > maxEdge ? maxEdge / longest : 1;

  if (scale === 1 && !grayscale) return source.toDataURL('image/jpeg', quality);

  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(source.width * scale));
  out.height = Math.max(1, Math.round(source.height * scale));
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, out.width, out.height);

  if (grayscale) {
    const pixels = ctx.getImageData(0, 0, out.width, out.height);
    const d = pixels.data;
    for (let i = 0; i < d.length; i += 4) {
      const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = luma;
    }
    ctx.putImageData(pixels, 0, 0);
  }

  return out.toDataURL('image/jpeg', quality);
};
