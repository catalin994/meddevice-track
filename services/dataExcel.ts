/**
 * Citirea unei date dintr-o celula de Excel.
 *
 * Aplicatia scrie datele in export ca text, "2023-01-15". Dar fisierul nu se
 * intoarce asa cum a plecat: cine il deschide in Excel si il salveaza, chiar
 * fara sa schimbe nimic, pleaca cu alt fisier — Excel recunoaste sirul si il
 * face celula de data adevarata, adica un numar. Iar tabelele tinute de mana,
 * cele care n-au iesit niciodata din aplicatie, au datele scrise cum se scriu
 * la noi: 15.03.2023.
 *
 * Importul citea celula cu String() si o dadea lui new Date(). Din asta ieseau
 * doua lucruri, amandoua rele:
 *
 *   "15.03.2023"  → data nevalida → toISOString() arunca "Invalid time value",
 *                   si murea tot importul, cu un mesaj care nu spunea nici ce
 *                   rand, nici ce coloana.
 *
 *   44941         → numarul din Excel citit ca an → "+044941-07-01". Nimic nu
 *                   se plangea; aparatul intra in evidenta cu o data din anul
 *                   44941, si de acolo strica Panoul, planul si registrul.
 *
 * Al doilea e mai rau decat primul: unul se vede, celalalt nu.
 *
 * Aici se citeste o data, din orice forma ar veni, si iese "2023-01-15" sau
 * nimic. Nimic inseamna nimic — nu ziua de azi, nu o data inventata.
 */

/** Ziua zero a numerelor din Excel. 1900 e socotit bisect acolo, de aceea 30. */
const ZIUA_ZERO = Date.UTC(1899, 11, 30);
const ZI = 86400000;

/** Ce scrie lumea intr-o celula cand nu stie data. */
const NIMIC = new Set(['', '-', '--', '—', 'n/a', 'na', 'nu', 'nedefinit', 'necunoscut', '?']);

const iso = (an: number, luna: number, zi: number): string =>
  `${String(an).padStart(4, '0')}-${String(luna).padStart(2, '0')}-${String(zi).padStart(2, '0')}`;

/** Ziua chiar exista? 31 februarie nu, si nu trebuie sa treaca drept data. */
const adevarata = (an: number, luna: number, zi: number): boolean => {
  if (an < 1900 || an > 2100 || luna < 1 || luna > 12 || zi < 1 || zi > 31) return false;
  const d = new Date(Date.UTC(an, luna - 1, zi));
  return d.getUTCFullYear() === an && d.getUTCMonth() === luna - 1 && d.getUTCDate() === zi;
};

/** "23" → 2023, "99" → 1999. Pragul e cel folosit de toata lumea. */
const anIntreg = (n: number): number => (n >= 100 ? n : n < 70 ? 2000 + n : 1900 + n);

/**
 * Data dintr-o celula, ca "2023-01-15". Sir gol cand celula nu tine o data.
 *
 * Se primeste valoarea bruta a celulei, nu trecuta prin String(): o celula de
 * data citita cu `cellDates` vine ca obiect Date, si l-am pierde.
 */
export const dataDinCelula = (v: unknown): string => {
  if (v === null || v === undefined) return '';

  /* Celula de data adevarata, cand fisierul a fost citit cu cellDates. */
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? ''
      : iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }

  if (typeof v === 'number') return dinNumar(v);

  const t = String(v).trim();
  if (!t || NIMIC.has(t.toLowerCase())) return '';

  /* Deja in forma buna, cu sau fara ceas dupa ea. */
  const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (m) {
    const [an, luna, zi] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return adevarata(an, luna, zi) ? iso(an, luna, zi) : '';
  }

  /* Un numar venit ca text: tot numarul din Excel e. */
  if (/^\d+(\.\d+)?$/.test(t)) return dinNumar(Number(t));

  /*
   * Trei numere despartite prin punct, slash sau liniuta.
   *
   * La noi se scrie ziua intai, si asa se citeste. Dar un fisier facut pe un
   * calculator cu alta limba poate avea luna intai, si atunci ziua-intai da o
   * data care nu exista — 15 ca luna. Cand se intampla asta, se incearca
   * invers; cand merg amandoua, ramane ziua-intai, fiindca asa scriem noi.
   */
  const p = t.match(/^(\d{1,4})[.\/-](\d{1,2})[.\/-](\d{1,4})$/);
  if (p) {
    const a = Number(p[1]), b = Number(p[2]), c = Number(p[3]);

    /* "2023.01.15" — anul intai, despartit altfel. */
    if (p[1].length === 4) return adevarata(a, b, c) ? iso(a, b, c) : '';

    const an = anIntreg(c);
    if (adevarata(an, b, a)) return iso(an, b, a);   // ziua intai
    if (adevarata(an, a, b)) return iso(an, a, b);   // luna intai
    return '';
  }

  return '';
};

/**
 * Numarul din Excel, in data.
 *
 * Un intreg intre 1900 si 2100 nu e numar de zile, e un an scris singur —
 * "2011" in coloana de achizitie. Ca numar de zile ar insemna o zi din 1905,
 * ceea ce la un aparat de spital nu se poate. Se ia ca an, si se pune intai
 * ianuarie: se vede pe fisa ca e 1 ianuarie si se poate indrepta, pe cand un
 * an aruncat nu se mai intoarce.
 */
const dinNumar = (n: number): string => {
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n) && n >= 1900 && n <= 2100) return iso(n, 1, 1);
  /* Numarul de zile din Excel, de la 1 (1900) pana in anul 9999. */
  if (n < 1 || n > 2958465) return '';
  const d = new Date(ZIUA_ZERO + Math.floor(n) * ZI);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};
