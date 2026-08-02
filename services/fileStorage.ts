import { supabase } from './supabase';
import { cacheBlob, getCachedBlob, deleteCachedBlob } from './storageService';

/**
 * Files live in Supabase Storage, not inside the row that references them.
 *
 * Keeping a scanned PDF as a base64 string in `devices.files` meant every
 * phone re-downloaded every document on every sync, and a device with a
 * handful of scans became a multi-megabyte row. Here the row carries only a
 * path; the bytes are fetched once and kept in IndexedDB, so a document opened
 * while online stays readable in a basement with no signal.
 */

export const BUCKET = 'device-files';

/** Storage rejects most punctuation in object keys. */
const safeName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(-80) || 'fisier';

export const buildPath = (folder: string, ownerId: string, fileId: string, name: string) =>
  `${folder}/${safeName(ownerId)}/${safeName(fileId)}-${safeName(name)}`;

export const dataUrlToBlob = (dataUrl: string): Blob => {
  const [meta, b64] = dataUrl.split(',');
  const type = meta.match(/data:(.*?)(;|$)/)?.[1] || 'application/octet-stream';
  const bytes = atob(b64 || '');
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  return new Blob([buffer], { type });
};

export type UploadResult = { path?: string; error?: string };

/**
 * Uploads and caches locally. A failure is reported rather than thrown so the
 * caller can fall back to storing the data URL inline — losing a scan because
 * the phone dropped signal mid-upload would be far worse than a fat row.
 */
export const uploadFile = async (path: string, blob: Blob): Promise<UploadResult> => {
  await cacheBlob(path, blob).catch(() => { /* cache is best-effort */ });
  if (!supabase) return { error: 'Cloud-ul nu este configurat.' };
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || 'application/octet-stream', upsert: true });
  if (error) {
    await deleteCachedBlob(path).catch(() => { /* ignore */ });
    return { error: error.message };
  }
  return { path };
};

export const uploadDataUrl = async (path: string, dataUrl: string): Promise<UploadResult> => {
  try {
    return await uploadFile(path, dataUrlToBlob(dataUrl));
  } catch {
    return { error: 'Fisierul nu a putut fi citit.' };
  }
};

/** Cache first, network second — and whatever comes off the network is cached. */
export const fetchFile = async (path: string): Promise<Blob | null> => {
  const cached = await getCachedBlob(path).catch(() => null);
  if (cached) return cached;
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  await cacheBlob(path, data).catch(() => { /* ignore */ });
  return data;
};

export const removeFile = async (path: string) => {
  await deleteCachedBlob(path).catch(() => { /* ignore */ });
  if (supabase) await supabase.storage.from(BUCKET).remove([path]).catch(() => { /* ignore */ });
};

/**
 * What a viewer or a download should read.
 * Legacy records keep their data URL inline; new ones carry a path.
 */
export const resolveSource = async (
  record: { path?: string; url?: string }
): Promise<{ blob?: Blob; dataUrl?: string; error?: string }> => {
  if (record.path) {
    const blob = await fetchFile(record.path);
    return blob ? { blob } : { error: 'Fisierul nu a putut fi descarcat. Verifica internetul.' };
  }
  if (record.url) return { dataUrl: record.url };
  return { error: 'Fisierul lipseste.' };
};
