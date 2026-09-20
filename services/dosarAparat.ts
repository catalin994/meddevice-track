import { MedicalDevice, Referat, FoundationDoc, ReferatStatus, referatTotal } from '../types';

/**
 * Hartia unui aparat: referatele care l-au cerut si documentele care le sustin.
 *
 * Evidenta le tinea pe toate, dar nelegate intre ele pe ecran. Referatul stie
 * pentru ce aparate a fost scris — asta e in el, un camp cu aparatele vizate.
 * Documentul de fundamentare nu stie nimic despre aparate; el stie referatul pe
 * care il sustine. Drumul de la aparat la document trece deci prin referat, si
 * tocmai de asta nu se vedea nicaieri: de pe fisa aparatului nu se putea ajunge
 * la hartia lui fara sa fie cautata de mana in Financiar, numar cu numar.
 *
 * Aici se face drumul o data si se foloseste in amandoua locurile — in istoricul
 * aparatului si in situatia de pe Panou — ca sa nu ajunga doua ecrane sa
 * socoteasca acelasi lucru in doua feluri.
 */

export interface DosarulAparatului {
  /** Referatele care numesc aparatul, cel mai nou primul. */
  referate: Referat[];
  /** Documentele care sustin acele referate, cel mai nou primul. */
  fundamentari: FoundationDoc[];
}

const dupaData = <T extends { date?: string }>(a: T, b: T) =>
  (b.date || '').localeCompare(a.date || '');

/** Dosarul unui singur aparat. */
export const dosarulAparatului = (
  deviceId: string,
  referate: Referat[],
  fundamentari: FoundationDoc[],
): DosarulAparatului => {
  const aleLui = referate.filter(r => (r.deviceIds || []).includes(deviceId)).sort(dupaData);
  const ids = new Set(aleLui.map(r => r.id));
  /*
   * Un document ajunge in dosar pe doua cai: sustine un referat al aparatului,
   * sau il numeste de-a dreptul. A doua cale e pentru documentele care nu pornesc
   * de la niciun referat — alocarile lunare pe un contract subsecvent — si care
   * altfel n-ar avea cum sa fie legate de aparat.
   */
  return {
    referate: aleLui,
    fundamentari: fundamentari
      .filter(d => (d.referatId && ids.has(d.referatId)) || (d.deviceIds || []).includes(deviceId))
      .sort(dupaData),
  };
};

/** Cate aparate numeste fiecare referat — pentru socoteala de pe Panou. */
export interface SituatiaHartiilor {
  /** Aparatele cu referat si cu cel putin un document de fundamentare. */
  cuAmandoua: MedicalDevice[];
  /** Aparatele cu referat, dar fara niciun document. */
  doarReferat: MedicalDevice[];
  /** Aparatele cu document, dar fara referat — cele legate de-a dreptul. */
  doarDocument: MedicalDevice[];
  /** Cate aparate n-au nicio hartie. Numai numarul: sunt prea multe de aratat. */
  faraNimic: number;
}

/**
 * Situatia hartiilor pe tot inventarul.
 *
 * Se trece o data prin referate si o data prin documente, nu o data prin ele
 * pentru fiecare aparat: la doua mii de aparate si cateva sute de referate,
 * socoteala facuta pe dinauntru ar fi un milion de cautari la fiecare randare a
 * Panoului.
 */
export const situatiaHartiilor = (
  devices: MedicalDevice[],
  referate: Referat[],
  fundamentari: FoundationDoc[],
): SituatiaHartiilor => {
  /* Intai care referate au document, apoi care aparate au referat. */
  const referateCuDocument = new Set<string>();
  for (const d of fundamentari) if (d.referatId) referateCuDocument.add(d.referatId);

  const cuReferat = new Set<string>();
  const cuDocument = new Set<string>();
  for (const r of referate) {
    const areDoc = referateCuDocument.has(r.id);
    for (const id of r.deviceIds || []) {
      cuReferat.add(id);
      if (areDoc) cuDocument.add(id);
    }
  }
  // Si documentele legate de-a dreptul de un aparat, fara referat la mijloc.
  for (const d of fundamentari) for (const id of d.deviceIds || []) cuDocument.add(id);

  const cuAmandoua: MedicalDevice[] = [];
  const doarReferat: MedicalDevice[] = [];
  const doarDocument: MedicalDevice[] = [];
  let faraNimic = 0;
  for (const d of devices) {
    const r = cuReferat.has(d.id), doc = cuDocument.has(d.id);
    if (r && doc) cuAmandoua.push(d);
    else if (r) doarReferat.push(d);
    else if (doc) doarDocument.push(d);
    else faraNimic++;
  }
  return { cuAmandoua, doarReferat, doarDocument, faraNimic };
};

