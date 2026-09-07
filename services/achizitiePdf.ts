import { pdfItemsToText, hasUsableText } from './invoiceParse';
import { ocrPdf, OcrProgress } from './invoiceOcr';
import { DocumentWord } from './docxCitit';
import { citesteFundamentareDinWord, citesteReferatDinWord, CampuriFundamentare, CampuriReferat } from './achizitieWordParse';

/**
 * Acelasi document, venit ca PDF.
 *
 * Documentul de fundamentare ajunge in doua feluri: fisierul Word din care a
 * fost scos la imprimanta, sau PDF-ul — exportat, ori scanat dupa ce a fost
 * semnat. Din Word ies paragrafe si tabele; dintr-un PDF ies randuri de text, si
 * atat. Etichetele se citesc la fel de bine din randuri, asa ca aceeasi
 * extragere lucreaza pe amandoua: PDF-ul se aduce la forma unui document fara
 * tabele, iar randul de valori se scoate din text.
 *
 * Cand pagina nu are text — adica e o scanare — se trece pe OCR, ca la facturi.
 * Acolo iesirea e mai putin sigura, si se spune.
 */

/** Randurile unui PDF, ca si cum ar fi paragrafele unui document Word. */
const caDocument = (text: string): DocumentWord => {
  const paragrafe = text.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
  return { paragrafe, tabele: [], text: paragrafe.join('\n') };
};

/** Textul unui PDF, cu OCR cand paginile sunt scanari. */
const textulPdf = async (
  fisier: Blob,
  onProgress?: OcrProgress,
): Promise<{ text: string; prinOcr: boolean }> => {
  const pdfjsLib = await import('pdfjs-dist');
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
    new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  const pdf = await (pdfjsLib as any).getDocument({ data: await fisier.arrayBuffer() }).promise;
  const pagini: string[] = [];
  // Patru pagini ajung: antetul, sectiunea A si tabelul de valori sunt pe
  // primele doua, restul sunt semnaturi.
  for (let p = 1; p <= Math.min(pdf.numPages, 4); p++) {
    const continut = await (await pdf.getPage(p)).getTextContent();
    pagini.push(pdfItemsToText(continut.items as any));
  }
  const text = pagini.join('\n');
  if (hasUsableText(text)) return { text, prinOcr: false };
  return { text: await ocrPdf(pdf, onProgress, 3), prinOcr: true };
};

export const citesteFundamentarePdf = async (
  fisier: Blob,
  onProgress?: OcrProgress,
): Promise<CampuriFundamentare & { prinOcr: boolean }> => {
  const { text, prinOcr } = await textulPdf(fisier, onProgress);
  return { ...citesteFundamentareDinWord(caDocument(text)), prinOcr };
};

export const citesteReferatPdf = async (
  fisier: Blob,
  onProgress?: OcrProgress,
): Promise<CampuriReferat & { prinOcr: boolean }> => {
  const { text, prinOcr } = await textulPdf(fisier, onProgress);
  return { ...citesteReferatDinWord(caDocument(text)), prinOcr };
};
