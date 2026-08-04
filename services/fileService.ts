
export type SaveOutcome = 'saved' | 'downloaded' | 'cancelled' | 'failed';

/** Converts a data: URL into a Blob. Downloading a Blob is far more reliable
 *  than pointing an <a download> at a long data: URL — Chrome refuses those
 *  above a few megabytes and most mobile browsers silently ignore them. */
export const dataUrlToBlob = (dataUrl: string): Blob | null => {
  try {
    if (!dataUrl.startsWith('data:')) return null;
    const [meta, b64] = dataUrl.split(',');
    const mime = meta.match(/data:(.*?)(;|$)/)?.[1] || 'application/octet-stream';
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
};

/**
 * Scoate diacriticele din numele fisierului.
 *
 * Un <a download="Reparație defibrilator.docx"> nu da un nume cu diacritice —
 * Chromium arunca numele intreg si salveaza fisierul ca "download", fara
 * extensie, deci Word nici nu-l deschide. Se pierde la orice document al carui
 * obiect e scris corect romaneste, adica la aproape toate.
 */
const faraDiacritice = (nume: string): string =>
  nume
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // ă â î → a a i
    .replace(/[șşȘŞ]/g, 's').replace(/[țţȚŢ]/g, 't')  // sedila nu se desparte
    .replace(/[^\x20-\x7e]/g, '')                      // orice a mai ramas
    .replace(/\s+/g, ' ').trim();

const extensionFor = (name: string, mime: string): string => {
  const fromName = name.match(/\.[a-z0-9]{1,5}$/i)?.[0];
  if (fromName) return fromName;
  if (mime === 'application/pdf') return '.pdf';
  if (mime.startsWith('image/')) return `.${mime.split('/')[1].replace('jpeg', 'jpg')}`;
  return '';
};

/**
 * Saves a file, asking the user where to put it when the browser supports it.
 *
 * Chrome/Edge on desktop expose showSaveFilePicker, which opens the native
 * "Save as" dialog — the user picks folder and name. Everywhere else we fall
 * back to a normal download (which still prompts if the browser is configured
 * to ask for a location).
 */
export const saveFileAs = async (fileName: string, source: string | Blob): Promise<SaveOutcome> => {
  const blob = typeof source === 'string' ? dataUrlToBlob(source) : source;
  if (!blob) return 'failed';

  const curat = faraDiacritice(fileName) || 'document';
  const ext = extensionFor(curat, blob.type);
  const suggestedName = curat.match(/\.[a-z0-9]{1,5}$/i) ? curat : `${curat}${ext}`;

  const picker = (window as any).showSaveFilePicker;
  if (typeof picker === 'function') {
    try {
      const handle = await picker({
        suggestedName,
        types: blob.type
          ? [{ description: 'Fisier', accept: { [blob.type]: ext ? [ext] : [] } }]
          : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (err: any) {
      // The user closed the dialog — respect that instead of downloading anyway
      if (err?.name === 'AbortError') return 'cancelled';
      // Any other failure (e.g. permission policy): fall through to the download
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the browser time to start the transfer before releasing the URL
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
};
