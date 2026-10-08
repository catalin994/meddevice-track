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
