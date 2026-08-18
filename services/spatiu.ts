import { supabase } from './supabase';
import { MedicalDevice, Invoice } from '../types';
import { iaSetareLocal, iaSetareDinCloud, punSetare } from './setari';

/**
 * Cat loc ocupa fisierele, si cat a mai ramas.
 *
 * Documentele scanate sunt partea care creste: un raport de service fotografiat
 * are un megaoctet, iar o sectie face cateva sute pe an. Pana acum nu se vedea
 * nicaieri cat s-a strans, deci limita se afla in ziua in care o incarcare
 * esueaza — de obicei cu un mesaj care nu spune de ce.
 *
 * Doua locuri, si sunt lucruri diferite:
 *
 *   in cloud — ce vad toti, si ce se plateste. Marimea exacta se ia dintr-o
 *   functie SQL, fiindca lista din API se cere folder cu folder si ar insemna
 *   sute de cereri pe un spital cu cateva mii de fisiere;
 *
 *   pe aparatul asta — copiile locale, care fac aplicatia sa mearga fara
 *   semnal. Aici browserul isi stie singur limita si o spune.
 */

/** Orice document care isi tine fisierul in stocare: aceleasi doua campuri. */
export interface CuFisier { filePath?: string; fileSize?: number }

export interface FelSpatiu {
  /** "devices", "invoices", "sabloane" — primul nivel din cale. */
  fel: string;
  fisiere: number;
  octeti: number;
}

export interface SpatiuCloud {
  fisiere: number;
  octeti: number;
  peFeluri: FelSpatiu[];
  /** Cand functia SQL lipseste, se spune, in loc sa se arate zero. */
  eroare?: string;
}

export interface SpatiuLocal {
  /** Cat ocupa aplicatia pe acest aparat, dupa socoteala browserului. */
  octeti: number;
  /** Cat ii da browserul cu totul. Zero cand nu vrea sa spuna. */
  limita: number;
}

/** Planul gratuit Supabase da un gigaoctet. Se poate schimba din ecran. */
export const LIMITA_IMPLICITA_GB = 1;

/**
 * Limita abonamentului.
 *
 * E acelasi cloud pentru toata lumea, deci si limita trebuie sa fie aceeasi.
 * Tinuta doar in localStorage, cum era, ramanea pe aparatul de la care fusese
 * scrisa: trecuta pe calculator, telefonul arata tot 1 GB, si bara de spatiu
 * spunea alta poveste in fiecare loc.
 *
 * Se citeste local, ca ecranul sa nu astepte reteaua, si se improspateaza din
 * cloud in fundal.
 */
export const iaLimitaGB = (): number => {
  const v = Number(iaSetareLocal<number | string>('limita_stocare_gb', LIMITA_IMPLICITA_GB));
  return Number.isFinite(v) && v > 0 ? v : LIMITA_IMPLICITA_GB;
};

/** Aceeasi valoare, dar cea din cloud daca se poate ajunge la ea. */
export const limitaDinCloud = async (): Promise<number> => {
  const v = Number(await iaSetareDinCloud<number>('limita_stocare_gb'));
  return Number.isFinite(v) && v > 0 ? v : iaLimitaGB();
};

export const punLimitaGB = async (gb: number): Promise<{ inCloud: boolean }> =>
  punSetare('limita_stocare_gb', gb);

/** "1,4 GB", "812 MB", "96 kB" — cifre pe care le citeste un om. */
export const marime = (octeti: number): string => {
  if (!Number.isFinite(octeti) || octeti <= 0) return '0 kB';
  const u = ['kB', 'MB', 'GB', 'TB'];
  let n = octeti / 1024, i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  // Fara separator de mii: "1.020 MB" se citeste in Romania ca o mie douazeci,
  // dar arata ca 1,02 pentru cine e obisnuit cu punctul zecimal. "1020 MB" nu
  // se poate citi gresit.
  return `${n.toLocaleString('ro-RO', { maximumFractionDigits: n < 10 ? 1 : 0, useGrouping: false })} ${u[i]}`;
};

/**
 * Marimea fisierelor din cloud.
 *
 * Se cere printr-o functie SQL care aduna direct din storage.objects. Fara ea
 * ar trebui parcurs bucket-ul folder cu folder — API-ul de listare nu intra in
 * subfoldere — adica o cerere pentru fiecare aparat si fiecare document.
 */
