import { MedicalDevice, Contract } from '../types';

/**
 * Termenele care se apropie, toate la un loc.
 *
 * Aplicatia se uita pana acum la unul singur: data urmatoarei mentenante. Dar
 * un aparat are mai multe ceasuri care ticaie in acelasi timp, si fiecare are
 * alt fel de consecinta cand se opreste:
 *
 *   - buletinul metrologic expirat — aparatul nu mai are voie sa fie folosit,
 *     oricat de bine ar merge;
 *   - garantia expirata — o reparatie platita degeaba;
 *   - contractul de service expirat — se afla in ziua in care se strica ceva,
 *     si atunci interventia se face pe procedura de urgenta;
 *   - autorizatia CNCAN expirata — aparatul de radiologie sta.
 *
 * Toate se calculeaza la fel: o data in viitor, un numar de zile pana la ea.
 * Scris o data, ca sa nu fie patru locuri de reparat cand se schimba pragurile.
 */

export type FelTermen = 'cerere' | 'metrologie' | 'garantie' | 'contract' | 'cncan' | 'mentenanta';

export interface Termen {
  fel: FelTermen;
  /** Ce expira, pe scurt: "Buletin metrologic". */
  eticheta: string;
  /** Aparatul sau contractul la care se refera. */
  subiect: string;
  detaliu?: string;
  data: string;
  /** Negativ inseamna deja trecut. */
  zile: number;
  deviceId?: string;
}

export const ETICHETE: Record<FelTermen, string> = {
  cerere: 'Cerere verificare periodica',
  metrologie: 'Buletin metrologic',
  garantie: 'Garantie',
  contract: 'Contract de service',
  cncan: 'Autorizatie CNCAN',
  mentenanta: 'Mentenanta preventiva',
};

/**
 * Cat de devreme se anunta fiecare.
 *
 * Nu la fel: un buletin metrologic se programeaza la laborator cu saptamani
 * inainte, iar un contract de service care expira inseamna o procedura de
 * achizitie, deci trebuie stiut cu doua luni inainte, nu cu doua saptamani.
 */
export const PRAGURI: Record<FelTermen, number> = {
  /*
   * Cererea se depune din timp, deci se anunta din timp: cu doua luni inainte
   * de ziua in care trebuie sa fie la registratura. Mai devreme n-are rost —
   * dosarul nu e gata — mai tarziu nu mai ajuta la nimic.
   */
  cerere: 60,
  metrologie: 45,
  garantie: 30,
  contract: 60,
  cncan: 60,
  mentenanta: 30,
};

/**
 * Cu cate luni inainte de expirarea buletinului trebuie depusa cererea.
 *
 * Verificarea periodica nu se face in ziua in care expira buletinul: se cere
 * din timp, iar cererea are drumul ei — dosar, tarif, randul la verificare.
 * Pana acum aplicatia urmarea numai ziua expirarii si suna cu patruzeci si
 * cinci de zile inainte; cand se facea galben, ziua in care trebuia depusa
 * cererea trecuse de luni intregi.
 *
 * Se tine aici, un singur numar, fiindca e o regula care se schimba printr-un
 * ordin, nu prin cod.
 */
export const LUNI_INAINTE_DE_CERERE = 6;

/**
 * Ziua pana la care trebuie depusa cererea pentru un buletin care expira.
 *
 * Se scade o zi, ca sa fie "cu cel putin sase luni inainte", nu "fix in ziua
 * de la sase luni": un termen care se implineste exact in ziua limita e deja
 * depasit pentru cine il citeste a doua zi.
 */
