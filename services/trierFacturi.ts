import { MedicalDevice, DeviceFile } from '../types';

/**
 * Care facturi dintr-un folder sunt ale serviciului tehnic, si care au deja
 * raportul de service langa ele.
 *
 * Munca reala nu e incarcarea in ConectX — aia dureaza un minut. Munca e sa
 * deschizi treizeci de PDF-uri ca sa afli care sunt ale tale, si apoi sa cauti
 * pentru fiecare raportul de service, ca fara el nu se poate urca. Amandoua se
 * pot face din ce stie deja aplicatia.
 */

/**
 * Cuvintele dupa care se recunoaste o factura a serviciului tehnic.
 *
 * Fara diacritice si fara terminatii: "reparat" prinde si "reparatie", si
 * "reparatii", si "reparata". Lista se poate schimba din aplicatie — fiecare
 * spital lucreaza cu alti termeni, iar o lista pe care n-o poti corecta devine
 * repede o lista in care nu ai incredere.
 */
export const CUVINTE_IMPLICITE = [
  'reparat', 'reparati', 'mentenant', 'intretiner', 'revizi', 'service',
  'piese de schimb', 'piesa de schimb', 'consumabil', 'acumulator', 'senzor',
  'verificare metrolog', 'metrolog', 'etalonar', 'calibrar', 'abonament',
  'interventi', 'defectiun', 'inlocuir', 'aparatura medical', 'echipament medical',
];

const CHEIE = 'meditrack_cuvinte_facturi';

export const iaCuvintele = (): string[] => {
  try {
    const brut = localStorage.getItem(CHEIE);
    if (!brut) return [...CUVINTE_IMPLICITE];
    const lista = JSON.parse(brut);
    return Array.isArray(lista) && lista.length ? lista.map(String) : [...CUVINTE_IMPLICITE];
  } catch {
    return [...CUVINTE_IMPLICITE];
  }
};

export const punCuvintele = (cuvinte: string[]) => {
  try { localStorage.setItem(CHEIE, JSON.stringify(cuvinte)); } catch { /* ramane pe implicite */ }
};

/** Fara diacritice si cu litere mici, ca sa se potriveasca oricum ar fi scris. */
export const fara = (s: string): string =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[șşȘŞ]/g, 's').replace(/[țţȚŢ]/g, 't').toLowerCase();

export interface Triere {
  /** Recunoscuta ca a serviciului tehnic. */
  aMea: boolean;
  /** Aparatul din inventar apare in factura, dar niciun cuvant nu s-a potrivit. */
  poate: boolean;
  /** De ce — scris, ca sa se vada daca regula a gresit. */
  motive: string[];
}

/**
 * Decide daca factura e a serviciului tehnic.
 *
 * Hotaraste denumirea: asa lucreaza omul cand se uita peste folder. Seria unui
 * aparat din inventar nu bifeaza singura factura, dar o scoate in evidenta —
 * o factura care pomeneste un aparat de-al vostru e mai probabil a voastra
 * decat una care nu pomeneste niciunul, si ar fi pacat sa treaca neobservata.
 */
export const triaza = (
  denumire: string,
  deviceIds: string[],
  devices: MedicalDevice[],
  cuvinte = iaCuvintele(),
): Triere => {
  const t = fara(denumire);
  const gasite = cuvinte.map(c => fara(c)).filter(c => c && t.includes(c));
  const motive: string[] = [];
  if (gasite.length) motive.push(...gasite.slice(0, 3));

  const aparate = deviceIds
    .map(id => devices.find(d => d.id === id))
    .filter(Boolean) as MedicalDevice[];
  if (aparate.length) {
    motive.push(`${aparate[0].name}${aparate[0].serialNumber ? ` (${aparate[0].serialNumber})` : ''}`);
  }

  return { aMea: gasite.length > 0, poate: gasite.length === 0 && aparate.length > 0, motive };
};

export interface RaportGasit {
  fisier: DeviceFile;
  device: MedicalDevice;
  /** Cate zile intre raport si factura. Cu cat mai putine, cu atat mai sigur. */
  distanta: number;
}

/**
 * Raportul de service potrivit unei facturi.
 *
 * Se cauta printre fisierele de tip Service ale aparatelor pomenite in factura,
 * si se ia cel mai apropiat ca data. Un aparat reparat de trei ori intr-un an
 * are trei rapoarte, iar cel care conteaza e cel de langa factura.
 *
 * Nu se ghiceste peste sase luni: mai bine "fara raport" decat un raport
 * gresit atasat la o factura.
 */
export const gasesteRaport = (
  deviceIds: string[],
  devices: MedicalDevice[],
  dataFacturii: string,
  zileMax = 180,
): RaportGasit | null => {
  const referinta = Date.parse(`${dataFacturii}T00:00:00`);
  let cel: RaportGasit | null = null;

  for (const id of deviceIds) {
    const device = devices.find(d => d.id === id);
    if (!device) continue;
    for (const fisier of device.files || []) {
      if (fisier.type !== 'service') continue;
      const cand = Date.parse(fisier.dateAdded);
      const distanta = Number.isNaN(cand) || Number.isNaN(referinta)
        ? Number.MAX_SAFE_INTEGER
        : Math.round(Math.abs(cand - referinta) / 86400000);
      if (distanta > zileMax) continue;
      if (!cel || distanta < cel.distanta) cel = { fisier, device, distanta };
    }
  }
  return cel;
};
