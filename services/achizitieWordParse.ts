import { DocumentWord, Tabel } from './docxCitit';
import { ReferatItem } from '../types';

/**
 * Ce se poate citi dintr-un referat sau document de fundamentare scris in Word.
 *
 * Documentele astea sunt deja scrise, pe formularul spitalului, si pana acum
 * intrau in evidenta tastate a doua oara — antetul, obiectul, justificarea si
 * fiecare pozitie din tabel, cu cantitatea si pretul ei. Tot ce se cauta aici e
 * deja scris in ele, sub etichete care se repeta de la un act la altul: "Emis
 * de:", "Obiectul achiziţiei:", "Compartiment de specialitate:".
 *
 * Nu inlocuieste cititul documentului. Scuteste tastarea, si ce iese ramane de
 * verificat in formular — nimic nu se salveaza fara ca omul sa fi vazut.
 *
 * Etichetele se cauta fara diacritice si fara sa conteze majusculele: acelasi
 * formular circula si cu "achiziţiei", si cu "achizitiei", si cu "ACHIZIŢIEI",
 * dupa cine l-a scris si pe ce calculator.
 */

const DIACRITICE: Record<string, string> = {
  'ă':'a','â':'a','î':'i','ș':'s','ş':'s','ț':'t','ţ':'t',
  'Ă':'A','Â':'A','Î':'I','Ș':'S','Ş':'S','Ț':'T','Ţ':'T',
};
const simplu = (s: string) =>
  s.replace(/[ăâîșşțţĂÂÎȘŞȚŢ]/g, c => DIACRITICE[c] || c).toLowerCase();

/**
 * Numarul de inregistrare, fara data lipita de el.
 *
 * Pe hartie se scrie "Nr. 17835/31.07.2026": numarul, apoi data. Luat intreg,
 * ajungea in formular ca numar, desi data e citita oricum separat, si iesea
 * scrisa de doua ori. Se taie numai cand dupa bara chiar sta o data intreaga —
 * "4471/2026" e un numar cu anul in el, si ramane asa cum e.
 */
const faraData = (numar: string): string => {
  const i = numar.indexOf('/');
  if (i === -1) return numar;
  return /^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}$/.test(numar.slice(i + 1)) ? numar.slice(0, i) : numar;
};

/** Data romaneasca in forma ISO. "09.02.2024" → "2024-02-09". */
export const dataISO = (brut: string): string => {
  const m = brut.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/);
  if (!m) return '';
  const [, z, l, a] = m;
  const zi = z.padStart(2, '0'), luna = l.padStart(2, '0');
  if (+luna < 1 || +luna > 12 || +zi < 1 || +zi > 31) return '';
  return `${a}-${luna}-${zi}`;
};

/**
 * Un numar romanesc, in cifre.
 *
 * "3.226,67" are punctul la mii si virgula la zecimale. Scris insa de cineva
 * care lucreaza si cu foi englezesti, acelasi numar poate ajunge "3,226.67" —
 * si atunci semnele isi schimba rolul intre ele. Hotaraste ultimul semn din sir:
 * el e cel zecimal.
 */
