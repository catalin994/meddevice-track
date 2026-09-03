import { MedicalDevice, MedicalTask } from '../types';

/**
 * Sectii scrise in mai multe feluri.
 *
 * Aceeasi sectie ajunge in aplicatie sub cateva nume: una tastata cu diacritice
 * si alta fara, una cu "Sectia" in fata, una venita dintr-un import cu numele
 * din registrul contabil. Pe ecran par doua sectii diferite — Panoul le numara
 * de doua ori, filtrul le arata separat, si aparatele unei sectii sunt
 * imprastiate intre ele.
 *
 * Aici se recunosc si se unesc. Regula e simpla si se poate verifica cu ochiul:
 * doua nume sunt aceeasi sectie daca, dupa ce se scot diacriticele, semnele si
 * cuvintele de umplutura, ramane acelasi text.
 */

/**
 * Cuvinte care nu deosebesc o sectie de alta.
 *
 * "Cabinet" nu e printre ele. Cabinetul de cardiologie din ambulatoriu si
 * sectia de cardiologie sunt doua locuri diferite, cu alte aparate si cu alt om
 * care raspunde de ele; unite, aparatele unuia ar aparea la celalalt. Cuvantul
 * ramane in cheie, dar scris la fel de fiecare data.
 *
 * "Laborator" e insa aici, si a fost mutat incoace din cheie: la laborator,
 * cuvantul nu numeste alt loc, ci acelasi. "Lab.Anatomie Patologica" si
 * "Anatomie Patologica" sunt un singur laborator scris in doua feluri — nu
 * exista o sectie de anatomie patologica pe langa laboratorul ei, cum exista un
 * cabinet de cardiologie pe langa sectia de cardiologie.
 */
const UMPLUTURA = new Set([
  'sectia', 'sectie', 'sec', 'compartimentul', 'compartiment', 'comp',
  'serviciul', 'serviciu', 'serv', 'unitatea', 'unitate', 'clinica', 'clinic',
  'laborator', 'laboratorul', 'laboratoare', 'lab',
  'de', 'si', 'a', 'al', 'ale', 'cu', 'din', 'pentru', 'la',
]);

/** Prescurtari care inseamna acelasi lucru cu forma intreaga. */
const SINONIME: Record<string, string> = {
  // Cabinetul ramane in cheie, dar scris la fel: "Cab. ORL", "CABINETUL ORL"
  // si "Cabinet O.R.L." sunt acelasi cabinet.
  cab: 'cabinet',
  cabinetul: 'cabinet',
  cabinete: 'cabinet',
  ati: 'anestezie terapie intensiva',
  ti: 'terapie intensiva',
  upu: 'unitate primiri urgente',
  cpu: 'camera primiri urgente',
  uts: 'unitate transfuzie sanguina',
  ctt: 'centru transfuzie',
  bo: 'bloc operator',
  blocop: 'bloc operator',
  orl: 'otorinolaringologie',
  bfk: 'balneofizioterapie',
  rmf: 'recuperare medicina fizica',
};

export const faraSemne = (s: string): string =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[șşŞȘ]/g, 's').replace(/[țţŢȚ]/g, 't')
    .replace(/[ăâĂÂ]/g, 'a').replace(/[îÎ]/g, 'i')
    .toLowerCase();

/**
 * Cheia dupa care doua scrieri ale aceleiasi sectii se intalnesc.
 *
 * "Secţia A.T.I." si "ATI" si "Anestezie si Terapie Intensiva" dau acelasi
 * lucru. Cuvintele se si sorteaza, fiindca "Bloc Operator Urologie" si
 * "Urologie - Bloc Operator" sunt aceeasi usa.
 */
