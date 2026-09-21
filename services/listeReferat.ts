import { Referat } from '../types';

/**
 * Listele de ales ale referatului: cine il emite, cine il aproba, pe ce articol
 * bugetar, si cine il scrie.
 *
 * Toate patru erau campuri libere, cu un exemplu palid in ele. Dar biroul e
 * mereu acelasi, seful care aproba e mereu acelasi, articolele bugetare sunt o
 * mana de coduri care se repeta, iar persoana care face referatul e una sau
 * doua. Scrise de mana de fiecare data, ies de fiecare data putin altfel —
 * "Birou tehnic", "Biroul Tehnic", "birou tehnic" — si atunci cautarea dupa
 * emitent nu mai aduna nimic.
 *
 * Asa ca se aleg dintr-o lista. Lista nu e batuta in cuie in program: ea
 * creste din ce scrie omul. Ce se salveaza o data se ofera a doua oara, cu cel
 * mai proaspat in fata; ce nu-i mai trebuie se scoate. Si mai are un izvor:
 * referatele deja scrise. Articolele bugetare de pe ele sunt exact articolele
 * care-l privesc pe cel care tine evidenta — nu trebuie intrebat care sunt,
 * fiindca le-a scris deja.
 *
 * Totul sta pe dispozitiv, langa antetul retinut. Numele, telefonul si emailul
 * persoanei de contact sunt date despre un om; n-au ce cauta in sincronizare
 * sau in alta parte decat pe calculatorul celui care scrie referatul.
 */

export type CheieLista = 'emitent' | 'aprobat' | 'articol';

/** Cine scrie referatul: numele si ce se completeaza odata cu el. */
export interface PersoanaReferat {
  nume: string;
  functie?: string;
  email?: string;
  telefon?: string;
}

const CHEIE = 'meditrack_liste_referat';

interface Liste {
  puse: Partial<Record<CheieLista, string[]>>;
  /** Ce s-a scos din lista, ca sa nu se intoarca de la inceput. */
  uitate: Partial<Record<CheieLista, string[]>>;
  persoane: PersoanaReferat[];
  persoaneUitate: string[];
}

/*
 * Ce gaseste in lista cineva care deschide aplicatia intaia oara. Nu sunt
 * adevaruri, sunt un inceput: se schimba din formular, fara sa umble nimeni in
 * program.
 */
const INCEPUT: Record<CheieLista, string[]> = {
  emitent: ['Birou tehnic'],
  aprobat: ['Ing. Isopescu Liliana'],
  articol: [],
};

const PERSOANE_INCEPUT: PersoanaReferat[] = [
  { nume: 'Bunescu Catalin Liviu', functie: 'inginer' },
];

const gol = (): Liste => ({ puse: {}, uitate: {}, persoane: [], persoaneUitate: [] });

const citeste = (): Liste => {
  try {
    const l = JSON.parse(localStorage.getItem(CHEIE) || '{}');
    return {
      puse: l.puse || {}, uitate: l.uitate || {},
      persoane: Array.isArray(l.persoane) ? l.persoane : [],
      persoaneUitate: Array.isArray(l.persoaneUitate) ? l.persoaneUitate : [],
    };
  } catch { return gol(); }
};

const scrie = (l: Liste) => {
  try { localStorage.setItem(CHEIE, JSON.stringify(l)); } catch { /* lista e o comoditate */ }
};

const cheia = (s: string) => s.trim().toLowerCase();

/** Aceeasi valoare scrisa de doua ori se tine o data, cu prima scriere. */
const fara_repetitii = (valori: string[], scoase: string[] = []): string[] => {
  const scos = new Set(scoase.map(cheia));
  const vazut = new Set<string>();
  const iesite: string[] = [];
  for (const v of valori) {
    const c = cheia(v);
    if (!c || scos.has(c) || vazut.has(c)) continue;
    vazut.add(c);
    iesite.push(v.trim());
  }
  return iesite;
};

