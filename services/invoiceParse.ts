/**
 * Reading a Romanian invoice PDF.
 *
 * Two things were wrong with the old attempt, and the first one caused the
 * second. The page text was built as `items.map(i => i.str).join(' ')`, which
 * throws away every line break: an invoice is a table, and once the rows are
 * shuffled into one long string, "Total fara TVA" and its number end up next
 * to a number from a different row. Every pattern after that was guessing.
 *
 * So the text is rebuilt from the geometry pdf.js already gives us, and the
 * fields are then read line by line, anchored to the words a Romanian invoice
 * actually uses.
 */

export interface InvoiceFields {
  invoiceNumber: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  supplier: string;
  contractNumber: string;
  deviceIds: string[];
  /** The lines the parser actually saw, so a wrong reading can be diagnosed. */
  lines: string[];
}

/**
 * Whether the PDF carries real text at all.
 *
 * A scanned invoice — photographed, or printed and put through the copier —
 * is a picture of a page. pdf.js returns nothing or a handful of stray
 * characters for it, and every field then comes out empty with no explanation.
 * The caller uses this to decide whether to fall back to OCR.
 */
export const hasUsableText = (text: string): boolean => {
  const curat = text.replace(/\s+/g, ' ').trim();
  if (curat.length < 60) return false;
  // Cifre trebuie sa existe: o factura fara nicio cifra nu e o factura citita.
  const cifre = (curat.match(/\d/g) || []).length;
  return cifre >= 6;
};

/** Anything with a serial number and an id — the real MedicalDevice is wider. */
interface DeviceLike { id: string; serialNumber?: string }
interface ContractLike { contractNumber?: string; provider?: string }

/** A pdf.js text item: the string plus where it sits on the page. */
interface PdfItem { str: string; transform?: number[]; hasEOL?: boolean }

/**
 * Rebuilds one page's lines from the position of each text run.
 *
 * pdf.js hands back fragments in drawing order, not reading order, each with
 * its own transform. Grouping by the vertical position and then sorting by the
 * horizontal one restores the rows a human sees — which is what makes "the
 * number on the same line as this label" a meaningful question at all.
 *
 * One page at a time, deliberately: the coordinates restart on every page, so
 * feeding two pages at once merges row 12 of the first with row 12 of the
 * second. The caller joins the pages with newlines.
 */