export const cheieSectie = (nume: string): string => {
  const brut = faraSemne(nume)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    // "a t i" inapoi in "ati": o prescurtare scrisa cu puncte sau cu spatii
    // ajunge dupa curatare un sir de litere singure, si nu se mai recunoaste.
    .replace(/\b(?:[a-z] ){1,}[a-z]\b/g, m => m.replace(/ /g, ''));
  if (!brut) return '';
  const cuvinte = brut.split(/\s+/)
    .map(c => SINONIME[c] || c)
    .join(' ')
    .split(/\s+/)
    .filter(c => c && !UMPLUTURA.has(c));
  // Fara niciun cuvant ramas — "Sectia" singur — se tine forma bruta, ca sa nu
  // ajunga doua sectii fara nume sa fie socotite aceeasi.
  if (cuvinte.length === 0) return brut;
  return [...new Set(cuvinte)].sort().join(' ');
};

export interface GrupSectii {
  cheie: string;
  /** Fiecare fel in care e scrisa, cu cate aparate si tichete are. */
  feluri: { nume: string; aparate: number; tichete: number }[];
  /** Cum s-ar pastra, daca nu alege omul altfel: forma cea mai folosita. */
  propus: string;
  total: number;
}

/**
 * Grupurile de sectii care sunt de fapt aceeasi.
 *
 * Se intorc doar cele cu mai multe feluri de scriere — restul n-au ce cauta
 * intr-un ecran care propune uniri.
 */
export const sectiiDeUnit = (
  devices: MedicalDevice[],
  tasks: MedicalTask[] = [],
): GrupSectii[] => {
  const peNume = new Map<string, { aparate: number; tichete: number }>();
  const pune = (nume: string, fel: 'aparate' | 'tichete') => {
    const n = String(nume ?? '').trim();
    if (!n) return;
    const r = peNume.get(n) || { aparate: 0, tichete: 0 };
    r[fel]++;
    peNume.set(n, r);
  };
  devices.forEach(d => pune(d.department, 'aparate'));
  tasks.forEach(t => pune(t.department, 'tichete'));

  const grupuri = new Map<string, GrupSectii>();
  for (const [nume, n] of peNume) {
    const cheie = cheieSectie(nume);
    if (!cheie) continue;
    const g = grupuri.get(cheie) || { cheie, feluri: [], propus: nume, total: 0 };
    g.feluri.push({ nume, aparate: n.aparate, tichete: n.tichete });
    g.total += n.aparate + n.tichete;
    grupuri.set(cheie, g);
  }

  return [...grupuri.values()]
    .filter(g => g.feluri.length > 1)
    .map(g => {
      g.feluri.sort((a, b) => (b.aparate + b.tichete) - (a.aparate + a.tichete)
        || a.nume.localeCompare(b.nume, 'ro'));
      /*
       * Care scriere se propune spre pastrare.
       *
       * Intai cea nescurtata. "Lab.Anatomie Patologica" era propusa inaintea lui
       * "Anatomie Patologica" doar fiindca era tastata mai des — dar un nume
       * scurtat, cu punct si fara spatiu dupa el, e o graba de tastare, nu
       * numele sectiei. Abia apoi cea mai folosita, si la egalitate cea cu
       * diacritice, fiindca asa se scrie romaneste.
       *
       * Prescurtarile fara punct — "ATI", "UPU" — nu intra aici: alea chiar
       * sunt numele sub care se stie sectia in spital.
       */
      const scurtat = (n: string) => /\b[a-zA-ZăâîșțĂÂÎȘȚ]{1,4}\./.test(n);
      const intregi = g.feluri.filter(f => !scurtat(f.nume));
      const dintre = intregi.length ? intregi : g.feluri;
      const varf = dintre[0].aparate + dintre[0].tichete;
      const capi = dintre.filter(f => (f.aparate + f.tichete) === varf);
      g.propus = capi.find(f => /[ăâîșțĂÂÎȘȚşţŞŢ]/.test(f.nume))?.nume || capi[0].nume;
      return g;
    })
    .sort((a, b) => b.total - a.total);
};
