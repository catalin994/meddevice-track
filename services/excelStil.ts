/**
 * Cum arata o foaie de Excel scoasa din aplicatie.
 *
 * Raportul tichetelor isi desenase titlul, subtitlul, capul de tabel si
 * randurile pe loc, o suta de linii de culori si chenare. Urmatoarele hartii
 * care ies in Excel — registrul de evidenta, planul anual de verificari — au
 * nevoie de exact aceleasi. Copiate de trei ori, s-ar departa una de alta pana
 * cand trei hartii ale aceluiasi birou ar arata a trei birouri.
 *
 * Aici sunt caramizile, nu hartiile: fiecare raport isi pastreaza coloanele si
 * socotelile lui.
 */

export const NEGRU = 'FF1E293B';
export const CENUSIU = 'FF64748B';
export const LINIE = 'FFE2E8F0';
export const ALBASTRU = 'FF2563EB';
export const ROSU = 'FFDC2626';
export const VERDE = 'FF059669';
export const CHIHLIMBAR = 'FFEA580C';

/* Tipurile ExcelJS vin dintr-un import dinamic, deci se lucreaza pe `any`:
   altfel biblioteca ar trebui incarcata la pornirea aplicatiei numai ca sa
   existe tipul, adica exact ce evita importul dinamic. */
type Foaie = any;
type Rand = any;

const chenar = {
  top: { style: 'thin' as const, color: { argb: LINIE } },
  bottom: { style: 'thin' as const, color: { argb: LINIE } },
  left: { style: 'thin' as const, color: { argb: LINIE } },
  right: { style: 'thin' as const, color: { argb: LINIE } },
};

/** Banda neagra de sus, cu numele hartiei. */
export const titluFoii = (ws: Foaie, text: string, coloane: number) => {
  const r = ws.addRow([text, ...Array(Math.max(0, coloane - 1)).fill('')]);
  ws.mergeCells(r.number, 1, r.number, coloane);
  r.height = 42;
  r.getCell(1).style = {
    font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Arial' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRU } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };
  return r;
};

/** Randul de sub titlu: cand s-a scos hartia si pe ce se intinde. */
export const subtitluFoii = (ws: Foaie, text: string, coloane: number) => {
  const r = ws.addRow([text, ...Array(Math.max(0, coloane - 1)).fill('')]);
  ws.mergeCells(r.number, 1, r.number, coloane);
  r.height = 18;
  r.getCell(1).style = {
    font: { size: 9, color: { argb: 'FF94A3B8' }, italic: true },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF263238' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };
  return r;
};

/** Un rand de aer, cat sa nu se lipeasca sectiunile. */
export const aer = (ws: Foaie, inaltime = 8) => { ws.addRow([]).height = inaltime; };

/** Capul de tabel: alb pe negru, cu dunga albastra dedesubt. */
export const capulTabelului = (ws: Foaie, etichete: string[]): number => {
  const r = ws.addRow(etichete);
  r.height = 30;
  r.eachCell((c: any) => {
    c.style = {
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' }, name: 'Arial' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRU } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: ALBASTRU } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } },
      },
    };
  });
  return r.number;
};

/** Cum se scrie o celula anume, cand nu merge regula obisnuita. */
export interface StilCelula {
  bold?: boolean;
  /** Culoarea scrisului, ca argb. */
  culoare?: string;
  centrat?: boolean;
  /** Scris marunt si monospatiat: serii, numere de inventar, coduri. */
  cod?: boolean;
  /** Textul lung se rupe pe mai multe randuri in loc sa iasa din celula. */
  rupe?: boolean;
  marime?: number;
}

/**
 * Un rand de date: dungi alternate, chenar subtire, scris de noua puncte.
 *
 * `peColoana` da abaterile — ce coloana se scrie altfel si cum. Fara el,
 * randul iese cu regula obisnuita, care e buna pentru noua coloane din zece.
 */
export const randDeDate = (
  ws: Foaie,
  valori: unknown[],
  index: number,
  peColoana: Record<number, StilCelula> = {},
): Rand => {
  const r = ws.addRow(valori as any[]);
  const fundal = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
  r.eachCell((cell: any, col: number) => {
    const s = peColoana[col] || {};
    cell.style = {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fundal } },
      border: chenar,
      font: {
        size: s.marime ?? (s.cod ? 8 : 9),
        bold: !!s.bold,
        name: s.cod ? 'Courier New' : undefined,
        color: { argb: s.culoare || (s.cod ? 'FF475569' : 'FF0F172A') },
      },
      alignment: {
        horizontal: s.centrat || s.cod ? 'center' : undefined,
        vertical: 'top',
        wrapText: !!s.rupe,
      },
    };
  });
  return r;
};

/**
 * Capul ramane la vedere cand se deruleaza, si se poate filtra din el.
 *
 * Fara asta, un registru de doua mii de randuri e o foaie in care, dupa al
 * treizecilea rand, nu se mai stie ce coloana e care.
 */
export const inghetaSiFiltreaza = (ws: Foaie, randulCapului: number, cateRanduri: number, coloane: number) => {
  ws.views = [{ state: 'frozen', ySplit: randulCapului }];
  if (cateRanduri > 0) {
    ws.autoFilter = {
      from: { row: randulCapului, column: 1 },
      to: { row: randulCapului + cateRanduri, column: coloane },
    };
  }
};

/** Cartonasele de socoteala de sub titlu: o eticheta mica si o cifra mare. */
export interface Cartonas { eticheta: string; valoare: number | string; culoare?: string; span?: number }

export const bandaDeSocoteli = (ws: Foaie, carduri: Cartonas[]) => {
  const randE = ws.addRow([]); randE.height = 16;
  const randV = ws.addRow([]); randV.height = 30;
  let col = 1;
  for (const c of carduri) {
    const span = c.span || 3;
    const culoare = c.culoare || ALBASTRU;
    ws.mergeCells(randE.number, col, randE.number, col + span - 1);
    ws.mergeCells(randV.number, col, randV.number, col + span - 1);
    randE.getCell(col).value = c.eticheta;
    randE.getCell(col).style = {
      font: { bold: true, size: 8, color: { argb: culoare } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } },
      alignment: { horizontal: 'center', vertical: 'bottom' },
      border: { top: { style: 'thin', color: { argb: LINIE } }, left: { style: 'thin', color: { argb: LINIE } }, right: { style: 'thin', color: { argb: LINIE } } },
    };
    randV.getCell(col).value = c.valoare;
    randV.getCell(col).style = {
      font: { bold: true, size: 20, color: { argb: culoare }, name: 'Arial' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { bottom: { style: 'medium', color: { argb: culoare } }, left: { style: 'thin', color: { argb: LINIE } }, right: { style: 'thin', color: { argb: LINIE } } },
    };
    col += span;
  }
};

/** A4 peisaj, latit pe o pagina — cum se tipareste un registru. */
export const PAGINA_PEISAJ = {
  paperSize: 9, orientation: 'landscape' as const,
  fitToPage: true, fitToWidth: 1, fitToHeight: 0,
};