export const spatiulDinCloud = async (): Promise<SpatiuCloud> => {
  const gol: SpatiuCloud = { fisiere: 0, octeti: 0, peFeluri: [] };
  if (!supabase) return { ...gol, eroare: 'Cloud neconfigurat' };
  try {
    const { data, error } = await (supabase as any).rpc('spatiu_fisiere');
    if (error) {
      const lipseste = /does not exist|not find|404|PGRST202/i.test(error.message || '');
      return {
        ...gol,
        eroare: lipseste
          ? 'Ruleaza din nou scriptul "Conturi si acces" din Configurare — masurarea are nevoie de o functie noua.'
          : (error.message || 'Nu s-a putut citi marimea'),
      };
    }
    const randuri: FelSpatiu[] = (data || []).map((r: any) => ({
      fel: String(r.fel || 'altele'),
      fisiere: Number(r.fisiere) || 0,
      octeti: Number(r.octeti) || 0,
    }));
    return {
      fisiere: randuri.reduce((s, r) => s + r.fisiere, 0),
      octeti: randuri.reduce((s, r) => s + r.octeti, 0),
      peFeluri: randuri.sort((a, b) => b.octeti - a.octeti),
    };
  } catch (e: any) {
    return { ...gol, eroare: e?.message || 'Nu s-a putut citi marimea' };
  }
};

/** Cat ocupa aplicatia pe aparatul acesta, si cat ii mai da browserul. */
export const spatiulDeAici = async (): Promise<SpatiuLocal> => {
  try {
    const e = await navigator.storage?.estimate?.();
    return { octeti: e?.usage || 0, limita: e?.quota || 0 };
  } catch {
    return { octeti: 0, limita: 0 };
  }
};

/**
 * Cat ocupa documentele, socotit din evidenta aplicatiei.
 *
 * Nu are nevoie de nimic in baza de date: fiecare document urcat isi tine
 * marimea in randul aparatului. Cifra e la fel de buna ca evidenta — nu vede
 * fisiere ramase orfane in stocare, si nu poate socoti documentele urcate
 * inainte ca marimea sa fie retinuta. Cate sunt astea, se si spune.
 *
 * Masurarea exacta, din baza de date, ramane cea preferata cand e disponibila.
 */
export const spatiulDinEvidenta = (
  devices: MedicalDevice[] = [],
  invoices: Invoice[] = [],
  referate: CuFisier[] = [],
  fundamentare: CuFisier[] = [],
  comenzi: CuFisier[] = [],
): SpatiuCloud & { faraMarime: number } => {
  const peFeluri = new Map<string, FelSpatiu>();
  let faraMarime = 0;

  const pun = (fel: string, octeti?: number) => {
    const r = peFeluri.get(fel) || { fel, fisiere: 0, octeti: 0 };
    r.fisiere += 1;
    if (octeti && octeti > 0) r.octeti += octeti; else faraMarime += 1;
    peFeluri.set(fel, r);
  };

  for (const d of devices) {
    for (const f of d.files || []) {
      // Cele ramase in randul aparatului, ca text, nu ocupa loc in stocare —
      // ocupa in randul insusi, si se numara la migrare, nu aici.
      if (!f.path) continue;
      pun('devices', f.size);
    }
  }
  for (const inv of invoices) {
    if (!inv.filePath) continue;
    pun('invoices', inv.fileSize);
  }
  // Contractul e trecut in randul fiecarui aparat pe care il acopera, dar in
  // stocare e un singur fisier. Socotit o data, dupa cale.
  const contracte = new Set<string>();
  for (const d of devices) {
    for (const c of d.contracts || []) {
      if (!c.filePath || contracte.has(c.filePath)) continue;
      contracte.add(c.filePath);
      pun('contracts', c.fileSize);
    }
  }
  for (const [fel, lista] of [
    ['referate', referate], ['fundamentare', fundamentare], ['comenzi', comenzi],
  ] as [string, CuFisier[]][]) {
    for (const x of lista) {
      if (!x.filePath) continue;
      pun(fel, x.fileSize);
    }
  }

  const randuri = [...peFeluri.values()].sort((a, b) => b.octeti - a.octeti);
  return {
    fisiere: randuri.reduce((s, r) => s + r.fisiere, 0),
    octeti: randuri.reduce((s, r) => s + r.octeti, 0),
    peFeluri: randuri,
    faraMarime,
  };
};

/** Numele in romaneste ale primului nivel din cale. */
export const NUME_FEL: Record<string, string> = {
  devices: 'Documentele aparatelor',
  invoices: 'Facturi',
  contracts: 'Contracte',
  referate: 'Referate',
  fundamentare: 'Documente de fundamentare',
  comenzi: 'Comenzi',
  sabloane: 'Sabloane Word',
  tasks: 'Atasamente tichete',
  altele: 'Altele',
};
