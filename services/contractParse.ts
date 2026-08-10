import { pdfItemsToText, parseAmount, hasUsableText } from './invoiceParse';
import { ocrPdf, OcrProgress } from './invoiceOcr';

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
  /** Valoarea cu TVA, cand contractul o scrie si pe ea. */
  annualCostWithVat: number;
  /** Randurile citite, ca sa se poata vedea de ce a iesit gresit ceva. */
  lines: string[];
}

const DIACRITICE: Record<string, string> = {
  'ă':'a','â':'a','î':'i','ș':'s','ş':'s','ț':'t','ţ':'t',
  'Ă':'A','Â':'A','Î':'I','Ș':'S','Ş':'S','Ț':'T','Ţ':'T',
};
const faraDiacritice = (s: string) => s.replace(/[ăâîșşțţĂÂÎȘŞȚŢ]/g, c => DIACRITICE[c] || c).toLowerCase();

/** Data romaneasca in forma ISO. "09.02.2024" → "2024-02-09". */
export const dataISO = (brut: string): string => {
  // Intai cu an de patru cifre. Altfel "Nr. 17/12.01.2025" s-ar citi ca
  // 17 decembrie 2001, si contractul ar primi o perioada inventata.
  const m = brut.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/)
    || brut.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2})\b(?![.\/-]?\d)/);
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
  const m = faraDiacritice(t).match(/\b(\d{1,2})\s+(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)\s+(\d{4})\b/);
  return m ? `${m[3]}-${LUNI[m[2]]}-${m[1].padStart(2, '0')}` : '';
};

const oData = (t: string): string => dataISO(t) || dataInLitere(t);

/** Inceputul altui articol: acolo se opreste continutul celui de dinainte. */
const RE_ALT_ARTICOL =
  /^\s*(?:art(?:icol)?\.?\s*\d+|cap(?:itolul)?\.?\s*[IVX\d]|sectiunea\b|clauza\b)/i;
/**
 * "4. Obiectul si pretul contractului" — titlu de sectiune, deci sfarsitul
 * celei dinainte. "4.1 Servicii de reparare..." e continut, nu titlu, si nu
 * trebuie confundate. Litera singura la inceput e tot un numar: OCR-ul citeste
 * des "5." ca "S.".
 */
const RE_TITLU_NUMEROTAT = /^\s*(?:\d{1,2}|[A-Z])\.(?!\d)\s*[A-Za-z\u00c0-\u024f]/;
/** "DURATA", "VALOAREA CONTRACTULUI" — titlu scris cu majuscule, fara numar. */
const eTitluMajuscule = (l: string): boolean => {
  const t = l.trim();
  if (t.length < 4 || t.length > 60) return false;
  if (t.split(/\s+/).length > 5) return false;
  const litere = t.replace(/[^A-Za-z\u00c0-\u024f]/g, '');
  return litere.length >= 4 && litere === litere.toUpperCase();
};
const eTitluDeSectiune = (l: string) =>
  RE_ALT_ARTICOL.test(l) || RE_TITLU_NUMEROTAT.test(l) || eTitluMajuscule(l);

/**
 * Textul de dupa o eticheta.
 *
 * Cand eticheta e titlu singur pe rand — "Art. 2. DURATA CONTRACTULUI" —
 * continutul incepe abia pe randul urmator, si poate tine cateva randuri. Se
 * aduna pana la urmatorul articol, nu pana la primul rand cu litere: pe PDF-uri
 * fraza se rupe unde se termina latimea paginii, iar "incepand cu data de" si
 * data insasi ajung pe randuri diferite.
 */
