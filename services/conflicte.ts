import { supabase } from './supabase';

/**
 * Doi oameni pe acelasi rand.
 *
 * Sincronizarea merge pe regula "cine salveaza ultimul are dreptate", pe rand
 * intreg. Daca un coleg muta aparatul la alta sectie cat tu ii corectezi seria,
 * cel care apasa al doilea suprascrie tot — inclusiv ce n-a atins. Nimeni nu
 * vede nimic, iar cel pagubit crede ca a uitat el sa salveze.
 *
 * Aici se afla, inainte de scriere, daca randul din cloud s-a schimbat de cand
 * a fost incarcat ultima data. Cand s-a schimbat, se spune exact ce difera si
 * se lasa omul sa aleaga. Cand nu, nu se intampla nimic si nu se intreaba nimic.
 *
 * Ce nu face: nu impaca modificarile intre ele. Doua persoane care scriu in
 * acelasi minut pe acelasi aparat raman doua variante, si una se alege — dar
 * se alege stiind, nu pe tacute.
 */

export interface Diferenta {
  camp: string;
  eticheta: string;
  alMeu: string;
  alLui: string;
}

/** Cum se cheama campurile pe romaneste, cand sunt aratate intr-o comparatie. */
export const ETICHETE: Record<string, string> = {
  name: 'Denumire',
  serialNumber: 'Serie',
  model: 'Model',
  manufacturer: 'Producator',
  department: 'Sectie',
  status: 'Stare',
  category: 'Categorie',
  smisCode: 'Cod SMIS',
  purchaseDate: 'Data achizitiei',
  warrantyExpiration: 'Expira garantia',
  commissioningDate: 'Pus in functiune',
  notes: 'Observatii',
  location: 'Locatie',
  invoiceNumber: 'Numarul facturii',
  supplier: 'Furnizor',
  amount: 'Valoare',
  issueDate: 'Data emiterii',
  dueDate: 'Scadenta',
  contractNumber: 'Contract',
  orderNumber: 'Comanda',
  description: 'Descriere',
  number: 'Numar',
  date: 'Data',
  subject: 'Obiect',
  justification: 'Justificare',
  budgetArticle: 'Articol bugetar',
  type: 'Tip',
  title: 'Titlu',
  priority: 'Prioritate',
  isCNCAN: 'Sub autorizatie CNCAN',
  cncanExpiry: 'Expira autorizatia CNCAN',
  metrologyRequired: 'Cere verificare metrologica',
  metrologyExpiry: 'Expira verificarea metrologica',
  metrologyDate: 'Data verificarii metrologice',
  metrologyLab: 'Laborator metrologie',
  metrologyCertificate: 'Certificat metrologie',
  lastMaintenance: 'Ultima mentenanta',
  nextMaintenance: 'Urmatoarea mentenanta',
  responsible: 'Responsabil',
  inventoryNumber: 'Numar de inventar',
  currency: 'Moneda',
};

/** Campuri care se schimba singure sau n-au ce cauta intr-o comparatie. */
const DE_SARIT = new Set(['updated_at', 'id', 'files', 'maintenanceHistory', 'items',
  'components', 'contracts', 'attachments', 'potriviri', 'lines', 'deviceIds']);

const caText = (v: any): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'da' : 'nu';
  if (typeof v === 'object') return Array.isArray(v) ? `${v.length} elemente` : '(detalii)';
  return String(v);
};

const gol = (v: any) => v === null || v === undefined || v === '';

/**
 * Aceeasi valoare, scrisa altfel.
 *
 * Un aparat citit din cloud n-are campurile pe care aplicatia le adauga cand il
 * normalizeaza, asa ca "false" statea langa "lipseste" si se numara ca
 * diferenta. Fereastra ajungea sa arate randuri de zgomot langa singura
 * schimbare adevarata, si tocmai ea se pierdea printre ele.
 */
const laFel = (a: any, b: any): boolean => {
  if (gol(a) && gol(b)) return true;
  if (typeof a === 'boolean' || typeof b === 'boolean') return !!a === !!b;
  return caText(a) === caText(b);
};

/**
 * Ce difera intre varianta mea si cea din cloud.
 *
 * Doar campurile simple: listele (documente, istoric, pozitii) se compara prost
 * si s-ar citi si mai prost intr-un tabel de doua coloane. Cand difera si ele,
 * se vede oricum din campurile din jur ca e vorba de alta versiune.
 */
export const campuriDiferite = (alMeu: any, alLui: any): Diferenta[] => {
  if (!alMeu || !alLui) return [];
  const chei = new Set([...Object.keys(alMeu), ...Object.keys(alLui)]);
  const out: Diferenta[] = [];
  for (const camp of chei) {
    if (DE_SARIT.has(camp)) continue;
    const a = alMeu[camp];
    const b = alLui[camp];
    if (a && typeof a === 'object') continue;
    if (b && typeof b === 'object') continue;
    if (laFel(a, b)) continue;
    out.push({ camp, eticheta: ETICHETE[camp] || camp, alMeu: caText(a), alLui: caText(b) });
  }
  return out.sort((x, y) => x.eticheta.localeCompare(y.eticheta, 'ro'));
};

/**
 * Randul din cloud, daca e mai nou decat cel de la care am plecat.
 *
 * Intoarce null cand nu e conflict — inclusiv cand cloud-ul nu raspunde. O
 * retea proasta nu trebuie sa opreasca salvarea: mai rau decat o suprascriere
 * e o aplicatie care nu mai salveaza nimic in sectie.
 */
export const randMaiNou = async <T extends { id: string; updated_at?: string }>(
  tabel: string,
  id: string,
  updatedAtLocal?: string,
): Promise<T | null> => {
  if (!supabase || !id) return null;
  // Fara reper local nu se poate spune ca s-a schimbat ceva de cand l-am luat.
  if (!updatedAtLocal) return null;
  try {
    const { data, error } = await supabase.from(tabel).select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    const tCloud = data.updated_at ? new Date(data.updated_at).getTime() : 0;
    const tLocal = new Date(updatedAtLocal).getTime();
    if (!Number.isFinite(tCloud) || !Number.isFinite(tLocal)) return null;
    // O secunda toleranta: ceasurile a doua telefoane nu bat la milisecunda.
    return tCloud > tLocal + 1000 ? (data as T) : null;
  } catch {
    return null;
  }
};
