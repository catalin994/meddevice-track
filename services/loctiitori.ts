/**
 * Ce pare scris, dar nu e.
 *
 * Cand un aparat intra in aplicatie fara serie, fara sectie sau fara
 * producator, randul nu ramane gol: se pune un locţiitor, ca ecranul sa aiba ce
 * arata — "N/A", "Unassigned", "Unknown", "Unnamed Asset". Pentru o lista pe
 * telefon e o solutie buna; pentru o hartie care se semneaza, e o minciuna.
 *
 * Un registru de evidenta in care scrie ca aparatul are seria "N/A" si sta la
 * sectia "Unassigned" e mai rau decat unul cu celulele goale: golul se vede si
 * se completeaza, locţiitorul trece drept dato. Si mai rau, verificarea de
 * dinaintea controlului l-ar numara ca pe un aparat complet.
 *
 * Asa ca peste tot unde datele ies din aplicatie — in registru, in fisa, in
 * verdictul controlului — locţiitorii se intorc la ce sunt: nimic.
 */

const CEVA_DE_NIMIC = new Set([
  'n/a', 'na', 'n.a.', 'nan', 'null', 'undefined',
  'unassigned', 'unknown', 'unnamed asset', 'none',
  'nedefinit', 'necunoscut', 'nespecificat', 'fara',
  '-', '--', '---', '—', '?', '.',
]);

/**
 * Ce scrie de fapt in camp: textul curatat, sau sir gol daca e un locţiitor.
 *
 * Comparatia e fara majuscule si fara spatii la capete, fiindca locţiitorii
 * vin si din importuri Excel, unde au fost scrisi de mana in cinci feluri.
 */
export const scris = (v?: unknown): string => {
  const t = String(v ?? '').trim();
  return CEVA_DE_NIMIC.has(t.toLowerCase()) ? '' : t;
};

/** Campul e gol sau tine un locţiitor — adica nu se stie nimic. */
export const lipseste = (v?: unknown): boolean => !scris(v);
