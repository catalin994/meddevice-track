/**
 * TVA-ul, intr-un singur loc.
 *
 * Cota standard e 21% de la 1 august 2025. Sta aici, nu imprastiata prin
 * formulare, fiindca ziua in care se schimba iar vine fara sa intrebe pe
 * nimeni, si atunci se schimba un singur rand.
 *
 * Toate socotelile se rotunjesc la ban. Fara rotunjire, 2.666,67 x 1,21 da
 * 3.226,6707 in virgula mobila: pe hartie nu se vede, dar suma ramane in
 * evidenta si devine valoarea de plecare a reviziei urmatoare.
 */

export const COTA_TVA = 21;

const laBan = (n: number) => Math.round(n * 100) / 100;

export const cuTva = (suma: number, cota = COTA_TVA): number =>
  laBan(suma * (1 + cota / 100));

export const faraTva = (suma: number, cota = COTA_TVA): number =>
  laBan(suma / (1 + cota / 100));
