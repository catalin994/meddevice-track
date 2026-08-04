import { uploadFile, fetchFile, removeFile } from './fileStorage';
import { cacheBlob, getCachedBlob, deleteCachedBlob } from './storageService';

/**
 * Sablonul Word din care se genereaza documentele de achizitie.
 *
 * Documentul generat trebuie sa arate exact ca hartia spitalului — cu sigla,
 * antetul, subsolul si stilurile ei. Singura cale sigura pentru asta e sa se
 * porneasca de la fisierul lor, nu de la o reconstructie a lui.
 *
 * Sunt doua straturi. Aplicatia vine cu formularele institutiei deja puse, ca
 * primul referat sa iasa pe hartia corecta fara sa fi urcat cineva nimic. Peste
 * ele se poate pune un sablon propriu, cand formularul se schimba sau cand un
 * alt compartiment il vrea altfel; scos, se cade inapoi pe cel inclus.
 *
 * Calea celui propriu e fixa, nu retinuta local: altfel un sablon pus de pe
 * calculatorul din birou n-ar fi gasit de pe telefonul din sectie.
 */

export type FelSablon = 'referat' | 'fundamentare';

/** De unde vine sablonul folosit acum. */
export type SursaSablon = 'propriu' | 'inclus' | 'niciunul';

const CAI: Record<FelSablon, string> = {
  referat: 'sabloane/referat.docx',
  fundamentare: 'sabloane/fundamentare.docx',
};

/** Sablonul livrat cu aplicatia. E precachat, deci se deschide si fara semnal. */
const caleInclusa = (fel: FelSablon) => `${import.meta.env.BASE_URL}sabloane/${fel}.docx`;

export interface SablonPus { blob: Blob | null; sursa: SursaSablon }

/** O copie locala, ca sa nu se ceara de la cloud la fiecare document. */
const memorie = new Map<FelSablon, SablonPus>();

const iaInclus = async (fel: FelSablon): Promise<Blob | null> => {
  try {
    const r = await fetch(caleInclusa(fel));
    if (!r.ok) return null;
    const b = await r.blob();
    return b.size > 0 ? b : null;
  } catch {
    return null;
  }
};

export const punSablon = async (fel: FelSablon, fisier: Blob): Promise<boolean> => {
  memorie.set(fel, { blob: fisier, sursa: 'propriu' });
  // Copia locala se pune si se pastreaza indiferent de cloud. uploadFile o
  // sterge cand urcarea esueaza — corect pentru un document atasat unui
  // aparat, gresit pentru sablon: cineva l-ar pune fara semnal, ar genera
  // documentele toata ziua, si l-ar gasi disparut a doua zi.
  await cacheBlob(CAI[fel], fisier).catch(() => { /* mai incercam la citire */ });
  const rezultat = await uploadFile(CAI[fel], fisier);
  await cacheBlob(CAI[fel], fisier).catch(() => { /* ignoram */ });
  return !!rezultat.path;
};

/** Sablonul care se foloseste acum: cel propriu daca exista, altfel cel inclus. */
export const iaSablon = async (fel: FelSablon): Promise<Blob | null> =>
  (await sablonulFolosit(fel)).blob;

export const sablonulFolosit = async (fel: FelSablon): Promise<SablonPus> => {
  const stiut = memorie.get(fel);
  if (stiut) return stiut;

  // Intai cel propriu: copia locala, care merge si fara semnal, apoi cloud-ul.
  // Abia daca nu s-a pus niciunul se cade pe formularul livrat cu aplicatia.
  const local = await getCachedBlob(CAI[fel]).catch(() => null);
  const propriu = local || (await fetchFile(CAI[fel]).catch(() => null));
  const inclus = propriu ? null : await iaInclus(fel);
  const pus: SablonPus = propriu
    ? { blob: propriu, sursa: 'propriu' }
    : { blob: inclus, sursa: inclus ? 'inclus' : 'niciunul' };

  memorie.set(fel, pus);
  return pus;
};