export const numar = (brut: string): number => {
  const s = String(brut).replace(/[^\d.,-]/g, '').trim();
  if (!s) return 0;
  const up = s.lastIndexOf('.'), uv = s.lastIndexOf(',');
  let curat: string;
  if (up === -1 && uv === -1) curat = s;
  else if (uv > up) curat = s.replace(/\./g, '').replace(',', '.');
  else curat = s.replace(/,/g, '');
  const n = parseFloat(curat);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Ce sta dupa o eticheta, in paragraful care o contine.
 *
 * Se ia primul paragraf care incepe cu eticheta sau o contine, si se intoarce
 * restul lui. Etichetele din formular sunt urmate de doua puncte si de cateva
 * spatii; se accepta si fara doua puncte, fiindca nu toate le au.
 */
const dupaEticheta = (paragrafe: string[], etichete: string[]): string => {
  for (const p of paragrafe) {
    const sp = simplu(p);
    for (const e of etichete) {
      const se = simplu(e);
      const i = sp.indexOf(se);
      if (i === -1) continue;
      let rest = p.slice(i + e.length);
      rest = rest.replace(/^\s*[:.\-–—]\s*/, '').trim();
      // Numai prima linie: un paragraf poate continua cu alta idee dupa un
      // rand nou, iar aia nu mai e valoarea etichetei.
      rest = rest.split('\n')[0].trim();
      if (rest) return rest;
    }
  }
  return '';
};

/**
 * Valoarea unui camp scris sub titlul lui, nu langa el.
 *
 * Justificarea si descrierea pe larg stau in paragraful urmator, sub un titlu
 * care e o fraza intreaga: "c) Fundamentaţi / specificaţi pentru ce şi în ce
 * scop solicitaţi achiziţia". Luand ce urmeaza dupa cuvintele cautate, iesea
 * restul titlului — "/ specificaţi pentru ce şi în ce scop solicitaţi
 * achiziţia" — pus in formular ca si cum ar fi fost justificarea scrisa de om.
 *
 * Deosebirea o fac cele doua puncte: acolo unde valoarea sta pe acelasi rand,
 * formularul o desparte de eticheta prin ":". Unde nu sunt doua puncte, sau
 * unde dupa ele nu mai scrie nimic, valoarea e in paragraful de dedesubt.
 */
const paragrafulDeDupa = (paragrafe: string[], etichete: string[]): string => {
  for (let i = 0; i < paragrafe.length; i++) {
    const p = paragrafe[i];
    const sp = simplu(p);
    let potrivit = -1, lungime = 0;
    for (const e of etichete) {
      const k = sp.indexOf(simplu(e));
      if (k !== -1) { potrivit = k; lungime = e.length; break; }
    }
    if (potrivit === -1) continue;

    const rest = p.slice(potrivit + lungime);
    if (/^\s*:/.test(rest)) {
      const v = rest.replace(/^\s*:\s*/, '').split('\n')[0].trim();
      if (v) return v;
    }
    for (let k = i + 1; k < paragrafe.length; k++) {
      const t = paragrafe[k].trim();
      if (t) return t;
    }
  }
  return '';
};

/*
 * ── citirea din randuri de text, adica dintr-un PDF ──
 *
 * Dintr-un Word ies paragrafe intregi: eticheta si valoarea stau impreuna, si se
 * pot citi una langa alta. Dintr-un PDF ies randuri asa cum incap pe hartie, si
 * atunci nimic nu mai sta intreg. Pe documentul adevarat al spitalului:
 *
 *   titlul e taiat in doua, "... serie SN-4471-" si "0088" pe randul urmator;
 *   eticheta punctului 2 se rupe ea insasi — "2. Descrierea pe scurt a
 *     obiectului documentului de fundamentare/motivul" pe un rand, valoarea
 *     abia pe urmatoarele doua;
 *   descrierea de la punctul 3 tine trei randuri;
 *   capul tabelului de valori e spart pe sase randuri, cu cuvintele coloanelor
 *     amestecate intre ele.
 *
 * Deci randurile se lipesc intr-un bloc, si din blocul asta se taie eticheta de
 * la inceput — oricat de rupta ar fi fost scrisa. Blocul se opreste la primul
 * rand care incepe un alt punct al formularului.
 */

/** Randurile care incep alta sectiune, deci opresc valoarea dinaintea lor. */
const ALT_PUNCT = /^\s*(?:\d+\s*\.\s|Sec[țt]iunea\b|\[\s*\]|F\.\s*0?1\/|Ed\.\s|TOTAL\b|Articolul\s+bugetar|Pagina\s+\d|Num[ăa]r\s+unic|Nr\.\s*(?:unic|de\s+[îi]nregistrare)|Emis\s+de|Aprobat\s+de|Data\s*:)/i;

/**
 * Randurile de la un punct incolo, lipite intr-un sir.
 *
 * Un cuvant taiat de sfarsitul randului se lipeste la loc fara spatiu: hartia
 * scrie "SN-4471-" si "0088", iar aparatul are seria SN-4471-0088, nu "SN-4471- 0088".
 */
const blocDeLa = (linii: string[], i: number, maxim = 8): string => {
  let out = linii[i] || '';
  for (let k = i + 1; k < Math.min(linii.length, i + maxim); k++) {
    const l = (linii[k] || '').trim();
    if (!l || ALT_PUNCT.test(l)) break;
    out = /-$/.test(out.trim()) ? out.trim() + l : out.trim() + ' ' + l;
  }
  return out.replace(/\s+/g, ' ').trim();
};

/**
 * Valoarea dintr-un bloc, dupa ce i se taie eticheta.
 *
 * Se incearca etichetele de la cea mai lunga la cea mai scurta, si se taie cea
 * mai lunga care se potriveste: asa "Descrierea pe scurt a obiectului
 * documentului de fundamentare/motivul revizuirii" nu lasa in urma ei jumatate
 * de eticheta, cum se intampla cand se cauta doar "Descrierea pe scurt".
 *
 * Spatiile se string la unul singur inainte de potrivire, iar diacriticele se
 * scot fara sa schimbe lungimea sirului — asa taietura cade unde trebuie si in
 * textul cu diacritice.
 */
const faraEticheta = (bloc: string, etichete: string[]): string => {
  const b = bloc.replace(/\s+/g, ' ');
  const bs = simplu(b);
  let taie = -1;
  for (const e of [...etichete].sort((x, y) => y.length - x.length)) {
    const es = simplu(e.replace(/\s+/g, ' '));
    const k = bs.indexOf(es);
    // Eticheta trebuie sa fie la inceput, cel mult dupa un numar de punct.
    if (k !== -1 && k <= 6) { taie = k + es.length; break; }
  }
  if (taie === -1) return '';
  return b.slice(taie).replace(/^[\s:.\-–—\/]+/, '').trim();
};

/** Blocul de sub o eticheta, cand documentul e un sir de randuri. */
const dupaEtichetaInText = (linii: string[], etichete: string[]): string => {
  for (let i = 0; i < linii.length; i++) {
    if (!etichete.some(e => simplu(linii[i]).includes(simplu(e.split('/')[0].trim().slice(0, 24))))) continue;
    const v = faraEticheta(blocDeLa(linii, i), etichete);
    if (v) return v;
  }
  return '';
};

/** Cate coloane are randul cel mai lat — capul de tabel poate fi mai scurt. */
const latimea = (t: Tabel) => t.reduce((m, r) => Math.max(m, r.length), 0);

/**
 * Tabelul care seamana cel mai bine cu cel cerut.
 *
 * Se cauta dupa cuvintele din capul lui, nu dupa pozitie: un formular poate
 * avea inaintea tabelului de pozitii inca unul, de antet, iar "primul tabel"
 * ar fi atunci gresit.
 */
const tabelulCu = (tabele: Tabel[], cuvinte: string[]): Tabel | null => {
  let cel: Tabel | null = null, celScor = 0;
  for (const t of tabele) {
    const cap = simplu((t[0] || []).join(' '));
    const scor = cuvinte.filter(c => cap.includes(simplu(c))).length;
    if (scor > celScor) { celScor = scor; cel = t; }
  }
  return celScor >= 2 ? cel : null;
};

/* ────────────────────────────── referatul ────────────────────────────── */

export interface CampuriReferat {
  number: string;
  date: string;
  issuedBy: string;
  approvedBy: string;
  subject: string;
  justification: string;
  budgetArticle: string;
  offerProvider: string;
  offerNumbers: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  items: ReferatItem[];
  /** Ce s-a gasit, ca sa se poata spune omului cat s-a citit. */
  gasite: string[];
}

/**
 * Pozitiile din tabelul referatului.
 *
 * Tabelul are sapte coloane: nr, denumire, U.M., cantitate, pret unitar,
 * valoare, caracteristici. Se sare peste capul lui, peste randul de numerotare
 * a coloanelor ("0 1 2 3 4 5=3x4 6") si peste randul de total — niciunul nu e o
 * pozitie, dar toate trei au forma unui rand.
 */
const pozitiileReferatului = (t: Tabel): ReferatItem[] => {
  const out: ReferatItem[] = [];
  for (const r of t) {
    if (r.length < 4) continue;
    const [nr, denumire, um, cant, pret, , spec] = r;
    const s = simplu(`${nr} ${denumire}`);
    if (s.includes('nr. crt') || s.includes('denumire produs')) continue;
    if (simplu(denumire || '').startsWith('total')) continue;
    // Randul care numeroteaza coloanele: numai cifre si semne.
    if (/^[\d\s=x+.]*$/.test(r.join('')) ) continue;
    if (!denumire?.trim()) continue;
    const cantitate = numar(cant);
    out.push({
      id: crypto.randomUUID(),
      name: denumire.trim(),
      unit: (um || 'Buc').trim() || 'Buc',
      quantity: cantitate > 0 ? cantitate : 1,
      unitPrice: numar(pret),
      specs: (spec || '').trim() || undefined,
    });
  }
  return out;
};

export const citesteReferatDinWord = (doc: DocumentWord): CampuriReferat => {
  const P = doc.paragrafe;
  const gasite: string[] = [];
  const noteaza = (nume: string, v: unknown) => {
    if (v && (!Array.isArray(v) || v.length)) gasite.push(nume);
    return v as any;
  };

  const subject = noteaza('obiectul', dupaEticheta(P, ['Obiectul achiziţiei', 'Obiectul achizitiei', 'Obiectul achiziției'])) || '';
  const issuedBy = noteaza('emitentul', dupaEticheta(P, ['Emis de'])) || '';
  const approvedBy = noteaza('cine aproba', dupaEticheta(P, ['Aprobat de'])) || '';

  /*
   * Numarul si data.
   *
   * Formularul le are pe randuri diferite ("Data: 12.01.2025"), dar multe
   * referate scrise de mana le pun impreuna in antet: "Nr. 17835/31.07.2026".
   * Se incearca amandoua, cu numarul luat din prima forma pe care o gaseste.
   */
  const randData = dupaEticheta(P, ['Data']);
  let date = dataISO(randData);
  let number = '';
  for (const p of P.slice(0, 12)) {
    const m = p.match(/\bnr\.?\s*(?:de\s*(?:inregistrare|înregistrare)\s*)?[:\s]\s*([\w./-]+)/i);
    if (m) { number = faraData(m[1].replace(/[.,;]$/, '')); if (!date) date = dataISO(p); break; }
  }
  noteaza('numarul', number);
  noteaza('data', date);

  const justification = noteaza('justificarea', paragrafulDeDupa(P, [
    'c) Fundamentaţi', 'c) Fundamentati', 'in ce scop solicitaţi', 'in ce scop solicitati',
  ])) || '';

  const articol = dupaEticheta(P, ['Articolul bugetar aferent achiziţiei este', 'Articolul bugetar aferent achizitiei este', 'Articolul bugetar']);
  const budgetArticle = noteaza('articolul bugetar', articol) || '';

  // "conform ofertelor ataşate de firma X, cu numărul Y"
  let offerProvider = '', offerNumbers = '';
  for (const p of P) {
    const m = simplu(p).match(/de firma\s+(.+?)(?:,?\s*cu num[ae]rul\s+(.+))?$/);
    if (m) {
      const brut = p.slice(p.length - (m[0].length));
      const mm = brut.match(/de firma\s+(.+?)(?:,?\s*cu num[ăa]rul\s+(.+))?$/i);
      offerProvider = (mm?.[1] || m[1] || '').replace(/[.,;]$/, '').trim();
      offerNumbers = (mm?.[2] || m[2] || '').replace(/[.,;]$/, '').trim();
      break;
    }
  }
  noteaza('firma ofertanta', offerProvider);

  const contactName = dupaEticheta(P, ['Nume şi Prenume', 'Nume si Prenume', 'Nume şi prenume']);
  const contactRole = dupaEticheta(P, ['Funcţia', 'Functia']);
  const contactEmail = dupaEticheta(P, ['Email', 'E-mail']);
  const contactPhone = dupaEticheta(P, ['Telefon']);
  noteaza('persoana de contact', contactName);

  const tabelPozitii = tabelulCu(doc.tabele, ['nr. crt', 'denumire', 'u.m', 'cant', 'valoare']);
  const items = tabelPozitii ? pozitiileReferatului(tabelPozitii) : [];
  if (items.length) gasite.push(`${items.length} ${items.length === 1 ? 'pozitie' : 'pozitii'}`);

  return {
    number, date, issuedBy, approvedBy, subject, justification, budgetArticle,
    offerProvider, offerNumbers, contactName, contactRole, contactEmail, contactPhone,
    items, gasite,
  };
};

/* ───────────────────── documentul de fundamentare ───────────────────── */

export interface CampuriFundamentare {
  number: string;
  date: string;
  revision: number;
  revisionDate: string;
  compartment: string;
  subject: string;
  shortDescription: string;
  description: string;
  budgetArticle: string;
  ssiCode: string;
  program: string;
  element: string;
  parameters: string;
  previousValue: number;
  influence: number;
  amount: number;
  gasite: string[];
}

/**
 * Sumele dintr-un rand, asa cum le scrie formularul.
 *
 * "-12 480,50" are minus in fata si spatiu la mii — pe hartia spitalului asa
 * sunt scrise stornarile. Cautate cu un tipar care incepe la prima cifra, ieseau
 * doua numere din unul singur, 12 si 480,50, si tabelul nu se mai lega.
 *
 * Anii se sar: "18402/07.09.2026" dintr-o trimitere la alt document nu e o suma.
 */
const sumeleDin = (rand: string): number[] => {
  const fara = rand.replace(/\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}\b/g, ' ');
  const gasite = fara.match(/-?\d{1,3}(?:[  .]\d{3})*,\d{2}|-?\d+(?:,\d{1,2})?/g) || [];
  return gasite.map(numar);
};

