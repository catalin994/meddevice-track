import { MedicalDevice, DeviceFile } from '../types';

/**
 * Acelasi document, pe mai multe aparate, tinut o singura data.
 *
 * Un raport de service acopera de multe ori toata secretia dintr-o zi — patru
 * injectomate si doua aspiratoare pe aceeasi hartie. Pus de mana pe fiecare
 * aparat, documentul s-ar urca de sase ori si ar ocupa de sase ori locul; lasat
 * pe unul singur, nu se gaseste de la celelalte cinci.
 *
 * Solutia e sa se lege, nu sa se copieze: fisierul sta o data in stocare, iar
 * fiecare aparat are doar o trimitere spre el. Cheia comuna e chiar calea din
 * stocare — e unica, si exista deja.
 */

/** Cheia dupa care se recunoaste acelasi fisier pe aparate diferite. */
export const cheiaFisierului = (f: DeviceFile): string | null => f.path || null;

/** Aparatele care poarta acelasi fisier, in afara celui de la care se pleaca. */
export const undeMaiEste = (
  fisier: DeviceFile,
  devices: MedicalDevice[],
  exceptaId?: string,
): MedicalDevice[] => {
  const cheie = cheiaFisierului(fisier);
  if (!cheie) return [];
  return devices.filter(d =>
    d.id !== exceptaId && (d.files || []).some(f => f.path === cheie));
};

/**
 * Fisierul mai e folosit de altcineva?
 *
 * Se intreaba inainte de a sterge din stocare. Fara intrebarea asta, scoaterea
 * raportului de pe un aparat ar lasa celelalte cinci cu o trimitere spre un
 * fisier care nu mai exista — si nimeni n-ar afla pana la deschiderea lui.
 */
export const maiEFolosit = (
  fisier: DeviceFile,
  devices: MedicalDevice[],
  deviceId: string,
  fileId: string,
): boolean => {
  const cheie = cheiaFisierului(fisier);
  if (!cheie) return false;
  return devices.some(d => (d.files || []).some(f =>
    f.path === cheie && !(d.id === deviceId && f.id === fileId)));
};

/**
 * Leaga fisierul de aparatele alese si il scoate de la cele debifate.
 *
 * Intoarce doar aparatele care s-au schimbat — pe restul nu are rost sa le
 * rescrie, si fiecare rescriere inseamna un rand urcat in cloud.
 */
export const leagaFisierul = (
  fisier: DeviceFile,
  devices: MedicalDevice[],
  sursaId: string,
  aleseIds: string[],
): MedicalDevice[] => {
  const cheie = cheiaFisierului(fisier);
  if (!cheie) return [];
  const alese = new Set(aleseIds);
  const schimbate: MedicalDevice[] = [];

  for (const d of devices) {
    // Aparatul de la care s-a plecat isi pastreaza fisierul oricum.
    if (d.id === sursaId) continue;
    const are = (d.files || []).some(f => f.path === cheie);
    if (alese.has(d.id) && !are) {
      schimbate.push({
        ...d,
        files: [...(d.files || []), {
          ...fisier,
          // Id nou: doua aparate n-au voie sa aiba acelasi id de fisier, chiar
          // daca fisierul e acelasi.
          id: `F-${crypto.randomUUID()}`,
          dateAdded: new Date().toISOString().split('T')[0],
        }],
      });
    } else if (!alese.has(d.id) && are) {
      schimbate.push({ ...d, files: (d.files || []).filter(f => f.path !== cheie) });
    }
  }
  return schimbate;
};
