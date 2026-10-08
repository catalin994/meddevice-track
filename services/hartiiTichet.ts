import { TaskAttachment } from '../types';

/**
 * Felurile de hartie care se pun pe un tichet de service.
 *
 * Stau aici, nu in fereastra tichetului, fiindca le citeste si tabelul: acolo
 * se vede dintr-o privire ca un tichet are oferta si referat, iar daca lista ar
 * fi scrisa in doua locuri s-ar desparti la primul fel nou.
 */

export type FelHartie = 'oferta' | 'referat' | 'fundamentare' | 'altul';

export const FELURI: { id: FelHartie; text: string; scurt: string }[] = [
  { id: 'oferta', text: 'Oferta de pret', scurt: 'Oferta' },
  { id: 'referat', text: 'Referat de necesitate', scurt: 'Referat' },
  { id: 'fundamentare', text: 'Document de fundamentare', scurt: 'Fundamentare' },
  { id: 'altul', text: 'Alt document', scurt: 'Document' },
];

/**
 * Cum se cheama hartia pe scurt.
 *
 * Felul ei, cand a fost ales; altfel ce se poate spune dupa fisier. Pozele puse
 * la raportarea incidentului n-au fel — ele nu se intreaba ce sunt, se vad.
 */
export const etichetaHartiei = (a: TaskAttachment): string =>
  FELURI.find(f => f.id === a.category)?.scurt
  || (a.kind === 'image' ? 'Poza' : a.kind === 'video' ? 'Filmare' : 'Document');

/**
 * Cu ce culoare se arata fiecare fel.
 *
 * Nu de frumusete: intr-o lista de sase hartii, culoarea e ce deosebeste
 * dintr-o privire oferta de referat, inainte sa fie citit numele fisierului.
 */
export const CULORI_HARTIE: Record<string, { punct: string; text: string }> = {
  oferta:       { punct: 'bg-amber-500',   text: 'text-amber-700' },
  referat:      { punct: 'bg-blue-500',    text: 'text-blue-700' },
  fundamentare: { punct: 'bg-indigo-500',  text: 'text-indigo-700' },
  altul:        { punct: 'bg-slate-400',   text: 'text-slate-600' },
};

export const culoareaHartiei = (a: TaskAttachment) =>
  CULORI_HARTIE[a.category || 'altul'] || CULORI_HARTIE.altul;

/**
 * Hartiile tichetului, stranse pe feluri.
 *
 * Insirate una dupa alta, fiecare isi scria felul deasupra numelui — "oferta,
 * o1.pdf; oferta, o2.pdf" — si acelasi cuvant se repeta cat tine lista.
 * Stranse, felul se spune o data si sub el stau fisierele lui, ca intr-un dosar.
 *
 * Ordinea e cea a felurilor, nu cea a incarcarii: oferta vine inaintea
 * referatului fiindca asa vine si in realitate. Ce n-are fel — pozele de la
 * fata locului — ramane la urma.
 */
export const grupeazaHartiile = (atasamente: TaskAttachment[] = []) => {
  const grupuri: { fel: string; text: string; hartii: TaskAttachment[] }[] = [];
  const pune = (fel: string, text: string, a: TaskAttachment) => {
    const g = grupuri.find(x => x.fel === fel);
    if (g) g.hartii.push(a);
    else grupuri.push({ fel, text, hartii: [a] });
  };
  for (const f of FELURI) {
    for (const a of atasamente) if (a.category === f.id) pune(f.id, f.text, a);
  }
  for (const a of atasamente) {
    if (FELURI.some(f => f.id === a.category)) continue;
    pune('fara', a.kind === 'image' ? 'Poze' : a.kind === 'video' ? 'Filmari' : 'Alte fisiere', a);
  }
  return grupuri;
};