const dupaEticheta = (linii: string[], re: RegExp, maxRanduri = 4): string => {
  for (let i = 0; i < linii.length; i++) {
    // Tiparele sunt scrise fara diacritice; textul citit le are.
    const m = faraDiacritice(linii[i]).match(re);
    if (!m) continue;
    let rest = linii[i].slice((m.index || 0) + m[0].length).trim();
    const eTitluSingur = rest.replace(/[^a-zA-Z]/g, '').length < 12;
    if (eTitluSingur) {
      for (let j = 1; j <= maxRanduri; j++) {
        const urm = (linii[i + j] || '').trim();
        if (!urm || eTitluDeSectiune(urm)) break;
        // "4.1" deschide continutul sectiunii; "4.1.1" de dupa el e deja alta
        // clauza, si n-are ce cauta lipita de obiect.
        if (rest && /^\s*\d{1,2}\.\d/.test(urm)) break;
        rest = `${rest} ${urm}`.trim();
      }
    }
    return rest.replace(/^[\s:.\-–—]+/, '').replace(/\s{2,}/g, ' ').trim();
  }
  return '';
};

const RE_NUMAR = /\bnr\.?\s*(?:contract(?:ului)?\s*)?[:.]?\s*([A-Za-z0-9][A-Za-z0-9\-\/._]{1,24})/i;
/** "Nr. 18582 din 07.08.2026" — forma din antetul contractelor de achizitie. */
const RE_NUMAR_CU_DATA = /\bnr\.?\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9\-\/._]{0,24}?)\s+din\s+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i;
/** Randul cu adresa institutiei are si el "nr." — al casei, nu al contractului. */
const RE_ADRESA = /\b(str\.|strada|calea|bd\.|bulevard|sos\.|soseaua|aleea|cod\s*postal|sector\s*\d|mun\.|jud\.)/i;

/**
 * Numarul contractului si data lui.
 *
 * Antetul institutiei are si el "nr." — al casei: "Str. Calea Exemplu, nr.
 * 25-27". De aceea randurile de adresa se sar, iar forma "Nr. 18582 din
 * 07.08.2026" are intaietate: acolo numarul vine cu data lui, deci nu poate fi
 * altceva.
 */
const gasesteNumarul = (linii: string[]): { numar: string; data: string } => {
  const candidate = linii.slice(0, 40).filter(l => !RE_ADRESA.test(faraDiacritice(l)));
  for (const l of candidate) {
    const m = faraDiacritice(l).match(RE_NUMAR_CU_DATA);
    if (m) return { numar: m[1].replace(/[.,;:]+$/, ''), data: dataISO(m[2]) };
  }
  for (const l of candidate) {
    const m = faraDiacritice(l).match(RE_NUMAR);
    if (m) return { numar: m[1].replace(/[.,;:]+$/, ''), data: '' };
  }
  return { numar: '', data: '' };
};

