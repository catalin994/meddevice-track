import { pdfItemsToText, parseAmount, hasUsableText } from './invoiceParse';
import { ocrPdf, OcrProgress } from './invoiceOcr';
import { ComandaItem } from '../types';

/**
 * Citeste o comanda catre furnizor.
 *
 * Comanda spitalului e un formular tiparit de programul de gestiune: antetul
 * are beneficiarul in stanga si furnizorul in dreapta, mijlocul are trimiterile
 * — numar, data, referat, oferta, contract, gestiune, termen de plata — iar jos
 * e tabelul de pozitii cu totalul pe trei coloane, fara TVA, TVA si cu TVA.
 *
 * Partea delicata e antetul: pe doua coloane, deci fiecare rand citit din PDF
 * contine si o bucata din stanga, si una din dreapta. "Cod fiscal: 4384117" al
 * spitalului si "Cod fiscal: 42196701" al furnizorului stau pe randuri diferite,
 * dar "Beneficiar: SPITALUL ... MED4LIFE SUPPLIER S.R.L." stau pe acelasi.
 */

export interface CampuriComanda {
  number: string;
  date: string;
  supplier: string;
  supplierCui: string;
  referatNumber: string;
  offerNumber: string;
  contractNumber: string;
  frameworkContract: string;
  warehouse: string;
  paymentDays: number;
  items: ComandaItem[];
  /** Totalurile tiparite, cand exista — bat calculul din pozitii. */
  totalFaraTva: number;
  totalTva: number;
  totalCuTva: number;
  lines: string[];
  prinOcr?: boolean;
}

const DIACRITICE: Record<string, string> = {
  'ă':'a','â':'a','î':'i','ș':'s','ş':'s','ț':'t','ţ':'t',
  'Ă':'A','Â':'A','Î':'I','Ș':'S','Ş':'S','Ț':'T','Ţ':'T',
};
const platit = (s: string) => s.replace(/[ăâîșşțţĂÂÎȘŞȚŢ]/g, c => DIACRITICE[c] || c).toLowerCase();

/** "10.08.2026" → "2026-08-10". Anul de doua cifre e din anii 2000. */
export const dataComenzii = (brut: string): string => {
  const m = brut.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/)
    || brut.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2})\b(?![.\/-]?\d)/);
  if (!m) return '';
  const an = m[3].length === 2 ? `20${m[3]}` : m[3];
  const luna = m[2].padStart(2, '0'), zi = m[1].padStart(2, '0');
  if (+luna < 1 || +luna > 12 || +zi < 1 || +zi > 31) return '';
  return `${an}-${luna}-${zi}`;
};

/**
 * Valoarea unei etichete, cand randul poate purta doua etichete deodata.
 *
 * "Cod fiscal: 4384117 Nr.comanda: 1984 Acord cadru:" — valoarea lui
 * Nr.comanda se termina acolo unde incepe eticheta urmatoare, nu la capatul
 * randului. De aceea se taie la prima eticheta care urmeaza.
 */
const RE_ORICE_ETICHETA = /\b(?:beneficiar|adresa|cod\s*fiscal|localitate|jude[tț]|tel|fax|cont|banca|comanda|contract|nr\.?\s*comanda|acord\s*cadru|data\s*comenzii|num[aă]r\s*referat|num[aă]r\s*ofert[aă]|gestiunea|termen\s*de\s*plata)\s*:/i;

const valoareaEtichetei = (linii: string[], eticheta: RegExp): string => {
  for (const l of linii) {
    const plat = platit(l);
    const m = plat.match(eticheta);
    if (!m || m.index === undefined) continue;
    const dupa = l.slice(m.index + m[0].length);
    // Se taie la urmatoarea eticheta de pe acelasi rand.
    const urm = platit(dupa).search(RE_ORICE_ETICHETA);
    const val = (urm > 0 ? dupa.slice(0, urm) : dupa).replace(/^[\s:.\-–—]+/, '').trim();
    if (val) return val.replace(/\s{2,}/g, ' ');
  }
  return '';
};

