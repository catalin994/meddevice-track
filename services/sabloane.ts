import { uploadFile, fetchFile, removeFile } from './fileStorage';
import { cacheBlob, getCachedBlob, deleteCachedBlob } from './storageService';

/**
 * Sablonul Word al institutiei, tinut o data si folosit de toata lumea.
 *
 * Documentul generat trebuie sa arate exact ca hartia spitalului — cu sigla,
 * antetul, subsolul si stilurile ei. Singura cale sigura pentru asta e sa se
 * porneasca de la fisierul lor, nu de la o reconstructie a lui.
 *
 * Calea e fixa, nu retinuta local: altfel un sablon pus de pe calculatorul din
 * birou n-ar fi gasit de pe telefonul din sectie.
 */

export type FelSablon = 'referat' | 'fundamentare';

const CAI: Record<FelSablon, string> = {
  referat: 'sabloane/referat.docx',
  fundamentare: 'sabloane/fundamentare.docx',
};

/** O copie locala, ca sa nu se ceara de la cloud la fiecare document. */
const memorie = new Map<FelSablon, Blob | null>();

export const punSablon = async (fel: FelSablon, fisier: Blob): Promise<boolean> => {
  memorie.set(fel, fisier);
  // Copia locala se pune si se pastreaza indiferent de cloud. uploadFile o
  // sterge cand urcarea esueaza — corect pentru un document atasat unui
  // aparat, gresit pentru sablon: cineva l-ar pune fara semnal, ar genera
  // documentele toata ziua, si l-ar gasi disparut a doua zi.
  await cacheBlob(CAI[fel], fisier).catch(() => { /* mai incercam la citire */ });
  const rezultat = await uploadFile(CAI[fel], fisier);
  await cacheBlob(CAI[fel], fisier).catch(() => { /* ignoram */ });
  return !!rezultat.path;
};

export const iaSablon = async (fel: FelSablon): Promise<Blob | null> => {
  if (memorie.has(fel)) return memorie.get(fel) || null;
  // Intai copia locala — merge si fara semnal — apoi cloud-ul.
  const local = await getCachedBlob(CAI[fel]).catch(() => null);
  const blob = local || (await fetchFile(CAI[fel]).catch(() => null));
  memorie.set(fel, blob || null);
  return blob || null;
};

export const scoateSablon = async (fel: FelSablon): Promise<void> => {
  await deleteCachedBlob(CAI[fel]).catch(() => {});
  await removeFile(CAI[fel]).catch(() => {});
  memorie.set(fel, null);
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
    { semn: 'obiect', ce: 'Obiectul documentului' },
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
  ],
};
