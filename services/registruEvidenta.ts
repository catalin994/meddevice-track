import {
  MedicalDevice, MedicalTask, Contract, DeviceStatus, TaskStatus,
  DEVICE_STATUS_RO, TASK_STATUS_RO, MAINTENANCE_TYPE_RO,
} from '../types';
import { ziuaCererii } from './termene';
import { istoriculLocurilor, aceeasiSectie } from './mutari';
import { scris } from './loctiitori';
import { contracteleAparatului } from './dosarAparat';
import {
  titluFoii, subtitluFoii, aer, capulTabelului, randDeDate, inghetaSiFiltreaza,
  bandaDeSocoteli, PAGINA_PEISAJ, ALBASTRU, ROSU, VERDE, CHIHLIMBAR, CENUSIU,
} from './excelStil';

/**
 * Registrul de evidenta a dispozitivelor medicale.
 *
 * Unitatea sanitara e obligata sa tina evidenta dispozitivelor medicale aflate
 * in utilizare (art. 20 lit. b): ce dispozitiv e, de cand e pus in functiune,
 * unde se foloseste, ce mentenanta si ce verificari i s-au facut, ce incidente
 * au fost, pe unde a umblat. Toate datele astea erau de mult in aplicatie —
 * dar imprastiate pe sase ecrane, si registrul se scria de mana intr-un tabel
 * tinut separat, care ramanea in urma din prima luna.
 *
 * Aici iese registrul intreg dintr-o apasare, cu patru foi, fiindca patru
 * lucruri diferite se citesc altfel:
 *
 *   1. Registrul — un rand pe dispozitiv, cu starea lui de acum. E foaia care
 *      se tipareste si se pune la dosar.
 *   2. Mutari — un rand pe mutare. Locul de utilizare nu e un camp, e un sir.
 *   3. Mentenanta si verificari — un rand pe lucrare.
 *   4. Incidente si defectiuni — un rand pe tichet.
 *
 * Registrul se poate scoate pe tot spitalul sau pe un punct de lucru. Un sef
 * de sectie caruia i se cere registrul nu trebuie sa primeasca inventarul
 * intregului spital ca sa-si gaseasca in el cele douazeci de aparate.
 *
 * Nu se inventeaza nimic. Ce lipseste din evidenta iese gol in registru, si
 * foaia de deasupra numara cate lipsesc: un registru care arata plin cand
 * evidenta e goala e mai rau decat niciun registru.
 */

const azi = () => new Date().toISOString().split('T')[0];

const ultima = <T extends { date?: string }>(l: T[] = []): T | undefined =>
  [...l].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];

/** Cine se uita la registru vrea sa vada expirarea in rosu, nu s-o socoteasca. */
const expirat = (data?: string) => !!data && data < azi();

export interface FiltruRegistru {
  /** Numai aparatele dintr-un punct de lucru. Gol inseamna tot spitalul. */
  sectie?: string;
  /** Aparatele casate ies din registrul celor "aflate in utilizare". */
  faraCasate?: boolean;
}

export interface ZestreaRegistrului {
  tasks?: MedicalTask[];
  contracte?: Contract[];
  /** Numele unitatii, scris in capul foii. */
  autoritate?: string;
}

/** Aparatele care intra in registru, in ordinea in care se citesc. */
export const aparateleRegistrului = (
  devices: MedicalDevice[],
  filtru: FiltruRegistru = {},
): MedicalDevice[] =>
  devices
    .filter(d => !filtru.sectie || aceeasiSectie(d.department, filtru.sectie))
    .filter(d => !filtru.faraCasate || d.status !== DeviceStatus.RETIRED)
    .sort((a, b) =>
      (a.department || '').localeCompare(b.department || '', 'ro')
      || (a.name || '').localeCompare(b.name || '', 'ro'));