export const ziuaCererii = (expirare: string, luni = LUNI_INAINTE_DE_CERERE): string => {
  if (!valida(expirare)) return '';
  const d = new Date(`${expirare}T00:00:00`);
  d.setMonth(d.getMonth() - luni);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

/**
 * Dovada ca aparatul chiar a fost verificat.
 *
 * Data urmatoarei mentenante vine de cele mai multe ori dintr-un import: o
 * coloana intr-un fisier Excel, pusa acolo cu ani in urma, fara ca cineva sa
 * fi umblat la aparat. Numarata ca termen, ea scotea "expirat de 865 de zile"
 * pe un aparat care poate merge perfect — si o mie de asemenea alarme rosii
 * intr-un inventar de o mie de aparate invata omul sa nu se mai uite la rosu.
 *
 * Termenul se numara deci doar cand exista hartia care spune ca aparatul a
 * trecut pe la cineva: un raport de service sau o fisa de interventie atasata
 * la aparat. Pana atunci data ramane la vedere pe fisa, dar ca informatie, nu
 * ca alarma.
 */
export const areDovadaVerificarii = (d: MedicalDevice): boolean =>
  (d.files || []).some(f => f.type === 'service' || f.type === 'report');

const zileP = (data: string, azi: Date): number =>
  Math.ceil((new Date(`${data}T00:00:00`).getTime() - azi.getTime()) / 86400000);

const valida = (d?: string): d is string => !!d && !Number.isNaN(Date.parse(d));

/**
 * Toate termenele, ordonate dupa cat de aproape sunt. Cele trecute vin primele.
 */
export const termeneleTuturor = (
  devices: MedicalDevice[],
  contracte: Contract[] = [],
  azi = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00'),
): Termen[] => {
  const out: Termen[] = [];

  for (const d of devices) {
    // Aparatele scoase din uz nu mai au termene de respectat.
    if (d.status === 'Retired') continue;
    const baza = { subiect: d.name, detaliu: [d.department, d.serialNumber].filter(Boolean).join(' · '), deviceId: d.id };

    if (d.metrologyRequired && valida(d.metrologyExpiry)) {
      out.push({ fel: 'metrologie', eticheta: ETICHETE.metrologie, ...baza,
        data: d.metrologyExpiry, zile: zileP(d.metrologyExpiry, azi) });
      /*
       * Si ziua in care trebuie depusa cererea — termenul care se rateaza, nu
       * cel care se vede. Se opreste cand buletinul a expirat deja: atunci nu
       * mai e o cerere intarziata, e un aparat care nu mai are voie sa fie
       * folosit, si asta scrie randul de deasupra.
       */
      const zi = ziuaCererii(d.metrologyExpiry);
      if (zi && zileP(d.metrologyExpiry, azi) >= 0) {
        out.push({ fel: 'cerere', eticheta: ETICHETE.cerere, ...baza,
          detaliu: [baza.detaliu, `buletinul expira ${d.metrologyExpiry}`].filter(Boolean).join(' · '),
          data: zi, zile: zileP(zi, azi) });
      }
    }
    if (valida(d.warrantyExpiration)) {
      out.push({ fel: 'garantie', eticheta: ETICHETE.garantie, ...baza,
        data: d.warrantyExpiration, zile: zileP(d.warrantyExpiration, azi) });
    }
    if (d.isCNCAN && valida(d.cncanExpiry)) {
      out.push({ fel: 'cncan', eticheta: ETICHETE.cncan, ...baza,
        data: d.cncanExpiry, zile: zileP(d.cncanExpiry, azi) });
    }
    // Numai cu documentul verificarii la dosar — altfel e o data mostenita
    // dintr-un import, nu un termen de respectat.
    if (valida(d.nextMaintenanceDate) && areDovadaVerificarii(d)) {
      out.push({ fel: 'mentenanta', eticheta: ETICHETE.mentenanta, ...baza,
        data: d.nextMaintenanceDate, zile: zileP(d.nextMaintenanceDate, azi) });
    }
  }

  for (const c of contracte) {
    if (!valida(c.endDate)) continue;
    out.push({
      fel: 'contract', eticheta: ETICHETE.contract,
      subiect: c.name || c.contractNumber || 'Contract',
      detaliu: [c.provider, c.contractNumber].filter(Boolean).join(' · '),
      data: c.endDate, zile: zileP(c.endDate, azi),
    });
  }

  return out.sort((a, b) => a.zile - b.zile);
};

/** Doar cele care cer atentie acum: trecute, sau inauntrul pragului lor. */
export const termeneDeUrmarit = (toate: Termen[]): Termen[] =>
  toate.filter(t => t.zile <= PRAGURI[t.fel]);

/** Aparatele care nu mai au voie sa fie folosite: buletinul metrologic expirat. */
export const metrologieExpirata = (devices: MedicalDevice[], azi = new Date()): MedicalDevice[] =>
  devices.filter(d => d.status !== 'Retired' && d.metrologyRequired
    && valida(d.metrologyExpiry) && zileP(d.metrologyExpiry, azi) < 0);

/** Aparatele supuse controlului metrologic carora nu li s-a trecut buletinul. */
export const metrologieNecunoscuta = (devices: MedicalDevice[]): MedicalDevice[] =>
  devices.filter(d => d.status !== 'Retired' && d.metrologyRequired && !valida(d.metrologyExpiry));

/**
 * Valabilitatea implicita a unui buletin: un an de la verificare.
 *
 * Se propune, nu se impune — sunt mijloace de masurare cu alt termen, si
 * laboratorul scrie pe buletin data exacta.
 */
export const valabilitatePropusa = (dataVerificarii: string, luni = 12): string => {
  if (!valida(dataVerificarii)) return '';
  const d = new Date(`${dataVerificarii}T00:00:00`);
  d.setMonth(d.getMonth() + luni);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

/**
 * Categoriile care, in practica, poarta buletin metrologic.
 *
 * Doar o propunere la adaugarea aparatului: lista oficiala a mijloacelor de
 * masurare supuse controlului metrologic legal e mai lunga si se schimba, iar
 * decizia ramane a serviciului tehnic.
 */
export const CATEGORII_CU_METROLOGIE = [
  'Defibrilator',
  'Infuzomat / Injectomat',
  'Aparat ventilatie mecanica',
  'Aparat anestezie',
  'Monitor functii vitale',
  'Electrocardiograf (ECG)',
];

/**
 * Aparatele cu o data de mentenanta pe care nimic n-o sustine.
 *
 * Nu e o alarma, e o lista de lucru: aparatele carora le lipseste raportul de
 * service. Cand raportul se incarca, data incepe sa se numere.
 */
export const mentenantaNeconfirmata = (devices: MedicalDevice[]): MedicalDevice[] =>
  devices.filter(d => d.status !== 'Retired' && valida(d.nextMaintenanceDate) && !areDovadaVerificarii(d));