/** Referatele pe care le-a mai vazut aparatul, in cuvinte, pentru o eticheta. */
export const stadiulReferatului = (r: Referat): 'gata' | 'in lucru' | 'oprit' =>
  r.status === ReferatStatus.CLOSED || r.status === ReferatStatus.APPROVED ? 'gata'
  : r.status === ReferatStatus.REJECTED ? 'oprit'
  : 'in lucru';

/* ─────────────────────────── banii din hartii ─────────────────────────── */

/** Cati bani, pe ce moneda. */
export type PeMoneda = Map<string, number>;

const adauga = (m: PeMoneda, moneda: string, cat: number) => {
  if (!cat) return;
  m.set(moneda || 'RON', (m.get(moneda || 'RON') || 0) + cat);
};

export interface BaniiAparatului {
  /** Cat s-a estimat in referatele care il numesc. */
  estimat: PeMoneda;
  /** Cat s-a angajat prin documentele de fundamentare. */
  angajat: PeMoneda;
  cateReferate: number;
  cateDocumente: number;
}

/**
 * Cat costa aparatul dupa hartiile lui.
 *
 * Doua sume, nu una. Referatul spune cat s-a estimat ca va costa; documentul de
 * fundamentare spune cat s-a angajat de fapt. Sunt aceiasi bani vazuti de doua
 * ori, in doua momente ale aceleiasi achizitii, si adunati ar iesi de doua ori
 * cat trebuie. Asa ca se tin despartite, la fel cum facturile si contractele
 * stau pe randuri diferite in cartonasul de costuri.
 *
 * Cand o hartie priveste mai multe aparate, suma ei se imparte in parti egale
 * intre ele — aceeasi socoteala pe care o face de mult cartonasul pentru o
 * factura cu mai multe aparate pe ea. Nu e adevarul exact: un referat cu sapte
 * injectomate si o reparatie nu se imparte egal. Dar e o socoteala limpede, una
 * singura in toata aplicatia, si nu pretinde mai multa precizie decat are.
 *
 * Stornarile ies negative, si asa si trebuie: ele scad din ce s-a angajat.
 */
export const baniiAparatului = (
  deviceId: string,
  dosar: DosarulAparatului,
  referate: Referat[],
): BaniiAparatului => {
  const estimat: PeMoneda = new Map();
  const angajat: PeMoneda = new Map();

  for (const r of dosar.referate) {
    const cate = Math.max(1, (r.deviceIds || []).length);
    adauga(estimat, r.currency, referatTotal(r.items) / cate);
  }

  const referateDupaId = new Map(referate.map(r => [r.id, r]));
  for (const d of dosar.fundamentari) {
    /*
     * Peste cate aparate se imparte documentul: cele numite de el, cand le are,
     * altfel cele ale referatului pe care il sustine. Un document legat de-a
     * dreptul de un aparat nu se imparte cu aparatele referatului, fiindca nu
     * trece prin el.
     */
    const aleLui = d.deviceIds?.length
      ? d.deviceIds
      : (d.referatId ? referateDupaId.get(d.referatId)?.deviceIds : undefined) || [];
    const cate = Math.max(1, aleLui.length);
    adauga(angajat, d.currency || 'RON', (d.amount || 0) / cate);
  }

  return { estimat, angajat, cateReferate: dosar.referate.length, cateDocumente: dosar.fundamentari.length };
};