export const pdfItemsToText = (items: PdfItem[]): string => {
  const cu = items.filter(i => i.str && i.str.trim() && i.transform);
  if (cu.length === 0) return items.map(i => i.str).join(' ');

  // Two runs belong to the same line when their baselines are within a couple
  // of points — subscripts and slightly shifted fragments included.
  const TOLERANTA = 3;
  const randuri: { y: number; parti: { x: number; s: string }[] }[] = [];
  for (const it of cu) {
    const x = it.transform![4];
    const y = it.transform![5];
    let rand = randuri.find(r => Math.abs(r.y - y) <= TOLERANTA);
    if (!rand) { rand = { y, parti: [] }; randuri.push(rand); }
    rand.parti.push({ x, s: it.str });
  }

  return randuri
    .sort((a, b) => b.y - a.y)            // pagina se citeste de sus in jos
    .map(r => r.parti.sort((a, b) => a.x - b.x).map(p => p.s).join(' ')
               .replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
};

/** Diacritics out, case down — a length-preserving map, so offsets still line up. */
const DIAC: Record<string, string> = {
  'ă':'a','â':'a','î':'i','ș':'s','ş':'s','ț':'t','ţ':'t','é':'e','ö':'o','ü':'u','ß':'s',
  'Ă':'A','Â':'A','Î':'I','Ș':'S','Ş':'S','Ț':'T','Ţ':'T','É':'E','Ö':'O','Ü':'U',
};
const norm = (s: string) => s.replace(/[ăâîșşțţéöüßĂÂÎȘŞȚŢÉÖÜ]/g, c => DIAC[c] || c).toLowerCase();

/**
 * Turns an invoice number into a number.
 *
 * Romanian invoices write 1.234,56, foreign ones 1,234.56, and plenty of
 * accounting systems emit 1 234,56 with a plain or non-breaking space. The
 * rule that settles all three: whichever separator comes last is the decimal
 * one, and everything else is grouping.
 */
export const parseAmount = (raw: string): number => {
  let s = raw.replace(/[\s  ]/g, '').replace(/[^\d.,-]/g, '');
  if (!s) return 0;

  const ultPunct = s.lastIndexOf('.');
  const ultVirg = s.lastIndexOf(',');

  if (ultPunct >= 0 && ultVirg >= 0) {
    const zecimal = ultPunct > ultVirg ? '.' : ',';
    const grupare = zecimal === '.' ? ',' : '.';
    s = s.split(grupare).join('').replace(zecimal, '.');
  } else if (ultPunct >= 0 || ultVirg >= 0) {
    const sep = ultPunct >= 0 ? '.' : ',';
    const bucati = s.split(sep);
    const ultima = bucati[bucati.length - 1];
    // ".500" cu exact trei cifre in coada, si o singura aparitie, e mie —
    // "1.190" pe o factura inseamna o mie o suta nouazeci, nu un leu si ceva.
    const eGrupare = ultima.length === 3 && (bucati.length > 2 || bucati[0].length <= 3);
    s = eGrupare ? bucati.join('') : bucati.slice(0, -1).join('') + '.' + ultima;
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

/** Every money-looking number on a line, in order. */
const numereDinLinie = (linie: string): { text: string; valoare: number; poz: number }[] => {
  const out: { text: string; valoare: number; poz: number }[] = [];
  // Spatiul e separator de mii doar cand desparte grupe de exact trei cifre.
  // Altfel "SN-1004 640,50" se citea ca un singur numar, 1.004.640,50.
  const re = /\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(linie))) {
    const text = m[0].trim();
    // Un numar de patru cifre nu se sare ca "an": pe "TOTAL DE PLATA: 5000 RON"
    // exact suma arata asa, si filtrul o inghitea.
    // O data nu e o suma. "Termen de plata: 20.02.2025" trecea drept 2002,20.
    if (laISO(text) || /^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}$/.test(text)) continue;
    out.push({ text, valoare: parseAmount(text), poz: m.index });
  }
  return out;
};

/**
 * Labels that carry the payable amount, strongest first.
 *
 * The order is the whole point. An invoice with an advance payment says both
 * "Total factura 3.570,00" and "Rest de plata 2.570,00"; the second is what
 * gets paid. Taking the first "total" on the page — which is what the old
 * pattern did — books the wrong figure into the ledger.
 */
const ETICHETE_SUMA: { re: RegExp; rang: number }[] = [
  { re: /rest\s+de\s+plata/i,                                    rang: 0 },
  { re: /(total|suma|valoare)\s+(de\s+)?plata|de\s+plata\s*[:( ]|total\s+plata|de\s+achitat|suma\s+datorata/i, rang: 1 },
  { re: /total\s+(general|factura|documentat?)|valoare\s+total[ae]|total\s+cu\s+tva|total\s+amount\s+due|amount\s+due|grand\s+total|total\s+to\s+pay|total\s+incl/i, rang: 2 },
  { re: /^\s*total\b|[^a-z]total\s*:/i,                          rang: 3 },
];

/** Lines that say "total" but mean a subtotal. */
const NU_E_TOTALUL = /fara\s+tva|far[aă]\s+tva|without\s+vat|net\s+amount|total\s+net|total\s+tva|tva\s*(19|9|5|21)?\s*%|^\s*tva\b|subtotal|avans/i;

const MONEDE = /\b(RON|LEI|EUR|USD|EURO)\b|€|\$/i;
const numeMoneda = (t: string) => {
  const m = t.match(MONEDE);
  if (!m) return '';
  const v = (m[0] || '').toUpperCase();
  if (v === '€' || v === 'EURO') return 'EUR';
  if (v === '$') return 'USD';
  if (v === 'LEI') return 'RON';
  return v;
};

/** dd.mm.yyyy, dd/mm/yy, yyyy-mm-dd — to ISO, or '' if it isn't a real date. */
const laISO = (t: string): string => {
  let z = 0, l = 0, a = 0;
  const dmy = t.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) { a = +iso[1]; l = +iso[2]; z = +iso[3]; }
  else if (dmy) { z = +dmy[1]; l = +dmy[2]; a = +dmy[3]; if (a < 100) a += a < 70 ? 2000 : 1900; }
  else return '';
  if (l < 1 || l > 12 || z < 1 || z > 31 || a < 1990 || a > 2100) return '';
  return `${a}-${String(l).padStart(2, '0')}-${String(z).padStart(2, '0')}`;
};

