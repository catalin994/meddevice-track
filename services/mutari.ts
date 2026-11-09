import { MedicalDevice, LocationLog } from '../types';

/**
 * Mutarile interne ale unui aparat.
 *
 * Aparatele umbla prin spital: un injectomat plecat de la Terapie intensiva
 * ajunge la Chirurgie, un ecograf cumparat pentru Cardiologie sta jumatate din
 * an la Urgente. Registrul de evidenta cere locul de utilizare al fiecarui
 * dispozitiv (art. 20 lit. b), si locul de utilizare nu e un camp, e un sir:
 * de cand pana cand a stat unde.
 *
 * Aplicatia avea campul `locationHistory` in tipuri si coloana lui in baza, dar
 * niciun ecran nu scria si niciun ecran nu citea nimic in el. Aparatul isi
 * schimba sectia prin editarea unui camp, iar locul de dinainte se pierdea —
 * deci la un control nu se putea spune cand a ajuns aparatul unde sta, nici de
 * unde venea, desi tocmai asta se cere.
 *
 * Aici se scrie. Doua reguli, amandoua ca sa nu se despartă ce se vede de ce
 * s-a intamplat:
 *
 * 1. Orice schimbare de sectie lasa un rand, si cand se face din butonul de
 *    mutare, si cand se face din editarea fisei. Altfel ar fi doua feluri de a
 *    muta un aparat, din care numai unul se vede in registru.
 * 2. Randul spune si de unde a venit, nu doar unde a ajuns. Un rand din
 *    registru trebuie sa se citeasca singur.
 */

/** Cum arata o sectie cand se compara doua: fara spatii si fara majuscule. */
const cheia = (s?: string) => (s || '').trim().toLowerCase();

export const aceeasiSectie = (a?: string, b?: string) => cheia(a) === cheia(b);

/**
 * Sirul locurilor prin care a trecut aparatul, cel mai nou primul.
 *
 * Aparatele introduse inainte de randurile astea n-au niciun rand, desi au o
 * sectie. Pentru ele se face un rand de inceput din data achizitiei si sectia
 * de acum — nu e o mutare, e punctul de plecare, si se vede ca atare fiindca
 * n-are "de unde".
 */
export const istoriculLocurilor = (device: MedicalDevice): LocationLog[] => {
  const randuri = [...(device.locationHistory || [])]
    .filter(r => r && (r.department || r.from))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (randuri.length) {
    /*
     * Cand sectia de pe fisa nu e cea din ultimul rand, aparatul a fost mutat
     * pe alta cale — un import, o editare de pe alt dispozitiv, o
     * sincronizare. Se arata ca atare, cu data necunoscuta, in loc sa se
     * ascunda: o nepotrivire vazuta se poate corecta, una ascunsa nu.
     */
    if (!aceeasiSectie(randuri[0].department, device.department)) {
      return [{ date: '', department: device.department, from: randuri[0].department,
        note: 'Nepotrivire — sectia de pe fisa nu e cea din ultima mutare' }, ...randuri];
    }
    return randuri;
  }

  return device.department
    ? [{ date: device.commissioningDate || device.purchaseDate || '', department: device.department }]
    : [];
};

/**
 * Aparatul mutat in alta sectie.
 *
 * Intoarce aparatul schimbat, nu il salveaza: salvarea e treaba ecranului care
 * stie si de sincronizare. Cand sectia e aceeasi nu se scrie nimic — o mutare
 * in acelasi loc nu e o mutare, si un rand in plus la fiecare salvare a fisei
 * ar umple registrul cu zgomot.
 */
export const mutaAparatul = (
  device: MedicalDevice,
  catre: string,
  cand: string = new Date().toISOString().split('T')[0],
  nota?: string,
): MedicalDevice => {
  const dest = (catre || '').trim();
  if (!dest || aceeasiSectie(dest, device.department)) return device;

  const rand: LocationLog = { date: cand, department: dest };
  if (device.department) rand.from = device.department;
  if ((nota || '').trim()) rand.note = nota!.trim();

  return {
    ...device,
    department: dest,
    locationHistory: [...(device.locationHistory || []), rand],
  };
};
