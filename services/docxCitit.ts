/**
 * Citirea unui document Word.
 *
 * Aplicatia stia sa scrie .docx, nu si sa citeasca. Iar referatele si
 * documentele de fundamentare sunt deja scrise — in Word, pe formularul
 * spitalului — si pana acum, ca sa ajunga in evidenta, trebuiau tastate a doua
 * oara, camp cu camp si pozitie cu pozitie.
 *
 * Un .docx e un ZIP cu XML inauntru; ce ne trebuie sta in word/document.xml.
 * Se scot din el doua lucruri:
 *
 *   - paragrafele, ca siruri de text. Word taie un paragraf in bucati (<w:t>)
 *     dupa cum s-a scris si s-a corectat de-a lungul anilor, asa ca "Emis de:
 *     Birou Tehnic" poate sta in trei bucati; se lipesc la loc, altfel nicio
 *     cautare dupa eticheta n-ar gasi nimic.
 *   - tabelele, ca randuri de celule. Fara ele, pozitiile referatului — care
 *     stau intr-un tabel cu sapte coloane — ar iesi un sir de cuvinte lipite,
 *     din care nu se mai poate spune care e cantitatea si care e pretul.
 *
 * Nu se citeste formatarea si nu se citesc pozele: aici se cauta ce scrie, nu
 * cum arata.
 */

/** Un tabel, ca randuri de celule. */
export type Tabel = string[][];

export interface DocumentWord {
  /** Paragrafele din afara tabelelor, in ordinea din document. */
  paragrafe: string[];
  tabele: Tabel[];
  /** Tot textul, paragraf pe rand — pentru cautari care nu tin de structura. */
  text: string;
}

const deEscapat = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
   .replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Textul unui paragraf, din bucatile lui lipite la loc. */
const textulParagrafului = (xml: string): string => {
  let out = '';
  const re = /<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[1] === undefined) out += m[0].startsWith('<w:tab') ? '\t' : '\n';
    else out += deEscapat(m[1]);
  }
  // Spatiile multiple si tab-urile devin unul singur: in formular etichetele
  // sunt despartite de valori prin cate patru-cinci spatii, si asta ar face
  // fiecare potrivire sa depinda de cate a apasat cineva pe bara.
  return out.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').trim();
};

/** Celulele unui rand de tabel. */
const celuleleRandului = (xml: string): string[] => {
  const out: string[] = [];
  const re = /<w:tc\b[\s\S]*?<\/w:tc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    // O celula poate avea mai multe paragrafe; se lipesc cu spatiu.
    const p: string[] = [];
    const rp = /<w:p\b[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g;
    let q: RegExpExecArray | null;
    while ((q = rp.exec(m[0]))) p.push(textulParagrafului(q[0]));
    out.push(p.filter(Boolean).join(' ').trim());
  }
  return out;
};

/**
 * Desface documentul in paragrafe si tabele.
 *
 * Se merge o singura data prin XML, in ordine, luand pe rand fie un tabel, fie
 * un paragraf — asa ordinea din document se pastreaza, si un paragraf dinaintea
 * unui tabel ramane inaintea lui. Tabelele imbricate sunt sarite: cel din afara
 * le cuprinde oricum, iar in formularele spitalului nu apar.
 */
export const desfaDocumentXml = (xml: string): DocumentWord => {
  const corp = xml.match(/<w:body\b[^>]*>([\s\S]*)<\/w:body>/)?.[1] ?? xml;
  const paragrafe: string[] = [];
  const tabele: Tabel[] = [];
  const toate: string[] = [];

  const re = /<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(corp))) {
    if (m[0].startsWith('<w:tbl')) {
      const randuri: Tabel = [];
      const rr = /<w:tr\b[\s\S]*?<\/w:tr>/g;
      let r: RegExpExecArray | null;
      while ((r = rr.exec(m[0]))) {
        const c = celuleleRandului(r[0]);
        if (c.length) { randuri.push(c); toate.push(c.join(' | ')); }
      }
      if (randuri.length) tabele.push(randuri);
    } else {
      const t = textulParagrafului(m[0]);
      if (t) { paragrafe.push(t); toate.push(t); }
    }
  }

  return { paragrafe, tabele, text: toate.join('\n') };
};

/** Adevarat pentru un fisier care arata a document Word. */
export const eFisierWord = (f: File): boolean =>
  f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  || /\.docx$/i.test(f.name);

/**
 * Citeste un .docx.
 *
 * Arunca pentru un .doc vechi: acela e alt format, binar, si n-are cum sa fie
 * citit aici. E mai bine sa se spuna limpede decat sa iasa un formular gol si
 * omul sa creada ca documentul lui n-are ce trebuie.
 */
export const citesteWord = async (file: File): Promise<DocumentWord> => {
  if (/\.doc$/i.test(file.name)) {
    throw new Error('Formatul .doc, cel vechi, nu poate fi citit. Salveaza documentul ca .docx din Word si incearca din nou.');
  }
  const JSZip = (await import('jszip')).default;
  let zip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error('Fisierul nu se poate deschide ca document Word.');
  }
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('Documentul nu are continut Word inauntru.');
  return desfaDocumentXml(await doc.async('string'));
};