const RE_DATA = /\b(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})\b/g;

/** First valid date at or after `de la` in the line. */
const dataDinLinie = (linie: string, deLa = 0): string => {
  RE_DATA.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_DATA.exec(linie))) {
    if (m.index < deLa) continue;
    const iso = laISO(m[1]);
    if (iso) return iso;
  }
  return '';
};

const ETICHETE_EMITERE = /data\s+(emiterii|emitere|facturii|facturarii|document)|emisa\s+la\s+data(\s+de)?|data\s+si\s+ora|invoice\s+date|issue\s+date|\bdata\b|\bdin\b|\bdate\b/i;
/** Dates that are on the invoice but are not the date it was issued. */
const ALTE_DATE = /data\s+(livrarii|livrare|primirii|inregistrarii|scadent|expedierii|receptiei)|delivery\s+date/i;
const ETICHETE_SCADENTA = /data\s+scadent[ae]i?|scadent[ae]|termen\s+de\s+plata|termen\s+plata\s*:|termen\s*:|due\s+date|payment\s+due|platibil\s+pana|plata\s+pana\s+la/i;

/** The company-form suffixes that mark a line as an organisation's name. */
const FORMA_JURIDICA = /\b(s\.?r\.?l\.?|s\.?a\.?|p\.?f\.?a\.?|s\.?c\.?|gmbh|ag|ltd|limited|inc|b\.?v\.?|n\.?v\.?|plc|kft|spa|s\.?p\.?a\.?)\b/i;
/** Lines from the buyer's block, or headings — never the supplier. */
const NU_E_FURNIZOR = /cumparator|client|beneficiar|achizitor|delegat|factura|factură|invoice|proforma|chitanta|aviz|cui\s*:|cif\s*:|adresa|banca|iban|cont\s|tel|email|@/i;

const gasesteFurnizor = (linii: string[]): string => {
  // "Furnizor: X" spune direct cine e; taie unde incepe urmatorul camp.
  for (const linie of linii.slice(0, 25)) {
    const m = norm(linie).match(/furnizor\s*:?\s*/);
    if (!m || m.index === undefined) continue;
    let rest = linie.slice(m.index + m[0].length);
    rest = rest.split(/\s{2,}|\s+(?:cui|cif|c\.u\.i|reg|nr\.|j\d|adresa|tel|iban|banca|cont)\b/i)[0];
    rest = rest.replace(/\s+cumparator.*$/i, '').trim();
    if (rest.length >= 3) return rest.slice(0, 80);
  }
  // Altfel: antetul. Prima linie din capul paginii care arata a nume de firma
  // si nu e din blocul cumparatorului.
  for (const linie of linii.slice(0, 8)) {
    const t = linie.trim();
    if (t.length < 4 || t.length > 90) continue;
    if (NU_E_FURNIZOR.test(t)) continue;
    const cuvinte = t.split(/\s+/);
    const totMajuscule = /^[^a-zăâîșț]*$/.test(t) && cuvinte.length >= 2;
    if (FORMA_JURIDICA.test(t) || totMajuscule) {
      return t.split(/\s{2,}/)[0].slice(0, 80);
    }
  }
  return '';
};

