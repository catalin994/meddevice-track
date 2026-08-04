/**
 * Completeaza un document Word pornind de la sablonul institutiei.
 *
 * Prima varianta desena documentul de la zero. Iesea corect, dar nu identic:
 * hartia spitalului are sigla in antet, subsol, stiluri si o tema proprie, si
 * nicio reconstructie nu le nimereste pe toate. Asa ca acum se porneste de la
 * fisierul lor si se schimba doar valorile — restul ramane bit cu bit ce era.
 *
 * Partea delicata e ca Word nu tine un paragraf ca pe un sir. "Emis de: Birou
 * Tehnic" poate fi taiat in trei bucati, fiindca cineva a sters o litera si a
 * rescris-o acum doi ani. O cautare simpla dupa text nu gaseste nimic. De
 * aceea inlocuirea se face pe paragraf: bucatile lui se lipesc, se schimba ce
 * trebuie, si textul se pune inapoi in prima bucata — care isi pastreaza
 * formatarea — iar celelalte raman goale.
 */

/** Desparte textul de semne cand se reconstruieste paragraful. Un caracter
 *  de control, fiindca nu poate aparea in textul unui document. */
const SEP = '\u0001';

/** Un semn de forma {{nume}} pus in sablon in locul unei valori. */
const RE_SEMN = /\{\{\s*([\w.]+)\s*\}\}/g;

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

/** Textele care contin randuri noi trebuie sa le pastreze in Word. */
const cuRanduri = (s: string) =>
  esc(s).split('\n').join('</w:t><w:br/><w:t xml:space="preserve">');

interface Bucata { start: number; end: number; text: string }

/** Bucatile de text (<w:t>) dintr-un paragraf, cu pozitiile lor. */
const bucatile = (paragraf: string): Bucata[] => {
  const out: Bucata[] = [];
  // <w:tab/> incepe la fel ca <w:t>; fara grupul optional de spatiu, tab-urile
  // ar fi luate drept text si documentul s-ar rupe.
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(paragraf))) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[1] });
  }
  return out;
};

const deEscapat = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
   .replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/**
 * Inlocuieste semnele dintr-un paragraf.
 *
 * Intoarce paragraful neatins cand nu are ce schimba, ca sa nu rescrie inutil
 * formatari care functionau.
 */
const completeazaParagraf = (paragraf: string, valori: Record<string, string>): string => {
  const b = bucatile(paragraf);
  if (b.length === 0) return paragraf;

  const intreg = deEscapat(b.map(x => x.text).join(''));
  RE_SEMN.lastIndex = 0;
  if (!RE_SEMN.test(intreg)) return paragraf;

  RE_SEMN.lastIndex = 0;
  const nou = intreg.replace(RE_SEMN, (_, nume) => `${SEP}${nume}${SEP}`);
  // Se reconstruieste in prima bucata; restul se golesc, ca sa nu ramana
  // fragmente din vechea valoare.
  const continut = nou.split(SEP).map((parte, i) =>
    i % 2 === 0 ? cuRanduri(parte) : cuRanduri(valori[parte] ?? '')).join('');

  let rezultat = '';
  let cursor = 0;
  b.forEach((buc, i) => {
    rezultat += paragraf.slice(cursor, buc.start);
    rezultat += i === 0
      ? `<w:t xml:space="preserve">${continut}</w:t>`
      : '<w:t xml:space="preserve"></w:t>';
    cursor = buc.end;
  });
  return rezultat + paragraf.slice(cursor);
};

const RE_PARAGRAF = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p(?:\s[^>]*)?\/>/g;
const RE_RAND = /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g;

const completeaza = (xml: string, valori: Record<string, string>): string =>
  xml.replace(RE_PARAGRAF, p => completeazaParagraf(p, valori));

/**
 * Multiplica randul de tabel care poarta semne de forma {{rand.ceva}}.
 *
 * Referatul are un rand pe fiecare aparat, iar sablonul are unul singur — cel
 * pe care il gaseste aici si il repeta odata pentru fiecare pozitie.
 */
const multiplicaRanduri = (xml: string, randuri: Record<string, string>[]): string =>
  xml.replace(RE_RAND, rand => {
    if (!/\{\{\s*rand\./.test(rand)) return rand;
    if (randuri.length === 0) return '';
    return randuri.map(v => {
      // {{rand.denumire}} se cauta ca {{denumire}} in valorile randului
      const cuPrefix: Record<string, string> = {};
      for (const [k, val] of Object.entries(v)) cuPrefix[`rand.${k}`] = val;
      return completeaza(rand, cuPrefix);
    }).join('');
  });

export interface DateSablon {
  /** Valori simple, puse in locul semnelor {{nume}}. */
  valori: Record<string, string>;
  /** Randuri de tabel, puse in locul randului cu semne {{rand.*}}. */
  randuri?: Record<string, string>[];
}

/**
 * Ia sablonul, pune valorile, intoarce documentul gata de descarcat.
 *
 * Tot ce nu poarta un semn ramane exact cum era — sigla, antetul, subsolul,
 * stilurile, chenarele, casutele de bifat.
 */
export const completeazaSablon = async (
  sablon: ArrayBuffer | Blob,
  date: DateSablon,
): Promise<Blob> => {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(sablon);

  const document = zip.file('word/document.xml');
  if (!document) throw new Error('Sablonul nu pare a fi un fisier Word valid.');

  let xml = await document.async('string');
  xml = multiplicaRanduri(xml, date.randuri || []);
  xml = completeaza(xml, date.valori);
  zip.file('word/document.xml', xml);

  // Antetul si subsolul pot purta si ele semne (numarul paginii, denumirea).
  for (const nume of Object.keys(zip.files)) {
    if (!/^word\/(header|footer)\d*\.xml$/.test(nume)) continue;
    const f = zip.file(nume);
    if (!f) continue;
    zip.file(nume, completeaza(await f.async('string'), date.valori));
  }

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
};

/** Semnele gasite intr-un sablon — ca sa se poata spune ce va fi completat. */
export const semneleDin = async (sablon: ArrayBuffer | Blob): Promise<string[]> => {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(sablon);
  const f = zip.file('word/document.xml');
  if (!f) return [];
  const xml = await f.async('string');
  const gasite = new Set<string>();
  for (const p of xml.match(RE_PARAGRAF) || []) {
    const intreg = deEscapat(bucatile(p).map(x => x.text).join(''));
    RE_SEMN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_SEMN.exec(intreg))) gasite.add(m[1]);
  }
  return Array.from(gasite).sort();
};
