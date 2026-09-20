import { MedicalDevice, Referat, FoundationDoc, ReferatStatus } from '../types';

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
  return {
    referate: aleLui,
    fundamentari: fundamentari.filter(d => d.referatId && ids.has(d.referatId)).sort(dupaData),
  };
};

/** Cate aparate numeste fiecare referat — pentru socoteala de pe Panou. */
export interface SituatiaHartiilor {
  /** Aparatele cu referat si cu cel putin un document care il sustine. */
  cuAmandoua: MedicalDevice[];
  /** Aparatele cu referat, dar fara niciun document de fundamentare. */
  doarReferat: MedicalDevice[];
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

  const cuAmandoua: MedicalDevice[] = [];
  const doarReferat: MedicalDevice[] = [];
  let faraNimic = 0;
  for (const d of devices) {
    if (cuDocument.has(d.id)) cuAmandoua.push(d);
    else if (cuReferat.has(d.id)) doarReferat.push(d);
    else faraNimic++;
  }
  return { cuAmandoua, doarReferat, faraNimic };
};

/** Referatele pe care le-a mai vazut aparatul, in cuvinte, pentru o eticheta. */
export const stadiulReferatului = (r: Referat): 'gata' | 'in lucru' | 'oprit' =>
  r.status === ReferatStatus.CLOSED || r.status === ReferatStatus.APPROVED ? 'gata'
  : r.status === ReferatStatus.REJECTED ? 'oprit'
  : 'in lucru';
