import {
  MedicalTask, MedicalDevice, TaskStatus, TaskPriority,
  TASK_STATUS_RO, TASK_PRIORITY_RO,
} from '../types';
import { etichetaHartiei } from './hartiiTichet';
import { saveFileAs } from './fileService';

/**
 * Raportul tichetelor de service, in Excel.
 *
 * Evidenta tichetelor traia numai pe ecran. Dar raportul lunar catre conducere,
 * situatia ceruta la un control, lista cu ce s-a stricat intr-o sectie — toate
 * se cer pe hartie sau in Excel, si se faceau numarand de mana de pe ecran,
 * tichet cu tichet.
 *
 * Aici ies toate deodata, cu tot ce se stie despre fiecare: ce s-a stricat, la
 * ce aparat — cu serie, model si numar de inventar, ca sa se poata lega de
 * inventar — in ce stare e, de cate zile, si ce hartii s-au strans pe el.
 *
 * Doua foi: una cu tichetele, randul pe tichet, si una cu socoteala pe sectii,
 * fiindca intrebarea care urmeaza e intotdeauna "unde se strica cel mai des".
 */

const NEGRU = 'FF1E293B';
const CENUSIU = 'FF64748B';
const LINIE = 'FFE2E8F0';

const CULORI_STARE: Record<string, string> = {
  [TaskStatus.PENDING]: 'FF64748B',
  [TaskStatus.IN_PROGRESS]: 'FF2563EB',
  [TaskStatus.COMPLETED]: 'FF059669',
};

const CULORI_PRIORITATE: Record<string, string> = {
  [TaskPriority.CRITICAL]: 'FFDC2626',
  [TaskPriority.HIGH]: 'FFEA580C',
  [TaskPriority.MEDIUM]: 'FF2563EB',
  [TaskPriority.LOW]: 'FF94A3B8',
};

/** Ordinea in raport: intai ce e deschis, la urma ce s-a terminat. */
const RANG_STARE: Record<string, number> = {
  [TaskStatus.PENDING]: 0,
  [TaskStatus.IN_PROGRESS]: 1,
  [TaskStatus.COMPLETED]: 2,
};

const azi = () => new Date(new Date().toISOString().split('T')[0] + 'T00:00:00');

/** De cate zile e deschis tichetul. Gol pentru cele fara data de deschidere. */
const zileDeschis = (t: MedicalTask): number | '' => {
  const d = Date.parse(`${t.createdAt}T00:00:00`);
  if (Number.isNaN(d)) return '';
  return Math.max(0, Math.round((azi().getTime() - d) / 86400000));
};

const eRestant = (t: MedicalTask): boolean =>
  !!t.dueDate && t.status !== TaskStatus.COMPLETED
  && t.dueDate < new Date().toISOString().split('T')[0];