/** Titlul contractului: primul rand care incepe cu "CONTRACT". */
const gasesteTitlul = (linii: string[]): string => {
  for (const l of linii.slice(0, 25)) {
    const n = faraDiacritice(l).trim();
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
const RE_FORMA_JURIDICA = /\b(s\.?r\.?l\.?|s\.?a\.?|s\.?c\.?|p\.?f\.?a\.?|s\.?n\.?c\.?|i\.?i\.?)\b/i;
const RE_CUMPARATOR = /achizitor|autoritate[a]?\s*(?:\/entitate[a]?)?\s*contractant|beneficiar|cumparator|spital/i;

/**
 * Firma cu care s-a incheiat, cand partile nu poarta eticheta "prestator".
 *
 * In contractele de achizitie publica partile se prezinta pe rand: spitalul
 * "in calitate de achizitor", apoi "si", apoi firma — care nu spune despre ea
 * nimic in afara de forma juridica. Deci se cauta randul cu S.R.L. sau S.A.
 * care nu e al cumparatorului.
 */
const prestatorulDintreParti = (linii: string[]): string => {
  for (const l of linii.slice(0, 60)) {
    const n = faraDiacritice(l);
    if (!RE_FORMA_JURIDICA.test(n)) continue;
    if (RE_CUMPARATOR.test(n)) continue;
    if (RE_ADRESA.test(n) && !RE_FORMA_JURIDICA.test(n.split(',')[0])) continue;
    const inainte = l.split(/,|\s+cu sediul|\s+in calitate|\s+inregistrat/i)[0].trim();
    const curat = inainte
      .replace(/^(?:si|și|intre|între|incheiat\s+intre)\s+/i, '')
      .replace(/^[\s\-–—]+/, '')
      .trim();
    if (curat.length >= 4 && /[a-zA-Z]{3}/.test(curat)) return curat;
  }
  return '';
};

const gasestePrestatorul = (linii: string[]): string => {
  const RE_CALITATE = /(?:in\s+calitate\s+de\s+)?(prestator|furnizor|executant|vanzator|antreprenor)\b/i;
  for (const l of linii) {
    const n = faraDiacritice(l);
    if (!RE_CALITATE.test(n)) continue;
    if (/achizitor|beneficiar|cumparator|spital/.test(n.split(RE_CALITATE)[0] || '')) continue;
    // Numele firmei: pana la prima virgula, fara forma juridica din fata.
    const inainte = l.split(/,|\s+cu sediul|\s+in calitate/i)[0].trim();
    const curat = inainte
      .replace(/^(?:si|și|intre|între|de\s+o\s+parte|pe\s+de\s+alta\s+parte)\s+/i, '')
      .replace(/^(s\.?c\.?|sc)\s+/i, '')
      .replace(/^[\s\-–—,]+/, '')
      .trim();
    if (curat.length >= 3 && /[a-zA-Z]{3}/.test(curat)) return curat;
  }
  return prestatorulDintreParti(linii);
};

/** Perioada: doua date in aceeasi fraza, sau o durata in luni de la o data. */
const gasestePerioada = (
  linii: string[],
  text: string,
  dataContractului = '',
): { startDate: string; endDate: string } => {
  const zonaDurata =
    /*
     * Intai titlul de sectiune, ancorat la inceput de rand: "5. Durata
     * contractului". Fara ancora, se nimereste peste definitia din glosar —
     * "Durata de valabilitate a Contractului - intervalul de timp in care..."
     * — care vine mai devreme in document si n-are nicio data in ea.
     * Cifra poate fi citita gresit de OCR ("S." in loc de "5."), deci se
     * accepta si o litera singura.
     */
    dupaEticheta(linii, /^\s*(?:\d{1,2}|[A-Za-z])?[.)]?\s*durata\s+(?:prezentului\s+)?contract(?:ului)?\b/i, 6)
    || dupaEticheta(linii, /durata\s+contractului|perioada\s+contractului|termenul\s+contractului/i, 6)
    // "DURATA" scris singur pe rand, ca titlu de articol.
    || dupaEticheta(linii, /^\s*(?:art\.?\s*\d+\.?\s*)?(?:durata|perioada|valabilitate[a]?)\b\s*[:.]?\s*$/i, 4)
    || dupaEticheta(linii, /\bvalabil\b/i, 2)
    || text;

  /*
   * Potrivirea se face pe textul fara diacritice, dar taierea pe cel original:
   * in contract scrie "până la data de", iar tiparele sunt scrise fara semne.
   * faraDiacritice inlocuieste caracter cu caracter, deci pozitiile raman
   * aceleasi in amandoua.
   */
  const plat = faraDiacritice(zonaDurata);
  const dela = plat.match(/(?:incepand\s+(?:cu|de\s+la)|de\s+la|din\s+data\s+de)\s*[:]?\s*([^,;]{0,40}?)(?=\s*(?:pana|si|,|;|\.|$))/i);
  const panala = plat.match(/pana\s+la\s*(?:data\s+de)?\s*[:]?\s*([^,;]{0,40})/i);
  let startDate = dela ? oData(dela[1]) : '';
  let endDate = panala ? oData(panala[1]) : '';

  // Doua date una dupa alta, fara cuvinte intre ele.
  if (!startDate || !endDate) {
    const toate = (zonaDurata.match(/\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b/g) || []).map(dataISO).filter(Boolean);
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
      const unitate = faraDiacritice(luni[2]);
      if (unitate === 'luni') d.setMonth(d.getMonth() + n);
      else if (unitate === 'ani') d.setFullYear(d.getFullYear() + n);
      else d.setDate(d.getDate() + n);
      d.setDate(d.getDate() - 1);
      endDate = d.toISOString().split('T')[0];
    }
  }
  // "Durata prezentului contract este pana la data de 31.10.2026", si mai jos
  // "executarea incepe de la data semnarii": inceputul e ziua contractului.
  if (!startDate && dataContractului && (!endDate || dataContractului <= endDate)) {
    startDate = dataContractului;
  }
  if (startDate && endDate && endDate < startDate) endDate = '';
  if (startDate && startDate === endDate) startDate = dataContractului && dataContractului < endDate
    ? dataContractului : '';
  return { startDate, endDate };
};

