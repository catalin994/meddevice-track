import { pdfItemsToText, parseAmount } from './invoiceParse';

/**
 * Ce se poate citi dintr-un contract, ca sa nu fie tastat din nou.
 *
 * Contractul e deja scris: numarul, partile, obiectul si perioada sunt in el,
 * de obicei sub titluri care se repeta de la un contract la altul ("OBIECTUL
 * CONTRACTULUI", "DURATA CONTRACTULUI"). Se citesc de acolo si se pun in
 * formular, unde raman de verificat — niciun camp nu se salveaza fara ca omul
 * sa-l fi vazut.
 *
 * Nu inlocuieste cititul contractului. Scuteste tastarea.
 */

export interface CampuriContract {
  /** "Contract de prestari servicii mentenanta aparatura medicala" */
  name: string;
  contractNumber: string;
  provider: string;
  /** Obiectul, asa cum e scris in articolul lui. */
  coverageDetails: string;
  startDate: string;
  endDate: string;
  annualCost: number;
  /** Randurile citite, ca sa se poata vedea de ce a iesit gresit ceva. */
  lines: string[];
}

const DIAC: Record<string, string> = {
  'ă':'a','â':'a','î':'i','ș':'s','ş':'s','ț':'t','ţ':'t',
  'Ă':'A','Â':'A','Î':'I','Ș':'S','Ş':'S','Ț':'T','Ţ':'T',
};
const norm = (s: string) => s.replace(/[ăâîșşțţĂÂÎȘŞȚŢ]/g, c => DIAC[c] || c).toLowerCase();

/** Data romaneasca in forma ISO. "09.02.2024" → "2024-02-09". */
export const laISO = (brut: string): string => {
  const m = brut.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/);
  if (!m) return '';
  const [, z, l, a] = m;
  const an = a.length === 2 ? `20${a}` : a;
  const zi = z.padStart(2, '0'), luna = l.padStart(2, '0');
  if (+luna < 1 || +luna > 12 || +zi < 1 || +zi > 31) return '';
  return `${an}-${luna}-${zi}`;
};

const LUNI: Record<string, string> = {
  ianuarie:'01', februarie:'02', martie:'03', aprilie:'04', mai:'05', iunie:'06',
  iulie:'07', august:'08', septembrie:'09', octombrie:'10', noiembrie:'11', decembrie:'12',
};

/** "09 februarie 2024" — cum se scrie in contractele redactate de juristi. */
const dataInLitere = (t: string): string => {
  const m = norm(t).match(/\b(\d{1,2})\s+(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)\s+(\d{4})\b/);
  return m ? `${m[3]}-${LUNI[m[2]]}-${m[1].padStart(2, '0')}` : '';
};

const oData = (t: string): string => laISO(t) || dataInLitere(t);

/** Textul de dupa o eticheta, pana la capatul frazei sau al randului. */
const dupaEticheta = (linii: string[], re: RegExp, maxRanduri = 4): string => {
  for (let i = 0; i < linii.length; i++) {
    const m = linii[i].match(re);
    if (!m) continue;
    let rest = linii[i].slice((m.index || 0) + m[0].length).trim();
    // Titlul e singur pe rand ("OBIECTUL CONTRACTULUI"), continutul urmeaza.
    for (let j = 1; j <= maxRanduri && rest.replace(/[^a-zA-Z]/g, '').length < 12; j++) {
      rest = `${rest} ${(linii[i + j] || '').trim()}`.trim();
    }
    return rest.replace(/^[\s:.\-–—]+/, '').replace(/\s{2,}/g, ' ').trim();
  }
  return '';
};

const RE_NUMAR = /\bnr\.?\s*(?:contract(?:ului)?\s*)?[:.]?\s*([A-Za-z0-9][A-Za-z0-9\-\/._]{1,24})/i;

/** Titlul contractului: primul rand care incepe cu "CONTRACT". */
const gasesteTitlul = (linii: string[]): string => {
  for (const l of linii.slice(0, 25)) {
    const n = norm(l).trim();
    if (!/^(contract|acord[- ]cadru|act aditional)\b/.test(n)) continue;
    // Fara numarul si data din coada: alea au campurile lor.
    return l.replace(/\s*nr\.?\s*[:.]?\s*[A-Za-z0-9][A-Za-z0-9\-\/._]*.*$/i, '')
            .replace(/\s{2,}/g, ' ').trim();
  }
  return '';
};

/**
 * Firma cu care s-a incheiat.
 *
 * Spitalul e mereu una din parti, deci partea cealalta e cea cautata. Se
 * recunoaste dupa calitatea scrisa langa ea — prestator, furnizor, executant —
 * fiindca ordinea partilor nu e aceeasi in toate contractele.
 */
const gasestePrestatorul = (linii: string[]): string => {
  const RE_CALITATE = /(?:in\s+calitate\s+de\s+)?(prestator|furnizor|executant|vanzator|antreprenor)\b/i;
  for (const l of linii) {
    const n = norm(l);
    if (!RE_CALITATE.test(n)) continue;
    if (/achizitor|beneficiar|cumparator|spital/.test(n.split(RE_CALITATE)[0] || '')) continue;
    // Numele firmei: pana la prima virgula, fara forma juridica din fata.
    const inainte = l.split(/,|\s+cu sediul|\s+in calitate/i)[0].trim();
    const curat = inainte.replace(/^(s\.?c\.?|sc)\s+/i, '').trim();
    if (curat.length >= 3 && /[a-zA-Z]{3}/.test(curat)) return curat;
  }
  return '';
};