const gasesteNumar = (linii: string[]): string => {
  const UMPLUTURA = '(?:fiscal[aă]|fiscala|proforma|storno|seria|serie|si|and|electronica|document|nr\\.?|no\\.?|num[aă]rul|num[aă]r|number|#|:|\\.)';
  const TIPARE: RegExp[] = [
    // "Seria MSF nr. 2024-0451" — numarul e ce urmeaza dupa "nr"
    new RegExp(`seri[ae]\\s+[A-Z0-9]{1,10}\\s*(?:nr\\.?|no\\.?|num[aă]rul)\\s*[:.]?\\s*([A-Za-z0-9][A-Za-z0-9\\-\\/._]{1,24})`, 'i'),
    // "Serie si numar: MSF 2024-0451" — forma din e-Factura
    new RegExp(`seri[ae]\\s+si\\s+num[aă]r\\s*[:.]?\\s*(?:[A-Z]{1,10}\\s+)?([A-Za-z0-9][A-Za-z0-9\\-\\/._]{1,24})`, 'i'),
    new RegExp(`(?:factur[aă]|invoice|proforma|chitan[țt][aă])\\s*(?:${UMPLUTURA}\\s*)*([A-Za-z0-9][A-Za-z0-9\\-\\/._]{1,24})`, 'i'),
    new RegExp(`(?:nr\\.?|no\\.?|num[aă]rul|num[aă]r|number)\\s*(?:${UMPLUTURA}\\s*)*([A-Za-z0-9][A-Za-z0-9\\-\\/._]{1,24})`, 'i'),
    /#\s*([A-Za-z0-9][A-Za-z0-9\-\/._]{1,24})/,
  ];
  // "Str. Aviatorilor nr. 12" si "Reg. Com. J40/1234/2015" contin si ele "nr".
  const CONTEXT_GRESIT = /\bstr\.?\b|strada|\bbd\.?\b|bulevard|calea|sos\.?|soseaua|reg\.?\s*com|\bj\d{1,2}\s*\/|cod\s+postal|sector\s*\d|cont\s+ib|iban/i;

  // Tiparele tari se incearca pe tot documentul inaintea celor slabe: altfel
  // adresa furnizorului, care vine prima pe pagina, castiga cu "nr. 12".
  for (const re of TIPARE) {
    for (const linie of linii.slice(0, 30)) {
      const n = norm(linie);
      const m = linie.match(re);
      if (!m || m.index === undefined) continue;
      // adresa contine "nr." doar cand tiparul slab e cel care a prins
      if (CONTEXT_GRESIT.test(n) && !/factur|invoice|proforma|seria/i.test(n)) continue;
      const candidat = m[1].replace(/[.,;:]+$/, '');
      // Un numar de factura contine cifre. Fara regula asta, tiparele intorc
      // fericite "FISCALA", "Invoice" sau "PROFORMA" — exact ce se intampla.
      if (!/\d/.test(candidat)) continue;
      // si nu e o data
      if (laISO(candidat)) continue;
      return candidat;
    }
  }
  return '';
};