/**
 * Valoarea contractului: cea fara TVA si cea cu TVA.
 *
 * Contractele le scriu pe amandoua, de obicei in aceeasi fraza — "este de
 * 15.390,00 Ron, respectiv 18.621,90 Ron cu TVA". Aplicatia lucreaza cu cea
 * fara TVA, dar pe hartie se cer amandoua, deci se citesc amandoua.
 */
const gasesteValoarea = (linii: string[]): { fara: number; cu: number } => {
  const candidati: { valoare: number; rang: number }[] = [];
  let cuTva = 0;
  for (let i = 0; i < linii.length; i++) {
    // Suma sta des pe randul urmator: "Pretul total fara T.V.A. convenit
    // pentru indeplinirea contractului, ... este de 15.390,00 Ron".
    const l = [linii[i], linii[i + 1] || '', linii[i + 2] || ''].join(' ');
    const n = faraDiacritice(l);
    if (!/valoare|pret(?:ul)?\s+total|cuantum/.test(faraDiacritice(linii[i]))) continue;
    // "9.600,00 lei fara TVA, respectiv 11.424,00 lei cu TVA": conteaza suma
    // lipita de "fara TVA", nu cea mai mare de pe rand — aia e cu TVA, si e
    // mai mare tocmai fiindca e cealalta.
    // Suma poate sta si inaintea, si dupa mentiunea "fara TVA":
    //   "38.720,04 lei fara TVA"  ·  "Pretul total fara T.V.A. este de 15.390,00 Ron"
    // "este de 15.390,00 Ron" — formularea obisnuita, si cea mai sigura: ce
    // urmeaza dupa ea e chiar suma, nu numarul unei clauze sau al unei oferte.
    const esteDe = n.match(/\beste\s+de\s+([\d][\d.,\s]*\d)/i);
    const langaFara = n.match(/([\d][\d.,\s]*\d)\s*(?:lei|ron)?\s*,?\s*fara\s*t\.?\s*v\.?\s*a\.?/i);
    const gasit = esteDe || langaFara;
    const numere = gasit
      ? [parseAmount(gasit[1])].filter(v => v > 0)
      : (l.match(/\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/g) || [])
          .map(parseAmount).filter(v => v > 0);
    if (numere.length === 0) continue;
    // "fara TVA" bate "cu TVA"; "estimata" e mai slaba decat "totala".
    const rang = (/fara\s*t\.?\s*v\.?\s*a/.test(n) ? 3 : 0) + (/total/.test(n) ? 2 : 0)
      + (/estimat/.test(n) ? -1 : 0) + (esteDe ? 2 : 0);
    candidati.push({ valoare: Math.max(...numere), rang });
    // "..., respectiv 18.621,90 Ron cu TVA" — suma dinaintea mentiunii.
    const mCu = n.match(/([\d][\d.,\s]*\d)\s*(?:lei|ron)?\s*,?\s*cu\s*t\.?\s*v\.?\s*a\.?/i);
    if (mCu) {
      const v = parseAmount(mCu[1]);
      if (v > cuTva) cuTva = v;
    }
  }
  candidati.sort((a, b) => b.rang - a.rang || b.valoare - a.valoare);
  const fara = candidati[0]?.valoare || 0;
  return { fara, cu: cuTva || 0 };
};

