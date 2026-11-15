import { buildPath, uploadDataUrl, removeFile } from './fileStorage';

/**
 * Pozele din evidenta: a aparatului si a consumabilelor lui.
 *
 * Doua lucruri care pareau amanunte, si nu sunt.
 *
 * Intai marimea. O poza facuta cu telefonul are patru-cinci megaocteti. Pusa
 * intreaga in randul aparatului, ea se trimite la fiecare sincronizare, chiar
 * cand s-a schimbat numai sectia — si o fisa cu opt consumabile ar duce
 * patruzeci de megaocteti dintr-un capat in altul al retelei de fiecare data.
 * Asa ca se micsoreaza inainte sa fie salvata, si se pune in stocare, nu in
 * rand.
 *
 * Apoi, ce se intampla cand urcarea nu merge. Pe un telefon din subsol, fara
 * semnal, urcarea cade — iar poza tocmai facuta s-ar pierde. Atunci ramane
 * inline, in rand: un rand gras e mult mai bun decat o poza pierduta si decat
 * un om care crede ca a salvat ceva.
 */

/** Cat de mare poate fi latura lunga. 1000 e destul ca sa se recunoasca piesa. */
export const LATURA = 1000;
/** Cat de tare se apasa. 0.72 tine textul de pe eticheta inca citibil. */
export const CALITATE = 0.72;

/**
 * Poza, micsorata si adusa la JPEG.
 *
 * Se trece prin canvas, deci pierde si datele EXIF — inclusiv locul unde a
 * fost facuta, pe care nimeni nu l-a cerut si care n-are ce cauta intr-o
 * evidenta de spital.
 */
export const micsoreaza = (
  fisier: Blob, latura = LATURA, calitate = CALITATE,
): Promise<string> =>
  new Promise((gata, rau) => {
    const cititor = new FileReader();
    cititor.onerror = () => rau(new Error('Poza nu a putut fi citita.'));
    cititor.onload = e => {
      const img = new Image();
      img.onerror = () => rau(new Error('Fisierul nu pare sa fie o imagine.'));
      img.onload = () => {
        let { width: l, height: i } = img;
        const scara = Math.min(1, latura / Math.max(l, i));
        l = Math.max(1, Math.round(l * scara));
        i = Math.max(1, Math.round(i * scara));
        const panza = document.createElement('canvas');
        panza.width = l;
        panza.height = i;
        const ctx = panza.getContext('2d');
        if (!ctx) return rau(new Error('Nu se poate prelucra imaginea pe acest dispozitiv.'));
        /* Fundal alb: un PNG cu transparenta ar iesi negru in JPEG. */
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, l, i);
        ctx.drawImage(img, 0, 0, l, i);
        gata(panza.toDataURL('image/jpeg', calitate));
      };
      img.src = e.target?.result as string;
    };
    cititor.readAsDataURL(fisier);
  });

/** Unde sta poza: in stocare daca s-a putut urca, altfel inline in rand. */
export interface PozaPusa {
  photoPath?: string;
  photoUrl?: string;
}

/**
 * Pune poza unde trebuie si spune unde a ajuns.
 *
 * `folder` separa pozele aparatelor de ale consumabilelor, `ownerId` le aduna
 * pe cele ale aceluiasi aparat la un loc — ca sa se poata gasi si sterge dupa
 * aparat, nu una cate una.
 */
export const punePoza = async (
  folder: string, ownerId: string, id: string, dataUrl: string,
): Promise<PozaPusa> => {
  const cale = buildPath(folder, ownerId, id, 'poza.jpg');
  const urcat = await uploadDataUrl(cale, dataUrl);
  return urcat.path ? { photoPath: urcat.path } : { photoUrl: dataUrl };
};

/**
 * Scoate poza din stocare, cand se poate.
 *
 * Nu se opreste daca stergerea cade: randul se salveaza oricum fara poza, si
 * un fisier ramas orfan in stocare e o suparare mult mai mica decat o fisa pe
 * care nu se poate sterge o poza gresita.
 */
export const stergePoza = async (poza: PozaPusa) => {
  if (poza.photoPath) await removeFile(poza.photoPath).catch(() => { /* ramane orfan */ });
};
