import { hasUsableText } from './invoiceParse';

/**
 * Reading an invoice that arrived as a picture.
 *
 * Plenty of invoices reach a hospital as a scan: printed by the supplier, put
 * through a copier, emailed as a PDF that contains one image per page and not
 * a single character of text. pdf.js returns nothing for those, so every field
 * came out empty and the app said only that extraction had failed — which is
 * true but useless, because it doesn't say the page has no text to extract.
 *
 * So when the text layer comes back thin, the pages are rendered and read with
 * OCR instead. It is slow — a few seconds a page — so it only runs when there
 * is nothing else to go on.
 */

/** Rendered wide enough for 8pt type to survive; larger is slower, not better. */
const LATIME_OCR = 1600;

export type OcrProgress = (pagina: number, dinTotal: number, procent: number) => void;

export const pdfPageToImage = async (
  pdf: any,
  numar: number,
): Promise<string> => {
  const page = await pdf.getPage(numar);
  const initial = page.getViewport({ scale: 1 });
  const scale = Math.min(3, Math.max(1, LATIME_OCR / initial.width));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  // Alb dedesubt: paginile PDF sunt transparente, iar OCR pe negru nu citeste.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL('image/png');
};

/**
 * OCR over the pages of a scanned invoice.
 *
 * Romanian first, English as the fallback: the language data is fetched at
 * runtime, and a hospital laptop behind a strict proxy may not get the
 * Romanian pack. English still reads the numbers and the dates, which is most
 * of what a form needs.
 */
export const ocrPdf = async (
  pdf: any,
  onProgress?: OcrProgress,
  maxPagini = 3,
): Promise<string> => {
  const Tesseract = (await import('tesseract.js')).default;
  const total = Math.min(pdf.numPages, maxPagini);
  const bucati: string[] = [];

  for (let i = 1; i <= total; i++) {
    const imagine = await pdfPageToImage(pdf, i);
    if (!imagine) continue;
    const citeste = (limba: string) => Tesseract.recognize(imagine, limba, {
      logger: (m: any) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(i, total, Math.round((m.progress || 0) * 100));
        }
      },
    });
    let rezultat;
    try { rezultat = await citeste('ron'); }
    catch { rezultat = await citeste('eng'); }
    bucati.push(rezultat.data.text || '');
  }

  return bucati.join('\n');
};

/** True when the PDF's own text layer is too thin to parse. */
export const needsOcr = (text: string) => !hasUsableText(text);