/** Perioada: doua date in aceeasi fraza, sau o durata in luni de la o data. */
const gasestePerioada = (linii: string[], text: string): { startDate: string; endDate: string } => {
  const zonaDurata = dupaEticheta(linii, /durata\s+contractului|perioada\s+contractului|termenul\s+contractului/i, 6)
    || text;

  // "de la 09.02.2024 pana la 08.02.2025"
  const dela = zonaDurata.match(/(?:incepand\s+(?:cu|de\s+la)|de\s+la|din\s+data\s+de)\s*[:]?\s*([^,;]{0,40}?)(?=\s*(?:pana|si|,|;|\.|$))/i);
  const panala = zonaDurata.match(/pana\s+la\s*(?:data\s+de)?\s*[:]?\s*([^,;]{0,40})/i);
  let startDate = dela ? oData(dela[1]) : '';
  let endDate = panala ? oData(panala[1]) : '';

  // Doua date una dupa alta, fara cuvinte intre ele.
  if (!startDate || !endDate) {
    const toate = (zonaDurata.match(/\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b/g) || []).map(laISO).filter(Boolean);
    if (!startDate && toate[0]) startDate = toate[0];
    if (!endDate && toate[1]) endDate = toate[1];
  }

  // "pe o perioada de 12 luni de la data semnarii"
  if (startDate && !endDate) {
    const luni = zonaDurata.match(/(?:perioada|durata|termen)\s+de\s+(\d{1,3})\s*(luni|ani|zile)/i)
      || zonaDurata.match(/\b(\d{1,3})\s*(luni|ani|zile)\b/i);
    if (luni) {
      const d = new Date(`${startDate}T00:00:00`);
      const n = parseInt(luni[1], 10);
      const unitate = norm(luni[2]);
      if (unitate === 'luni') d.setMonth(d.getMonth() + n);
      else if (unitate === 'ani') d.setFullYear(d.getFullYear() + n);
      else d.setDate(d.getDate() + n);
      d.setDate(d.getDate() - 1);
      endDate = d.toISOString().split('T')[0];
    }
  }
  if (startDate && endDate && endDate < startDate) endDate = '';
  return { startDate, endDate };
};

/** Valoarea contractului. Se prefera cea fara TVA, ca peste tot in aplicatie. */
const gasesteValoarea = (linii: string[]): number => {
  const candidati: { valoare: number; rang: number }[] = [];
  for (const l of linii) {
    const n = norm(l);
    if (!/valoare|pret\s+total|cuantum/.test(n)) continue;
    const numere = (l.match(/\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/g) || [])
      .map(parseAmount).filter(v => v > 0);
    if (numere.length === 0) continue;
    // "fara TVA" bate "cu TVA"; "estimata" e mai slaba decat "totala".
    const rang = (/fara\s*tva/.test(n) ? 3 : 0) + (/total/.test(n) ? 2 : 0) + (/estimat/.test(n) ? -1 : 0);
    candidati.push({ valoare: Math.max(...numere), rang });
  }
  candidati.sort((a, b) => b.rang - a.rang || b.valoare - a.valoare);
  return candidati[0]?.valoare || 0;
};

/** Citeste campurile dintr-un contract deja transformat in text. */
export const extrageContract = (text: string): CampuriContract => {
  const linii = text.split('\n').map(l => l.trim()).filter(Boolean);
  const primele = linii.slice(0, 30).join(' ');

  const obiect = dupaEticheta(linii, /obiectul\s+(?:prezentului\s+)?(?:contract|acord)(?:ului)?/i, 5)
    || dupaEticheta(linii, /obiectul\s*[:]/i, 4);

  const { startDate, endDate } = gasestePerioada(linii, linii.join(' '));

  return {
    name: gasesteTitlul(linii),
    contractNumber: (primele.match(RE_NUMAR)?.[1] || '').replace(/[.,;:]+$/, ''),
    provider: gasestePrestatorul(linii),
    coverageDetails: obiect.slice(0, 400),
    startDate,
    endDate,
    annualCost: gasesteValoarea(linii),
    lines: linii,
  };
};

/** Citeste contractul direct din PDF. */
export const citesteContractPdf = async (fisier: Blob): Promise<CampuriContract> => {
  const pdfjsLib = await import('pdfjs-dist');
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
    new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  const pdf = await (pdfjsLib as any).getDocument({ data: await fisier.arrayBuffer() }).promise;
  const pagini: string[] = [];
  // Ce conteaza e in primele pagini: titlul, partile, obiectul, durata. Restul
  // sunt clauze si anexe, in care s-ar gasi date si sume care incurca.
  const maxPagini = Math.min(pdf.numPages, 6);
  for (let p = 1; p <= maxPagini; p++) {
    const continut = await (await pdf.getPage(p)).getTextContent();
    pagini.push(pdfItemsToText(continut.items as any));
  }
  return extrageContract(pagini.join('\n'));
};
