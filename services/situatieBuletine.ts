import { MedicalDevice, DeviceStatus } from '../types';
import { valabilitatea, termenulVerificarii } from './valabilitate';
import { ziuaCererii } from './termene';
import { scris } from './loctiitori';

/**
 * Situatia buletinelor de verificare, pe tot inventarul deodata.
 *
 * Un aparat cu buletinul expirat nu are voie sa fie folosit. Pana acum, ca sa
 * afli care sunt, trebuia deschis fiecare aparat in parte — adica nu aflai.
 * Panoul avea o cifra, "Metrologie Expirata", dar o cifra spune cate, nu care,
 * si de la ea tot pe fise ajungeai.
 *
 * Aici se intreaba o data tot inventarul si iese lista intreaga, sortata dupa
 * cat de urgent e fiecare: intai cele expirate, cel mai demult expirat primul,
 * apoi cele care urmeaza, cel mai apropiat primul, apoi aparatele supuse
 * controlului carora nu li s-a trecut niciun buletin — categoria tacuta, care
 * nu apare in nicio alarma fiindca n-are nicio data care sa ticaie.
 *
 * Termenul se ia de unde il ia si lista din Inventar: randul de pe fisa cand e
 * scris, altfel hartia in vigoare din dosar. Doua socoteli diferite ar face
 * Panoul sa spuna una si Inventarul alta despre acelasi aparat.
 */

export type StareBuletin =
  /** Termenul a trecut. Aparatul nu are voie sa fie folosit. */
  | 'expirat'
  /** Termenul vine, in pragul ales. */
  | 'expira'
  /** Supus controlului, dar fara niciun buletin trecut. */
  | 'lipsa'
  /** Mai e vreme. */
  | 'valabil';

export interface RandBuletin {
  device: MedicalDevice;
  stare: StareBuletin;
  /** Ziua pana la care tine buletinul. Gol la cele fara buletin. */
  pana: string;
  /** Cate zile mai sunt; negativ daca a trecut. Null la cele fara buletin. */
  zile: number | null;
  /** Termenul vine de pe o hartie din dosar, nu din randul de pe fisa. */
  dinHartie: boolean;
  hartia?: string;
  /** Ziua pana la care trebuie depusa cererea de verificare. */
  cerere: string;
  /** Cate zile pana la ea; negativ daca a trecut. */
  zileCerere: number | null;
  numar: string;
  laborator: string;
}

export interface SituatiaBuletinelor {
  /** Toate, sortate dupa urgenta. */
  randuri: RandBuletin[];
  expirate: RandBuletin[];
  expira: RandBuletin[];
  lipsa: RandBuletin[];
  valabile: RandBuletin[];
  /** Cate aparate sunt supuse controlului metrologic. */
  supuse: number;
  /** Cate au cererea de verificare intarziata, desi buletinul mai tine. */
  cereriIntarziate: number;
}

/** Cat de departe se uita inainte, implicit. Un trimestru se poate planifica. */
export const PRAG_IMPLICIT = 90;

const RANG: Record<StareBuletin, number> = { expirat: 0, expira: 1, lipsa: 2, valabil: 3 };

/**
 * Situatia intregului inventar.
 *
 * Aparatele casate nu intra: la unul scos din uz nu se mai verifica nimic, si
 * o lista umflata cu ele ar face pe cine se uita sa nu mai aiba incredere in
 * ea. La fel, intra numai aparatele insemnate ca supuse controlului
 * metrologic: restul n-au ce buletin sa aiba.
 */
export const situatiaBuletinelor = (
  devices: MedicalDevice[],
  pragZile = PRAG_IMPLICIT,
): SituatiaBuletinelor => {
  const randuri: RandBuletin[] = [];

  for (const d of devices) {
    if (d.status === DeviceStatus.RETIRED || !d.metrologyRequired) continue;

    const termen = termenulVerificarii(d);
    const v = termen ? valabilitatea(termen.pana) : null;

    if (!v) {
      randuri.push({
        device: d, stare: 'lipsa', pana: '', zile: null, dinHartie: false,
        cerere: '', zileCerere: null,
        numar: scris(d.metrologyCertificate), laborator: scris(d.metrologyLab),
      });
      continue;
    }

    const cerere = ziuaCererii(v.pana);
    const vc = cerere ? valabilitatea(cerere) : null;

    randuri.push({
      device: d,
      stare: v.zile < 0 ? 'expirat' : v.zile <= pragZile ? 'expira' : 'valabil',
      pana: v.pana,
      zile: v.zile,
      dinHartie: !!termen?.dinHartie,
      hartia: termen?.hartia,
      cerere,
      zileCerere: vc ? vc.zile : null,
      numar: scris(d.metrologyCertificate),
      laborator: scris(d.metrologyLab),
    });
  }

  /*
   * Ordinea e singurul lucru care face lista folositoare: ce arde intai, si
   * in fiecare grup cel mai apropiat de termen. La zile egale, dupa sectie si
   * denumire, ca sa iasa de fiecare data aceeasi lista — altfel, randurile ar
   * sari de la o randare la alta si nu s-ar mai putea citi de doua ori.
   */
  randuri.sort((a, b) =>
    RANG[a.stare] - RANG[b.stare]
    || (a.zile ?? 0) - (b.zile ?? 0)
    || (a.device.department || '').localeCompare(b.device.department || '', 'ro')
    || (a.device.name || '').localeCompare(b.device.name || '', 'ro'));

  const cu = (s: StareBuletin) => randuri.filter(r => r.stare === s);

  return {
    randuri,
    expirate: cu('expirat'),
    expira: cu('expira'),
    lipsa: cu('lipsa'),
    valabile: cu('valabil'),
    supuse: randuri.length,
    /* Cererea intarziata la un buletin care inca tine: termenul care se
       rateaza, fiindca aparatul arata inca verde. */
    cereriIntarziate: randuri.filter(r =>
      r.stare !== 'expirat' && r.zileCerere !== null && r.zileCerere < 0).length,
  };
};

/** "expirat de 23 zile", "in 14 zile", "azi" — scris o data, folosit peste tot. */
export const cateZile = (zile: number): string => {
  const n = Math.abs(zile);
  const cuvant = n === 1 ? 'o zi' : n % 100 > 19 || n % 100 === 0 ? `${n} de zile` : `${n} zile`;
  if (zile < 0) return `expirat de ${cuvant}`;
  if (zile === 0) return 'expira azi';
  return `in ${cuvant}`;
};