/**
 * Randul de valori, cand documentul nu are tabele — adica dintr-un PDF.
 *
 * Dintr-un PDF nu ies celule, ies randuri de text: tot randul tabelului vine ca
 * un sir, "Contract subsecvent Program A SSI-2211 1x 3.226,67 12.000,00 3.226,67
 * 15.226,67". Coloanele nu se mai pot desparti dupa margini, dar ultimele trei
 * numere de pe rand sunt intotdeauna aceleasi trei: valoarea precedenta,
 * influenta si totalul actualizat — asa e facut formularul, iar ultima coloana e
 * suma primelor doua.
 *
 * Parametrii se recunosc dupa forma lor ("1x 3.226,67"). Ce sta inaintea lor e
 * elementul, programul si codul SSI, lipite; ultimele doua se desprind de la
 * coada, fiindca au forma lor — siruri lungi de cifre si litere mari, cum e
 * "0000000000" si "02F660601200109". Lipite, elementul iesea "Reparatie
 * defibrilator 0000000000 02F660601200109" si ar fi ajuns asa in formular.
 * Ce nu se recunoaste ramane gol, nu ghicit.
 */
const valoriDinText = (linii: string[]) => {
  const iCap = linii.findIndex(l => simplu(l).includes('element de fundamentare'));
  for (let k = iCap + 1; iCap !== -1 && k < Math.min(linii.length, iCap + 6); k++) {
    const l = linii[k].trim();
    if (!l) continue;
    if (/^[\d\s=+x]*$/.test(l)) continue;             // randul care numeroteaza coloanele
    if (simplu(l).startsWith('total')) continue;
    const numere = sumeleDin(l);
    if (numere.length < 3) continue;
    const [pv, inf, act] = numere.slice(-3);
    // Ultima coloana e suma primelor doua; daca nu se potriveste, randul citit
    // nu e cel de valori si nu se ia nimic din el.
    if (Math.abs(pv + inf - act) > 0.05) continue;
    const mp = l.match(/\d+\s*x\s*[\d.,]+/i);
    const inainte = (mp ? l.slice(0, mp.index) : '').replace(/\s{2,}/g, ' ').trim();

    // Codul SSI si programul se desprind de la coada, dupa forma lor.
    const bucati = inainte.split(/\s+/);
    let ssiCode = '', program = '';
    const eCod = (x: string) => x.length >= 8 && /\d/.test(x) && /^[0-9A-Za-z]+$/.test(x);
    if (bucati.length > 1 && eCod(bucati[bucati.length - 1])) ssiCode = bucati.pop()!;
    if (bucati.length > 1 && eCod(bucati[bucati.length - 1])) program = bucati.pop()!;

    return {
      element: bucati.join(' ').trim(),
      program, ssiCode,
      parameters: mp ? mp[0].trim() : '',
      previousValue: pv, influence: inf, amount: act,
    };
  }

  /*
   * Randul TOTAL, cand capul tabelului n-a putut fi gasit.
   *
   * Pe hartia adevarata capul se rupe pe sase randuri si cuvintele coloanelor se
   * amesteca intre ele — "Element de Progra Parametrii de revizie Influențe +/–
   * totală" — asa ca nu mai ramane nimic dupa care sa fie cautat. Randul TOTAL
   * insa incepe cu un cuvant care nu se rupe, iar dupa el vin exact cele trei
   * sume. Se aduna de pe el si de pe randurile urmatoare, fiindca si ele se rup:
   * "TOTAL X X X 0" pe un rand, "-12 480,50 -12 480,50" pe celalalt.
   *
   * De aici ies numai sumele. Elementul, programul si codul SSI stau in randul
   * de deasupra, taiat si el in bucati amestecate intre coloane, si n-au cum sa
   * fie despartite cu temei — raman de scris de mana, goale, nu ghicite.
   */
  const iTotal = linii.findIndex(l => /^\s*TOTAL\b/i.test(l));
  if (iTotal !== -1) {
    const sume: number[] = [];
    for (let k = iTotal; k < Math.min(linii.length, iTotal + 4) && sume.length < 3; k++) {
      sume.push(...sumeleDin(linii[k]));
    }
    if (sume.length >= 3) {
      const [pv, inf, act] = sume.slice(0, 3);
      if (Math.abs(pv + inf - act) <= 0.05) {
        return { element: '', program: '', ssiCode: '', parameters: '',
                 previousValue: pv, influence: inf, amount: act };
      }
    }
  }
  return null;
};