/** Citeste campurile dintr-un contract deja transformat in text. */
export const extrageContract = (text: string): CampuriContract => {
  const linii = text.split('\n').map(l => l.trim()).filter(Boolean);
  const primele = linii.slice(0, 30).join(' ');

  const obiect = (
    /*
     * Ancorat la inceput de rand, ca titlu de sectiune: "4. Obiectul si pretul
     * contractului". Fara ancora se nimereste peste glosar, unde "obiectul
     * Contractului" apare in definitii cu zeci de randuri mai devreme — si
     * atunci in formular ajunge o bucata de fraza fara niciun inteles.
     */
    /*
     * Tiparul cuprinde tot titlul — "Obiectul", "Obiectul contractului",
     * "Obiectul si pretul contractului" — si nimic peste el. Daca ar lua doar
     * primul cuvant, ar ramane "si pretul contractului" drept continut; daca ar
     * lua randul intreg, ar inghiti obiectul scris pe aceeasi linie.
     */
    dupaEticheta(linii, /^\s*(?:\d{1,2}|[A-Za-z])?[.)]?\s*obiectul(?:\s+si\s+pretul)?(?:\s+(?:prezentului\s+)?(?:contract|acord)(?:ului)?)?\s*[:.\-–—]?/i, 6)
    || dupaEticheta(linii, /obiectul\s+(?:si|și|şi)\s+pretul\s+contractului|obiectul\s+(?:prezentului\s+)?(?:contract|acord)(?:ului)?/i, 6)
    || dupaEticheta(linii, /obiectul\s*[:]/i, 4)
    // "avand ca obiect \"Servicii de reparare...\"" — cum se scrie in preambul.
    || (linii.join(' ').match(/avand\s+ca\s+obiect\s*[„"”']([^„"”']{5,300})/i)?.[1] || '')
    || (faraDiacritice(linii.join(' ')).match(/avand\s+ca\s+obiect\s*[„"”']([^„"”']{5,300})/i)
        ? linii.join(' ').slice(...(() => {
            const m = faraDiacritice(linii.join(' ')).match(/avand\s+ca\s+obiect\s*[„"”']([^„"”']{5,300})/i)!;
            const start = (m.index || 0) + m[0].length - m[1].length;
            return [start, start + m[1].length] as [number, number];
          })())
        : '')
  )
    .replace(/^\d{1,2}(?:\.\d{1,2})*\s*[-–—.]?\s*/, '')
    // "Obiectul contractului îl constituie prestarea..." — verbul de legatura
    // ramanea in fata, si obiectul incepea cu "il constituie".
    .replace(/^(?:[iî]l\s+constituie|const[aă]\s+[iî]n|este|reprezint[aă])\s+/i, '')
    .replace(/^[\s,;:.\-–—]+/, '')
    .trim();

  const valori = gasesteValoarea(linii);
  const { numar, data: dataContractului } = gasesteNumarul(linii);
  const { startDate, endDate } = gasestePerioada(linii, linii.join(' '), dataContractului);

  return {
    name: gasesteTitlul(linii),
    contractNumber: numar,
    provider: gasestePrestatorul(linii),
    coverageDetails: obiect.slice(0, 400),
    startDate,
    endDate,
    annualCost: valori.fara,
    annualCostWithVat: valori.cu,
    lines: linii,
  };
};

/**
 * Citeste contractul din PDF.
 *
 * Contractele semnate ajung aproape intotdeauna ca scanari: se tipareste, se
 * semneaza, se stampileaza, se pune in copiator. Un asemenea PDF are cate o
 * poza pe pagina si niciun caracter de text, deci citirea obisnuita intoarce
 * gol. Cand se intampla asta, paginile se randeaza si se trec prin OCR — mai
 * lent, dar e singura cale.
 */
export const citesteContractPdf = async (
  fisier: Blob,
  onProgress?: OcrProgress,
): Promise<CampuriContract & { prinOcr: boolean }> => {
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
  let text = pagini.join('\n');
  let prinOcr = false;
  if (!hasUsableText(text)) {
    // Primele pagini ajung: numarul, partile, obiectul si durata sunt la
    // inceput, iar OCR-ul costa cateva secunde pe pagina.
    text = await ocrPdf(pdf, onProgress, 4);
    prinOcr = true;
  }
  return { ...extrageContract(text), prinOcr };
};