/**
 * Cantitatea, din coloana cu trei zecimale.
 *
 * Programul de gestiune tipareste "5,000" pentru cinci bucati. Citit ca o suma
 * de bani, virgula ar fi separator de mii si ar iesi cinci mii — adica o
 * comanda de cinci mii de casete de sterilizare, cu valoarea unitara impartita
 * la o mie.
 */
const cantitatea = (brut: string): number => {
  const t = brut.trim();
  if (/^\d{1,4},\d{3}$/.test(t)) return parseFloat(t.replace(',', '.'));
  return parseAmount(t);
};

/** Randul de pozitie: "1 CUTIE CASETE ... 3020400002 BUC 5,000 3.950,00 19.750,00 4.147,50 23.897,50" */
const RE_POZITIE = /^\s*(\d{1,3})\s+(.+?)\s+(\d{6,})\s+([A-Za-z.]{1,6})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*$/;
/** Fara cont contabil, cum tiparesc alte programe. */
const RE_POZITIE_SCURTA = /^\s*(\d{1,3})\s+(.+?)\s+([A-Za-z.]{1,6})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*$/;

const pozitiile = (linii: string[]): ComandaItem[] => {
  const out: ComandaItem[] = [];
  for (const l of linii) {
    if (/^\s*total\b/i.test(platit(l))) break;
    const m = l.match(RE_POZITIE);
    if (m) {
      out.push({
        id: `P-${out.length + 1}`,
        name: m[2].trim(),
        account: m[3],
        unit: m[4].toUpperCase().replace(/\.$/, ''),
        quantity: cantitatea(m[5]),
        unitPrice: parseAmount(m[6]),
      });
      continue;
    }
    const s = l.match(RE_POZITIE_SCURTA);
    if (s && /[a-zA-Z]{4}/.test(s[2])) {
      out.push({
        id: `P-${out.length + 1}`,
        name: s[2].trim(),
        unit: s[3].toUpperCase().replace(/\.$/, ''),
        quantity: cantitatea(s[4]),
        unitPrice: parseAmount(s[5]),
      });
    }
  }
  return out;
};

/** Randul de total: trei sume, fara TVA / TVA / cu TVA. */
const totalurile = (linii: string[]): { faraTva: number; tva: number; cuTva: number } => {
  for (const l of linii) {
    if (!/^\s*total\b/i.test(platit(l))) continue;
    const nr = (l.match(/[\d.]+,\d{2}|\d+,\d{2}|\d[\d.]*/g) || []).map(parseAmount).filter(v => v > 0);
    if (nr.length >= 3) return { faraTva: nr[0], tva: nr[1], cuTva: nr[2] };
    if (nr.length === 1) return { faraTva: nr[0], tva: 0, cuTva: 0 };
  }
  return { faraTva: 0, tva: 0, cuTva: 0 };
};

/**
 * Furnizorul, din coloana din dreapta a antetului.
 *
 * Pe randul "Beneficiar: SPITALUL ... MED4LIFE SUPPLIER S.R.L." partea de dupa
 * numele spitalului e furnizorul. Se recunoaste dupa forma juridica: acolo se
 * termina beneficiarul si incepe celalalt.
 */