/** Etichetele intregi ale formularului, pentru taiat de la inceputul blocului. */
const ET_SCURT = [
  '2. Descrierea pe scurt a obiectului documentului de fundamentare/motivul revizuirii',
  '2. Descrierea pe scurt a obiectului documentului de fundamentare / motivul revizuirii',
  'Descrierea pe scurt a obiectului documentului de fundamentare/motivul revizuirii',
  'Descrierea pe scurt a obiectului documentului de fundamentare/motivul',
  'Descrierea pe scurt a obiectului documentului de fundamentare',
  'Descrierea pe scurt',
];
const ET_LARG = [
  '3. Descrierea pe larg a starii de fapt si de drept',
  '3. Descrierea pe larg a stării de fapt şi de drept',
  'Descrierea pe larg a starii de fapt si de drept',
  'Descrierea pe larg',
];
const ET_COMPARTIMENT = ['1. Compartiment de specialitate', 'Compartiment de specialitate'];

export const citesteFundamentareDinWord = (doc: DocumentWord): CampuriFundamentare => {
  const P = doc.paragrafe;
  /*
   * Fara tabele inseamna ca documentul a venit ca randuri, dintr-un PDF — si
   * acolo etichetele si valorile se rup unde se termina hartia, deci se citesc
   * pe blocuri. Dintr-un Word, paragrafele vin intregi si nu e nevoie.
   */
  const eText = doc.tabele.length === 0;
  const gasite: string[] = [];
  const noteaza = (nume: string, v: unknown) => {
    if (v && v !== 0) gasite.push(nume);
    return v as any;
  };

  /*
   * Titlul: paragraful de dupa "DOCUMENT DE FUNDAMENTARE".
   *
   * E scris sub titlul formularului, centrat si ingrosat, si nu are eticheta —
   * deci nu se poate cauta dupa un cuvant, doar dupa locul lui.
   */
  let subject = '';
  const iTitlu = P.findIndex(p => simplu(p).includes('document de fundamentare'));
  if (iTitlu >= 0) {
    for (let k = iTitlu + 1; k < P.length; k++) {
      const t = P[k].trim();
      if (!t) continue;
      if (simplu(t).startsWith('numar unic') || simplu(t).startsWith('sectiunea')) break;
      // Pe hartie titlul se rupe unde se termina randul: "... serie SN-4471-" si
      // "0088" dedesubt. Lipit la loc, iese seria intreaga.
      subject = eText ? blocDeLa(P, k) : t;
      break;
    }
  }
  noteaza('titlul', subject);

  // "Număr unic de înregistrare: 17835/31.07.2026   revizuirea 0 / data 31.07.2026"
  const randNr = P.find(p => simplu(p).includes('numar unic')) || '';
  const mNr = randNr.match(/(?:inregistrare|înregistrare)\s*:?\s*([\w.-]+)/i);
  const number = noteaza('numarul', faraData(mNr?.[1]?.replace(/[.,;]$/, '') || '')) || '';
  const date = noteaza('data', dataISO(randNr)) || '';
  const mRev = randNr.match(/revizuirea\s*:?\s*(\d+)/i);
  const revision = mRev ? parseInt(mRev[1], 10) : 0;
  // A doua data de pe rand e a reviziei; cand e una singura, e aceeasi.
  const dateleDinRand = randNr.match(/\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}\b/g) || [];
  const revisionDate = dateleDinRand[1] ? dataISO(dateleDinRand[1]) : date;

  const compartment = noteaza('compartimentul', eText
    ? dupaEtichetaInText(P, ET_COMPARTIMENT)
    : dupaEticheta(P, ET_COMPARTIMENT)) || '';
  const shortDescription = noteaza('descrierea pe scurt', eText
    ? dupaEtichetaInText(P, ET_SCURT)
    : dupaEticheta(P, ['motivul revizuirii', '2. Descrierea pe scurt'])) || '';
  const description = noteaza('descrierea pe larg', eText
    ? dupaEtichetaInText(P, ET_LARG)
    : paragrafulDeDupa(P, ['3. Descrierea pe larg', 'starii de fapt si de drept', 'stării de fapt şi de drept'])) || '';
  const budgetArticle = noteaza('articolul bugetar', dupaEticheta(P, [
    'Articolul bugetar aferent achiziţiei este', 'Articolul bugetar aferent achizitiei este', 'Articolul bugetar',
  ])) || '';

  /*
   * Tabelul de valori: element, program, cod SSI, parametri, precedenta,
   * influenta, actualizata. Se ia randul de date, sarind capul, randul care
   * numeroteaza coloanele si randul de TOTAL.
   */
  let element = '', program = '', ssiCode = '', parameters = '';
  let previousValue = 0, influence = 0, amount = 0;
  const tv = tabelulCu(doc.tabele, ['element de fundamentare', 'program', 'cod ssi', 'parametrii', 'influen']);
  if (tv) {
    for (const r of tv) {
      if (r.length < 7) continue;
      const s = simplu(r.join(' '));
      if (s.includes('element de fundamentare')) continue;
      if (simplu(r[0]).startsWith('total')) continue;
      if (/^[\d\s=+x]*$/.test(r.join(''))) continue;
      element = r[0].trim(); program = r[1].trim(); ssiCode = r[2].trim();
      parameters = r[3].trim();
      previousValue = numar(r[4]); influence = numar(r[5]); amount = numar(r[6]);
      break;
    }
    if (element || amount) gasite.push('tabelul de valori');
  }
  // Fara tabele — cazul unui PDF — valorile se scot din randul de text.
  if (!amount && !element) {
    const v = valoriDinText(doc.paragrafe);
    if (v) {
      element = element || v.element;
      program = program || v.program;
      ssiCode = ssiCode || v.ssiCode;
      parameters = parameters || v.parameters;
      previousValue = v.previousValue; influence = v.influence; amount = v.amount;
      gasite.push('valorile');
    }
  }

  return {
    number, date, revision, revisionDate, compartment, subject, shortDescription,
    description, budgetArticle, ssiCode, program, element, parameters,
    previousValue, influence, amount, gasite,
  };
};