const gasesteSuma = (linii: string[]): { amount: number; currency: string } => {
  let cel: { valoare: number; moneda: string; rang: number } | null = null;

  linii.forEach((linie, i) => {
    const n = norm(linie);
    for (const { re, rang } of ETICHETE_SUMA) {
      const m = n.match(re);
      if (!m || m.index === undefined) continue;
      // "Total fara TVA" poarta cuvantul "total" fara sa fie totalul. Testul se
      // face pe eticheta si pe ce urmeaza imediat dupa ea, nu pe tot randul:
      // facturile compacte scriu toate cele trei totaluri pe acelasi rand, si
      // atunci randul se descalifica singur.
      if (NU_E_TOTALUL.test(n.slice(m.index, m.index + m[0].length + 14))) continue;
      // "Termen de plata" e o data, nu o suma, si contine "de plata"
      if (ETICHETE_SCADENTA.test(n)) continue;

      // Totalurile stau aliniate la dreapta: ultimul numar de pe rand.
      let numere = numereDinLinie(linie).filter(x => x.poz > m.index!);
      let sursa = linie;
      // Uneori valoarea e pe randul urmator, sub eticheta.
      if (numere.length === 0 && linii[i + 1]) { numere = numereDinLinie(linii[i + 1]); sursa = linii[i + 1]; }
      if (numere.length === 0) continue;

      const val = numere[numere.length - 1].valoare;
      if (val <= 0) continue;
      const moneda = numeMoneda(sursa) || numeMoneda(linie);
      if (!cel || rang < cel.rang) cel = { valoare: val, moneda, rang };
      break;
    }
  });

  if (cel) return { amount: (cel as any).valoare, currency: (cel as any).moneda || '' };

  // Nimic etichetat: cea mai mare suma cu zecimale din document. Mai bine o
  // propunere pe care omul o corecteaza decat un camp gol.
  let max = 0, moneda = '';
  for (const linie of linii) {
    for (const x of numereDinLinie(linie)) {
      if (/[.,]\d{2}$/.test(x.text) && x.valoare > max) { max = x.valoare; moneda = numeMoneda(linie); }
    }
  }
  return { amount: max, currency: moneda };
};

const gasesteDate = (linii: string[]): { issueDate: string; dueDate: string } => {
  let issueDate = '', dueDate = '';

  for (const linie of linii) {
    const n = norm(linie);
    if (!dueDate) {
      const m = n.match(ETICHETE_SCADENTA);
      if (m && m.index !== undefined) dueDate = dataDinLinie(linie, m.index);
    }
    if (!issueDate) {
      const m = n.match(ETICHETE_EMITERE);
      // "Data scadentei" si "Data livrarii" contin amandoua "data": eticheta
      // exacta bate una generica pe acelasi rand.
      if (m && m.index !== undefined
          && !ETICHETE_SCADENTA.test(n.slice(0, m.index + 20))
          && !ALTE_DATE.test(n.slice(0, m.index + 20))) {
        issueDate = dataDinLinie(linie, m.index);
      }
    }
  }

  // Fara eticheta: prima data din document care nu e scadenta.
  if (!issueDate) {
    for (const linie of linii) {
      const d = dataDinLinie(linie);
      if (d && d !== dueDate) { issueDate = d; break; }
    }
  }
  // O scadenta inaintea emiterii inseamna ca am citit gresit una din ele.
  if (dueDate && issueDate && dueDate < issueDate) dueDate = '';
  return { issueDate, dueDate };
};

/**
 * Everything the form can pre-fill from the PDF. Nothing here is authoritative
 * — the user sees each value in an editable field before saving.
 */
export const extractInvoiceFields = (
  text: string,
  fileName: string,
  devices: DeviceLike[],
  contracts: ContractLike[],
): InvoiceFields => {
  const linii = text.split('\n').map(l => l.trim()).filter(Boolean);
  const intreg = norm(text);

  const deviceIds = devices
    .filter(d => d.serialNumber && d.serialNumber !== 'N/A' && d.serialNumber.length >= 3)
    .filter(d => intreg.includes(norm(d.serialNumber!.trim())))
    .map(d => d.id);

  const contract = contracts.find(c => c.contractNumber && intreg.includes(norm(c.contractNumber)));

  const { amount, currency } = gasesteSuma(linii);
  const { issueDate, dueDate } = gasesteDate(linii);

  const supplier = contract?.provider
    || gasesteFurnizor(linii)
    || fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();

  return {
    invoiceNumber: gasesteNumar(linii),
    amount,
    currency: currency || numeMoneda(text) || 'RON',
    issueDate,
    dueDate,
    supplier,
    contractNumber: contract?.contractNumber || '',
    deviceIds,
    lines: linii,
  };
};