const dinReferate = (cheie: CheieLista, referate: Referat[]): string[] => {
  const camp = (r: Referat) =>
    cheie === 'emitent' ? r.issuedBy : cheie === 'aprobat' ? r.approvedBy : r.budgetArticle;
  /* Cele scrise des sunt cele care-l privesc; ele stau in fata celor scrise o data. */
  const cate = new Map<string, { text: string; n: number }>();
  for (const r of referate) {
    const v = (camp(r) || '').trim();
    if (!v) continue;
    const c = cheia(v);
    const are = cate.get(c);
    if (are) are.n++;
    else cate.set(c, { text: v, n: 1 });
  }
  return [...cate.values()].sort((a, b) => b.n - a.n).map(x => x.text);
};

/**
 * Ce se ofera la alegere: intai ce s-a salvat ultima oara, apoi ce se vede in
 * referatele scrise, apoi inceputul. Fara ce s-a scos anume din lista.
 */
export const optiunileCampului = (cheie: CheieLista, referate: Referat[] = []): string[] =>
  fara_repetitii(
    [...(citeste().puse[cheie] || []), ...dinReferate(cheie, referate), ...INCEPUT[cheie]],
    citeste().uitate[cheie],
  );

/** Cu ce se deschide un referat nou, cand nu e nimic retinut din antet. */
export const primaOptiune = (cheie: CheieLista): string => optiunileCampului(cheie)[0] || '';

/** Se retine ce s-a scris, in fata: data viitoare e primul oferit. */
export const tineMinte = (cheie: CheieLista, valoare: string) => {
  const v = (valoare || '').trim();
  if (!v) return;
  const l = citeste();
  l.puse[cheie] = fara_repetitii([v, ...(l.puse[cheie] || [])]).slice(0, 20);
  l.uitate[cheie] = (l.uitate[cheie] || []).filter(x => cheia(x) !== cheia(v));
  scrie(l);
};

/**
 * Se scoate din lista. Nu se pierde nimic: valoarea ramane pe referatele scrise
 * cu ea, iar daca e scrisa din nou si salvata, se intoarce in lista.
 */
export const uita = (cheie: CheieLista, valoare: string) => {
  const v = (valoare || '').trim();
  if (!v) return;
  const l = citeste();
  l.puse[cheie] = (l.puse[cheie] || []).filter(x => cheia(x) !== cheia(v));
  l.uitate[cheie] = fara_repetitii([v, ...(l.uitate[cheie] || [])]);
  scrie(l);
};

/* ── persoana care scrie referatul ── */

export const persoaneleReferatului = (): PersoanaReferat[] => {
  const l = citeste();
  const scos = new Set(l.persoaneUitate.map(cheia));
  const vazut = new Set<string>();
  const iesite: PersoanaReferat[] = [];
  for (const p of [...l.persoane, ...PERSOANE_INCEPUT]) {
    const c = cheia(p?.nume || '');
    if (!c || scos.has(c) || vazut.has(c)) continue;
    vazut.add(c);
    iesite.push(p);
  }
  return iesite;
};

/**
 * Se retine persoana intreaga, nu doar numele: functia, emailul si telefonul
 * merg impreuna cu ea pe hartie, si tot impreuna trebuie sa se completeze cand
 * e aleasa.
 */
export const tineMintePersoana = (p: PersoanaReferat) => {
  const nume = (p.nume || '').trim();
  if (!nume) return;
  const l = citeste();
  const restul = l.persoane.filter(x => cheia(x.nume || '') !== cheia(nume));
  l.persoane = [{ ...p, nume }, ...restul].slice(0, 10);
  l.persoaneUitate = l.persoaneUitate.filter(x => cheia(x) !== cheia(nume));
  scrie(l);
};

export const uitaPersoana = (nume: string) => {
  const n = (nume || '').trim();
  if (!n) return;
  const l = citeste();
  l.persoane = l.persoane.filter(x => cheia(x.nume || '') !== cheia(n));
  l.persoaneUitate = fara_repetitii([n, ...l.persoaneUitate]);
  scrie(l);
};
