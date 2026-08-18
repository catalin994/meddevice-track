import { saveFileAs } from './fileService';

/**
 * Un tabel in Excel, scris la fel peste tot.
 *
 * Aplicatia avea doua biblioteci de Excel si scria cu amandoua: unele liste
 * ieseau cu antet colorat si coloane pe masura, altele ca o foaie goala cu text
 * in ea. Aceeasi aplicatie, doua hartii care nu semanau.
 *
 * Acum scrie una singura, iar cealalta ramane doar la citit — e singura care
 * intelege si fisierele .xls vechi, cum vin din programele de inventar.
 */

export interface Coloana {
  cap: string;
  latime: number;
  /** Numerele si datele se aliniaza altfel decat textul. */
  centrat?: boolean;
}

export const scrieTabel = async (opt: {
  /** Fara extensie: se adauga .xlsx. */
  fisier: string;
  foaie: string;
  titlu: string;
  subtitlu?: string;
  coloane: Coloana[];
  randuri: (string | number)[][];
}): Promise<void> => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Biomedic';
  wb.created = new Date();

  const ws = wb.addWorksheet(opt.foaie, {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = opt.coloane.map((c, i) => ({ key: `c${i}`, width: c.latime }));
  const n = opt.coloane.length;

  const titlu = ws.addRow([opt.titlu, ...Array(n - 1).fill('')]);
  ws.mergeCells(1, 1, 1, n);
  titlu.height = 38;
  titlu.getCell(1).style = {
    font: { bold: true, size: 15, color: { argb: 'FFFFFFFF' }, name: 'Arial' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };

  const sub = ws.addRow([
    opt.subtitlu || `Generat: ${new Date().toLocaleString('ro-RO')}  •  ${opt.randuri.length} randuri`,
    ...Array(n - 1).fill(''),
  ]);
  ws.mergeCells(2, 1, 2, n);
  sub.getCell(1).style = {
    font: { size: 9, color: { argb: 'FF94A3B8' }, italic: true },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF263238' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };
  ws.addRow([]).height = 6;

  const cap = ws.addRow(opt.coloane.map(c => c.cap));
  cap.height = 24;
  cap.eachCell(c => {
    c.style = {
      font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    };
  });

  // Randuri alternate: pe o lista de doua sute, ochiul pierde randul altfel.
  opt.randuri.forEach((r, i) => {
    const rand = ws.addRow(r);
    const fundal = i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    rand.eachCell((cell, col) => {
      cell.style = {
        font: { size: 9 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fundal } },
        alignment: {
          horizontal: opt.coloane[col - 1]?.centrat ? 'center' : 'left',
          vertical: 'middle',
          wrapText: false,
        },
      };
    });
  });

  // Antetul ramane pe ecran cand se deruleaza o lista lunga.
  ws.views = [{ state: 'frozen', ySplit: 4 }];

  const buf = await wb.xlsx.writeBuffer();
  await saveFileAs(`${opt.fisier}.xlsx`, new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
};