export const exportaTicheteExcel = async (
  tasks: MedicalTask[],
  devices: MedicalDevice[] = [],
  /** Cate sunt in total, cand lista vine filtrata — se scrie in subtitlu. */
  dinTotal?: number,
): Promise<void> => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Biomedic';
  wb.created = new Date();

  const dupaId = new Map(devices.map(d => [d.id, d]));
  const randuri = [...tasks].sort((a, b) =>
    (RANG_STARE[a.status] ?? 9) - (RANG_STARE[b.status] ?? 9)
    || (b.createdAt || '').localeCompare(a.createdAt || ''));

  const cate = (s: TaskStatus) => tasks.filter(t => t.status === s).length;

  /* ── foaia 1: tichetele ── */
  const COL = 18;
  const ws = wb.addWorksheet('Tichete service', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = [
    { key: 'nr', width: 5 }, { key: 'titlu', width: 34 }, { key: 'descriere', width: 46 },
    { key: 'note', width: 34 }, { key: 'stare', width: 14 }, { key: 'prioritate', width: 12 },
    { key: 'sectie', width: 20 }, { key: 'aparat', width: 26 }, { key: 'serie', width: 16 },
    { key: 'model', width: 18 }, { key: 'producator', width: 18 }, { key: 'inventar', width: 14 },
    { key: 'sectiaAparatului', width: 18 }, { key: 'creat', width: 12 }, { key: 'scadent', width: 12 },
    { key: 'zile', width: 8 }, { key: 'documente', width: 44 }, { key: 'id', width: 26 },
  ];

  const titlu = ws.addRow(['BIOMEDIC — RAPORT TICHETE SERVICE', ...Array(COL - 1).fill('')]);
  ws.mergeCells(1, 1, 1, COL);
  titlu.height = 42;
  titlu.getCell(1).style = {
    font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Arial' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRU } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };

  const sub = ws.addRow([
    `Generat: ${new Date().toLocaleString('ro-RO')}  •  ${tasks.length} tichete`
    + (dinTotal && dinTotal !== tasks.length ? ` din ${dinTotal} (lista filtrata)` : ''),
    ...Array(COL - 1).fill(''),
  ]);
  ws.mergeCells(2, 1, 2, COL);
  sub.height = 18;
  sub.getCell(1).style = {
    font: { size: 9, color: { argb: 'FF94A3B8' }, italic: true },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF263238' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };

  ws.addRow([]).height = 8;

  /* Socoteala de sus: cate sunt in fiecare stare, si cate au trecut de termen. */
  const grupuri = [
    { col: 1, span: 3, eticheta: 'TOTAL', valoare: tasks.length, culoare: 'FF2563EB' },
    { col: 4, span: 3, eticheta: 'IN ASTEPTARE', valoare: cate(TaskStatus.PENDING), culoare: CULORI_STARE[TaskStatus.PENDING] },
    { col: 7, span: 3, eticheta: 'IN LUCRU', valoare: cate(TaskStatus.IN_PROGRESS), culoare: CULORI_STARE[TaskStatus.IN_PROGRESS] },
    { col: 10, span: 3, eticheta: 'FINALIZATE', valoare: cate(TaskStatus.COMPLETED), culoare: CULORI_STARE[TaskStatus.COMPLETED] },
    { col: 13, span: 3, eticheta: 'RESTANTE', valoare: tasks.filter(eRestant).length, culoare: 'FFDC2626' },
    { col: 16, span: 3, eticheta: 'CU DOCUMENTE', valoare: tasks.filter(t => (t.attachments || []).length > 0).length, culoare: 'FF7C3AED' },
  ];
  const randEtichete = ws.addRow(Array(COL).fill('')); randEtichete.height = 16;
  const randValori = ws.addRow(Array(COL).fill('')); randValori.height = 30;
  grupuri.forEach(({ col, span, eticheta, valoare, culoare }) => {
    ws.mergeCells(4, col, 4, col + span - 1);
    ws.mergeCells(5, col, 5, col + span - 1);
    randEtichete.getCell(col).value = eticheta;
    randEtichete.getCell(col).style = {
      font: { bold: true, size: 8, color: { argb: culoare } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } },
      alignment: { horizontal: 'center', vertical: 'bottom' },
      border: { top: { style: 'thin', color: { argb: LINIE } }, left: { style: 'thin', color: { argb: LINIE } }, right: { style: 'thin', color: { argb: LINIE } } },
    };
    randValori.getCell(col).value = valoare;
    randValori.getCell(col).style = {
      font: { bold: true, size: 20, color: { argb: culoare }, name: 'Arial' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { bottom: { style: 'medium', color: { argb: culoare } }, left: { style: 'thin', color: { argb: LINIE } }, right: { style: 'thin', color: { argb: LINIE } } },
    };
  });

  ws.addRow([]).height = 8;

  const capete = ['#', 'Titlu / Defectiune', 'Descrierea problemei', 'Note tehnice', 'Status',
    'Prioritate', 'Sectia solicitanta', 'Dispozitiv', 'Serie', 'Model', 'Producator',
    'Nr. inventar', 'Sectia aparatului', 'Deschis', 'Scadent', 'Zile', 'Documente',
    'ID (nu modificati)'];
  const randCap = ws.addRow(capete);
  randCap.height = 30;
  randCap.eachCell(c => {
    c.style = {
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' }, name: 'Arial' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRU } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF2563EB' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } },
      },
    };
  });
  const randulCapului = randCap.number;

  randuri.forEach((t, i) => {
    const ap = t.deviceId ? dupaId.get(t.deviceId) : undefined;
    const hartii = (t.attachments || []).map(a => `${etichetaHartiei(a)}: ${a.name}`).join('\n');
    const r = ws.addRow([
      i + 1,
      t.title || '',
      t.description || '',
      t.notes || '',
      TASK_STATUS_RO[t.status] || t.status,
      TASK_PRIORITY_RO[t.priority] || t.priority,
      t.department || '',
      t.deviceName || ap?.name || '',
      ap?.serialNumber || '',
      ap?.model || '',
      ap?.manufacturer || '',
      ap?.inventoryNumber || '',
      ap?.department || '',
      t.createdAt || '',
      t.dueDate || '',
      zileDeschis(t),
      hartii,
      t.id,
    ]);

    const fundal = i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    const chenar = {
      top: { style: 'thin' as const, color: { argb: LINIE } },
      bottom: { style: 'thin' as const, color: { argb: LINIE } },
      left: { style: 'thin' as const, color: { argb: LINIE } },
      right: { style: 'thin' as const, color: { argb: LINIE } },
    };
    r.eachCell((cell, col) => {
      const fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: fundal } };
      const comun = { fill, border: chenar };
      if (col === 1) {
        cell.style = { ...comun, font: { size: 9, color: { argb: 'FF94A3B8' } }, alignment: { horizontal: 'center', vertical: 'top' } };
      } else if (col === 2) {
        cell.style = { ...comun, font: { bold: true, size: 9, name: 'Arial' }, alignment: { vertical: 'top', wrapText: true } };
      } else if (col === 3 || col === 4 || col === 17) {
        cell.style = { ...comun, font: { size: 9, color: { argb: 'FF475569' } }, alignment: { vertical: 'top', wrapText: true } };
      } else if (col === 5) {
        cell.style = { ...comun, font: { bold: true, size: 8, color: { argb: CULORI_STARE[t.status] || CENUSIU } }, alignment: { horizontal: 'center', vertical: 'top' } };
      } else if (col === 6) {
        cell.style = { ...comun, font: { bold: true, size: 8, color: { argb: CULORI_PRIORITATE[t.priority] || CENUSIU } }, alignment: { horizontal: 'center', vertical: 'top' } };
      } else if (col === 9 || col === 12) {
        cell.style = { ...comun, font: { size: 8, name: 'Courier New', color: { argb: 'FF475569' } }, alignment: { horizontal: 'center', vertical: 'top' } };
      } else if (col === 14 || col === 15 || col === 16) {
        const restant = col === 15 && eRestant(t);
        cell.style = {
          ...comun,
          font: { size: 8, bold: restant, color: { argb: restant ? 'FFDC2626' : CENUSIU } },
          alignment: { horizontal: 'center', vertical: 'top' },
        };
      } else if (col === 18) {
        cell.style = { ...comun, font: { size: 7, name: 'Courier New', color: { argb: 'FFCBD5E1' } }, alignment: { horizontal: 'center', vertical: 'top' } };
      } else {
        cell.style = { ...comun, font: { size: 9 }, alignment: { vertical: 'top', wrapText: true } };
      }
    });
  });

  /* Capul ramane la vedere cand se deruleaza, si se poate filtra din el. */
  ws.views = [{ state: 'frozen', ySplit: randulCapului }];
  if (randuri.length) {
    ws.autoFilter = {
      from: { row: randulCapului, column: 1 },
      to: { row: randulCapului + randuri.length, column: COL },
    };
  }

  /* ── foaia 2: unde se strica ── */
  const ws2 = wb.addWorksheet('Pe sectii');
  ws2.columns = [
    { key: 'sectie', width: 30 }, { key: 'asteptare', width: 16 },
    { key: 'lucru', width: 14 }, { key: 'gata', width: 14 }, { key: 'total', width: 12 },
  ];
  const t2 = ws2.addRow(['TICHETE PE SECTII', '', '', '', '']);
  ws2.mergeCells(1, 1, 1, 5);
  t2.height = 32;
  t2.getCell(1).style = {
    font: { bold: true, size: 13, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRU } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };
  const cap2 = ws2.addRow(['Sectia', 'In asteptare', 'In lucru', 'Finalizate', 'Total']);
  cap2.height = 22;
  cap2.eachCell(c => {
    c.style = {
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    };
  });

  const peSectii = new Map<string, { a: number; l: number; g: number }>();
  for (const t of tasks) {
    const s = t.department || 'Nealocat';
    const x = peSectii.get(s) || { a: 0, l: 0, g: 0 };
    if (t.status === TaskStatus.COMPLETED) x.g++;
    else if (t.status === TaskStatus.IN_PROGRESS) x.l++;
    else x.a++;
    peSectii.set(s, x);
  }
  [...peSectii.entries()]
    .sort((x, y) => (y[1].a + y[1].l + y[1].g) - (x[1].a + x[1].l + x[1].g))
    .forEach(([sectie, x], i) => {
      const r = ws2.addRow([sectie, x.a, x.l, x.g, x.a + x.l + x.g]);
      r.height = 18;
      r.eachCell((cell, col) => {
        cell.style = {
          font: { size: 9, bold: col === 5 },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } },
          alignment: { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle', indent: col === 1 ? 1 : 0 },
          border: { bottom: { style: 'thin', color: { argb: LINIE } } },
        };
      });
    });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  await saveFileAs(`Biomedic_Tichete_${new Date().toISOString().split('T')[0]}.xlsx`, blob);
};