export const registruEvidentaExcel = async (
  devices: MedicalDevice[],
  filtru: FiltruRegistru = {},
  zestre: ZestreaRegistrului = {},
): Promise<Blob> => {
  const { tasks = [], contracte = [], autoritate = '' } = zestre;
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Biomedic';
  wb.created = new Date();

  const randuri = aparateleRegistrului(devices, filtru);
  const aleLui = new Set(randuri.map(d => d.id));
  const ticheteLui = tasks.filter(t => t.deviceId && aleLui.has(t.deviceId));

  /* ── foaia 1: registrul ── */
  const COL = 26;
  const ws = wb.addWorksheet('Registru', { pageSetup: PAGINA_PEISAJ });
  ws.columns = [
    { width: 5 },  { width: 30 }, { width: 18 }, { width: 18 }, { width: 16 },
    { width: 13 }, { width: 11 }, { width: 20 }, { width: 22 }, { width: 12 },
    { width: 13 }, { width: 13 }, { width: 12 }, { width: 10 }, { width: 14 },
    { width: 13 }, { width: 14 }, { width: 13 }, { width: 12 }, { width: 16 },
    { width: 20 }, { width: 13 }, { width: 9 },  { width: 9 },  { width: 24 },
    { width: 30 },
  ];

  titluFoii(ws, 'REGISTRUL DE EVIDENŢĂ A DISPOZITIVELOR MEDICALE', COL);
  subtitluFoii(ws, [
    autoritate,
    filtru.sectie ? `Punct de lucru: ${filtru.sectie}` : 'Toate punctele de lucru',
    `${randuri.length} dispozitive`,
    `generat ${new Date().toLocaleString('ro-RO')}`,
  ].filter(Boolean).join('  •  '), COL);
  aer(ws);

  /*
   * Cifrele de sus sunt cele dupa care se intreaba la un control: cate
   * aparate sunt, cate au buletinul expirat, cate n-au niciun buletin desi
   * le trebuie, cate n-au nicio lucrare de mentenanta in evidenta.
   */
  const cuMetrologie = randuri.filter(d => d.metrologyRequired);
  bandaDeSocoteli(ws, [
    { eticheta: 'DISPOZITIVE', valoare: randuri.length, culoare: ALBASTRU },
    { eticheta: 'IN UTILIZARE', valoare: randuri.filter(d => d.status !== DeviceStatus.RETIRED).length, culoare: VERDE },
    { eticheta: 'SUPUSE METROLOGIEI', valoare: cuMetrologie.length, culoare: CENUSIU },
    { eticheta: 'BULETIN EXPIRAT', valoare: cuMetrologie.filter(d => expirat(d.metrologyExpiry)).length, culoare: ROSU },
    { eticheta: 'FARA BULETIN', valoare: cuMetrologie.filter(d => !d.metrologyExpiry).length, culoare: CHIHLIMBAR },
    { eticheta: 'FARA MENTENANTA', valoare: randuri.filter(d => !(d.maintenanceHistory || []).length).length, culoare: CHIHLIMBAR },
  ]);
  aer(ws);

  const capulRegistrului = capulTabelului(ws, [
    '#', 'Denumirea dispozitivului', 'Producător', 'Model', 'Serie',
    'Nr. inventar', 'Cod SMIS', 'Categoria', 'Punct de lucru', 'Data achiziţiei',
    'Punere în funcţiune', 'Garanţia până la', 'Starea', 'Metrologie', 'Buletin nr.',
    'Buletin până la', 'Cerere până la', 'CNCAN până la', 'Ultima mentenanţă', 'Felul ei',
    'Executantul', 'Următoarea', 'Incid.', 'Mutări', 'Contract de service',
    'Observaţii',
  ]);

  randuri.forEach((d, i) => {
    const m = ultima(d.maintenanceHistory || []);
    const ale = ticheteLui.filter(t => t.deviceId === d.id);
    const mutari = (d.locationHistory || []).length;
    const k = contracteleAparatului(d, contracte)[0];
    const cerere = d.metrologyRequired ? ziuaCererii(d.metrologyExpiry || '') : '';

    randDeDate(ws, [
      i + 1, scris(d.name), scris(d.manufacturer), scris(d.model), scris(d.serialNumber),
      scris(d.inventoryNumber), scris(d.smisCode), scris(d.category), scris(d.department), scris(d.purchaseDate),
      d.commissioningDate || '', d.warrantyExpiration || '', DEVICE_STATUS_RO[d.status] || d.status || '',
      d.metrologyRequired ? 'Da' : 'Nu', d.metrologyCertificate || '',
      d.metrologyExpiry || '', cerere, d.cncanExpiry || '',
      m?.date || '', m ? (MAINTENANCE_TYPE_RO[m.type] || m.type) : '', m?.technician || '',
      d.nextMaintenanceDate || '', ale.length || '', mutari || '',
      k ? `${k.contractNumber || ''} ${k.provider || ''}`.trim() : '',
      d.notes || '',
    ], i, {
      1: { centrat: true, culoare: 'FF94A3B8' },
      2: { bold: true, rupe: true },
      5: { cod: true }, 6: { cod: true }, 7: { cod: true },
      10: { centrat: true }, 11: { centrat: true }, 12: { centrat: true },
      13: { centrat: true, bold: true, culoare: d.status === DeviceStatus.RETIRED ? CENUSIU : undefined },
      14: { centrat: true },
      /* Rosu la ce a trecut de termen: registrul trebuie sa arate singur ce
         nu e in regula, altfel nimeni nu se uita pe douazeci de coloane. */
      16: { centrat: true, bold: expirat(d.metrologyExpiry), culoare: expirat(d.metrologyExpiry) ? ROSU : undefined },
      17: { centrat: true, bold: expirat(cerere), culoare: expirat(cerere) ? ROSU : undefined },
      18: { centrat: true, bold: expirat(d.cncanExpiry), culoare: expirat(d.cncanExpiry) ? ROSU : undefined },
      19: { centrat: true }, 22: { centrat: true },
      23: { centrat: true }, 24: { centrat: true },
      25: { rupe: true }, 26: { rupe: true, culoare: 'FF475569' },
    });
  });
  inghetaSiFiltreaza(ws, capulRegistrului, randuri.length, COL);

  /* ── foaia 2: mutarile ── */
  const ws2 = wb.addWorksheet('Mutari', { pageSetup: PAGINA_PEISAJ });
  ws2.columns = [
    { width: 5 }, { width: 30 }, { width: 16 }, { width: 13 }, { width: 12 },
    { width: 24 }, { width: 24 }, { width: 44 },
  ];
  titluFoii(ws2, 'LOCUL DE UTILIZARE — MUTĂRILE INTERNE', 8);
  subtitluFoii(ws2, 'Un rând pe mutare, cel mai nou primul. Aparatele fără nicio mutare nu apar aici.', 8);
  aer(ws2);
  const capMutari = capulTabelului(ws2, ['#', 'Dispozitivul', 'Serie', 'Nr. inventar', 'Data', 'De la', 'La', 'Motivul']);

  let nrMutari = 0;
  for (const d of randuri) {
    if (!(d.locationHistory || []).length) continue;
    for (const l of istoriculLocurilor(d)) {
      randDeDate(ws2, [
        ++nrMutari, scris(d.name), scris(d.serialNumber), scris(d.inventoryNumber),
        l.date || '', l.from || '', l.department || '', l.note || '',
      ], nrMutari - 1, {
        1: { centrat: true, culoare: 'FF94A3B8' }, 2: { bold: true, rupe: true },
        3: { cod: true }, 4: { cod: true }, 5: { centrat: true }, 8: { rupe: true, culoare: 'FF475569' },
      });
    }
  }
  inghetaSiFiltreaza(ws2, capMutari, nrMutari, 8);

  /* ── foaia 3: mentenanta si verificarile ── */
  const ws3 = wb.addWorksheet('Mentenanta si verificari', { pageSetup: PAGINA_PEISAJ });
  ws3.columns = [
    { width: 5 }, { width: 30 }, { width: 16 }, { width: 13 }, { width: 20 },
    { width: 12 }, { width: 18 }, { width: 24 }, { width: 46 }, { width: 13 }, { width: 13 },
  ];
  titluFoii(ws3, 'MENTENANŢA ŞI VERIFICĂRILE', 11);
  subtitluFoii(ws3, 'Un rând pe lucrare, cea mai nouă prima.', 11);
  aer(ws3);
  const capM = capulTabelului(ws3, [
    '#', 'Dispozitivul', 'Serie', 'Nr. inventar', 'Punct de lucru',
    'Data', 'Felul', 'Executantul', 'Ce s-a făcut', 'Starea', 'Următoarea',
  ]);

  const lucrari = randuri
    .flatMap(d => (d.maintenanceHistory || []).map(m => ({ d, m })))
    .sort((a, b) => (b.m.date || '').localeCompare(a.m.date || ''));
  lucrari.forEach((x, i) => {
    randDeDate(ws3, [
      i + 1, scris(x.d.name), scris(x.d.serialNumber), scris(x.d.inventoryNumber), scris(x.d.department),
      x.m.date || '', MAINTENANCE_TYPE_RO[x.m.type] || x.m.type || '', x.m.technician || '',
      x.m.description || '', x.m.completed ? 'Finalizată' : 'În lucru', x.m.nextScheduledDate || '',
    ], i, {
      1: { centrat: true, culoare: 'FF94A3B8' }, 2: { bold: true, rupe: true },
      3: { cod: true }, 4: { cod: true }, 6: { centrat: true }, 9: { rupe: true, culoare: 'FF475569' },
      10: { centrat: true, bold: true, culoare: x.m.completed ? VERDE : CHIHLIMBAR },
      11: { centrat: true },
    });
  });
  inghetaSiFiltreaza(ws3, capM, lucrari.length, 11);

  /* ── foaia 4: incidentele si defectiunile ── */
  const ws4 = wb.addWorksheet('Incidente si defectiuni', { pageSetup: PAGINA_PEISAJ });
  ws4.columns = [
    { width: 5 }, { width: 30 }, { width: 16 }, { width: 13 }, { width: 20 },
    { width: 12 }, { width: 32 }, { width: 46 }, { width: 14 }, { width: 12 },
  ];
  titluFoii(ws4, 'INCIDENTE ŞI DEFECŢIUNI SEMNALATE', 10);
  subtitluFoii(ws4, 'Tichetele de service deschise pe dispozitivele din registru, cel mai nou primul.', 10);
  aer(ws4);
  const capI = capulTabelului(ws4, [
    '#', 'Dispozitivul', 'Serie', 'Nr. inventar', 'Punct de lucru',
    'Deschis la', 'Ce s-a semnalat', 'Descrierea', 'Starea', 'Termen',
  ]);

  const dupaId = new Map(randuri.map(d => [d.id, d]));
  const incidente = [...ticheteLui].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  incidente.forEach((t, i) => {
    const d = dupaId.get(t.deviceId!);
    randDeDate(ws4, [
      i + 1, scris(d?.name) || scris(t.deviceName), scris(d?.serialNumber), scris(d?.inventoryNumber),
      scris(t.department) || scris(d?.department), (t.createdAt || '').slice(0, 10),
      t.title || '', t.description || '', TASK_STATUS_RO[t.status] || t.status || '', t.dueDate || '',
    ], i, {
      1: { centrat: true, culoare: 'FF94A3B8' }, 2: { bold: true, rupe: true },
      3: { cod: true }, 4: { cod: true }, 6: { centrat: true },
      7: { rupe: true }, 8: { rupe: true, culoare: 'FF475569' },
      9: { centrat: true, bold: true, culoare: t.status === TaskStatus.COMPLETED ? VERDE : ALBASTRU },
      10: { centrat: true },
    });
  });
  inghetaSiFiltreaza(ws4, capI, incidente.length, 10);

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

/** Numele fisierului: registrul, punctul de lucru si ziua. */
export const numeleRegistrului = (sectie?: string): string => {
  const parti = ['Registru-evidenta', sectie, new Date().toISOString().split('T')[0]]
    .filter(Boolean)
    .map(p => String(p).replace(/[^\p{L}\p{N} _.-]/gu, '').trim().replace(/\s+/g, '-'))
    .filter(Boolean);
  return `${parti.join('_')}.xlsx`;
};