const RE_FORMA = /\b(s\.?\s?r\.?\s?l\.?|s\.?a\.?|p\.?f\.?a\.?|s\.?n\.?c\.?)\s*$/i;
/** Cuvintele care apartin beneficiarului: acolo se opreste numele furnizorului. */
const ALE_BENEFICIARULUI = new Set([
  'beneficiar', 'spitalul', 'spital', 'clinic', 'clinica', 'judetean', 'judeteana',
  'jud', 'jud.', 'de', 'urgenta', 'municipal', 'orasenesc', 'sanatoriul', 'centrul',
]);
const gasesteFurnizorul = (linii: string[]): string => {
  const randBeneficiar = linii.find(l => /beneficiar\s*:/i.test(platit(l)));
  if (randBeneficiar && RE_FORMA.test(randBeneficiar.trim())) {
    /*
     * Pe randul "Beneficiar: SPITALUL ... MED4LIFE SUPPLIER S.R.L." cele doua
     * coloane s-au lipit. Numele furnizorului se aduna de la coada spre inceput,
     * pana la primul cuvant care e limpede al spitalului — altfel un tipar lacom
     * ar lua si "SPITALUL CLINIC JUD. DE URGENTA" in numele firmei.
     */
    const cuvinte = randBeneficiar.trim().split(/\s+/);
    /*
     * Cel mult trei cuvinte in fata formei juridice: atat au numele de firme de
     * pe comenzi. Cand spitalul si furnizorul au un cuvant comun chiar la
     * imbinare, numele iese cu un cuvant in plus — se vede in ecran si se
     * corecteaza; mai bine asa decat sa fie taiat prea scurt si sa lipseasca.
     */
    const luate: string[] = [];
    for (let i = cuvinte.length - 1; i >= 0 && luate.length < 4; i--) {
      const c = cuvinte[i];
      if (ALE_BENEFICIARULUI.has(platit(c).replace(/[:.]+$/, ''))) break;
      luate.unshift(c);
    }
    const nume = luate.join(' ').trim();
    if (nume.length >= 4 && RE_FORMA.test(nume)) return nume;
  }
  for (const l of linii.slice(0, 12)) {
    const t = l.trim();
    if (RE_FORMA.test(t) && !/spital|beneficiar/i.test(platit(t))) return t;
  }
  return '';
};

export const extrageComanda = (text: string): CampuriComanda => {
  const linii = text.split('\n').map(l => l.trim()).filter(Boolean);
  const items = pozitiile(linii);
  const t = totalurile(linii);
  const zile = valoareaEtichetei(linii, /termen\s*de\s*plata\s*:/);

  return {
    number: valoareaEtichetei(linii, /nr\.?\s*comanda\s*:/).split(/\s/)[0] || '',
    date: dataComenzii(valoareaEtichetei(linii, /data\s*comenzii\s*:/)),
    supplier: gasesteFurnizorul(linii),
    // Al doilea cod fiscal de pe pagina e al furnizorului; primul e al nostru.
    supplierCui: (() => {
      const coduri = linii
        .filter(l => /cod\s*fiscal\s*:/i.test(platit(l)))
        .map(l => valoareaEtichetei([l], /cod\s*fiscal\s*:/))
        .filter(Boolean);
      return coduri.length > 1 ? coduri[0] : (coduri[0] || '');
    })(),
    referatNumber: valoareaEtichetei(linii, /num[aă]r\s*referat\s*:/),
    offerNumber: valoareaEtichetei(linii, /num[aă]r\s*ofert[aă]\s*:/),
    contractNumber: valoareaEtichetei(linii, /(?:comanda\s+)?contract\s*:/),
    frameworkContract: valoareaEtichetei(linii, /acord\s*cadru\s*:/),
    warehouse: valoareaEtichetei(linii, /gestiunea\s*:/),
    paymentDays: parseInt(zile.replace(/\D/g, ''), 10) || 0,
    items,
    totalFaraTva: t.faraTva,
    totalTva: t.tva,
    totalCuTva: t.cuTva,
    lines: linii,
  };
};

/** Citeste comanda din PDF, cu OCR cand pagina e o scanare. */
export const citesteComandaPdf = async (
  fisier: Blob,
  onProgress?: OcrProgress,
): Promise<CampuriComanda> => {
  const pdfjsLib = await import('pdfjs-dist');
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
    new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  const pdf = await (pdfjsLib as any).getDocument({ data: await fisier.arrayBuffer() }).promise;
  const pagini: string[] = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 4); p++) {
    const continut = await (await pdf.getPage(p)).getTextContent();
    pagini.push(pdfItemsToText(continut.items as any));
  }
  let text = pagini.join('\n');
  let prinOcr = false;
  if (!hasUsableText(text)) {
    text = await ocrPdf(pdf, onProgress, 3);
    prinOcr = true;
  }
  return { ...extrageComanda(text), prinOcr };
};