/** Scoate sablonul propriu. Documentele se genereaza mai departe pe cel inclus. */
export const scoateSablon = async (fel: FelSablon): Promise<void> => {
  await deleteCachedBlob(CAI[fel]).catch(() => {});
  await removeFile(CAI[fel]).catch(() => {});
  memorie.delete(fel);
};

/** Ca panoul sa poata spune "pus" sau "lipseste" fara sa descarce fisierul. */
export const areSablon = async (fel: FelSablon): Promise<boolean> => !!(await iaSablon(fel));

/** Sterge copia din memorie, dupa ce sablonul a fost schimbat de altcineva. */
export const uitaSabloanele = () => memorie.clear();

/** Semnele pe care le completeaza aplicatia, pentru fiecare fel de document. */
export const SEMNE: Record<FelSablon, { semn: string; ce: string }[]> = {
  referat: [
    { semn: 'autoritate', ce: 'Autoritatea contractantă' },
    { semn: 'manager', ce: 'Numele managerului' },
    { semn: 'emitent', ce: 'Compartimentul emitent' },
    { semn: 'data', ce: 'Data referatului' },
    { semn: 'aprobat', ce: 'Cine aprobă' },
    { semn: 'obiect', ce: 'Obiectul achiziţiei' },
    { semn: 'justificare', ce: 'Justificarea, punctul c)' },
    { semn: 'oferte', ce: 'Fraza cu ofertele ataşate' },
    { semn: 'articol', ce: 'Articolul bugetar' },
    { semn: 'total', ce: 'Totalul estimat' },
    { semn: 'contact_nume', ce: 'Persoana de contact' },
    { semn: 'contact_functie', ce: 'Funcţia' },
    { semn: 'contact_compartiment', ce: 'Secţia / compartimentul' },
    { semn: 'contact_email', ce: 'Emailul' },
    { semn: 'contact_telefon', ce: 'Telefonul' },
    { semn: 'sef', ce: 'Şeful de compartiment' },
    { semn: 'rand.nr', ce: 'Rând de tabel: numărul curent' },
    { semn: 'rand.denumire', ce: 'Rând de tabel: denumirea' },
    { semn: 'rand.um', ce: 'Rând de tabel: unitatea de măsură' },
    { semn: 'rand.cant', ce: 'Rând de tabel: cantitatea' },
    { semn: 'rand.pret', ce: 'Rând de tabel: preţul unitar' },
    { semn: 'rand.valoare', ce: 'Rând de tabel: valoarea' },
    { semn: 'rand.caracteristici', ce: 'Rând de tabel: caracteristicile' },
  ],
  fundamentare: [
    { semn: 'obiect', ce: 'Obiectul documentului (titlul)' },
    { semn: 'descriere_scurta', ce: 'Punctul 2: descrierea pe scurt' },
    { semn: 'numar', ce: 'Numărul unic' },
    { semn: 'data', ce: 'Data' },
    { semn: 'revizie', ce: 'A câta revizuire' },
    { semn: 'data_revizie', ce: 'Data reviziei' },
    { semn: 'compartiment', ce: 'Compartimentul de specialitate' },
    { semn: 'descriere', ce: 'Descrierea pe larg' },
    { semn: 'referinta', ce: 'Fraza cu oferta sau contractul' },
    { semn: 'articol', ce: 'Articolul bugetar' },
    { semn: 'element', ce: 'Elementul de fundamentare' },
    { semn: 'program', ce: 'Programul' },
    { semn: 'cod_ssi', ce: 'Codul SSI' },
    { semn: 'parametri', ce: 'Parametrii de fundamentare' },
    { semn: 'val_precedenta', ce: 'Valoarea la revizia precedentă' },
    { semn: 'influenta', ce: 'Influenţa +/−' },
    { semn: 'val_actualizata', ce: 'Valoarea actualizată' },
    { semn: 'ramane', ce: '„Rămâne în sumă de ___ lei"' },
  ],
};
