import { MedicalDevice, DeviceStatus } from '../types';
import { ziuaCererii, LUNI_INAINTE_DE_CERERE } from './termene';
import { scris } from './loctiitori';
import {
  titluFoii, subtitluFoii, aer, capulTabelului, randDeDate, inghetaSiFiltreaza,
  bandaDeSocoteli, PAGINA_PEISAJ, ALBASTRU, ROSU, VERDE, CHIHLIMBAR, CENUSIU,
} from './excelStil';

/**
 * Planul anual al verificarilor periodice.
 *
 * Verificarile metrologice si autorizatiile nu vin toate deodata: vin cate
 * cateva in fiecare luna, imprastiate peste an dupa cand a fost verificat
 * fiecare aparat ultima oara. Cine trebuie sa le tina pe toate le afla una
 * cate una, din alarma care suna cu cateva saptamani inainte — adica prea
 * tarziu ca sa le poata grupa, sa ceara un pret pe zece aparate in loc de
 * zece preturi, sau sa trimita o singura cerere.
 *
 * Planul le aseaza pe luni, pe tot anul, si langa fiecare pune ziua in care
 * trebuie depusa cererea. Asa se vede dintr-o privire ca in martie expira
 * patru buletine, deci in septembrie trebuie depusa o cerere pentru toate
 * patru — si asta e intrebarea care conteaza, nu cea despre martie.
 *
 * Doua feluri de termene intra in plan: buletinele de verificare metrologica
 * si autorizatiile CNCAN. Sunt lucruri diferite, cerute de autoritati
 * diferite, dar pentru cel care face planul sunt acelasi lucru: o hartie care
 * expira si o cerere care trebuie depusa inainte.
 */

export type FelVerificare = 'metrologie' | 'cncan';

export const NUMELE_LUNILOR = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];

export interface RandDePlan {
  device: MedicalDevice;
  fel: FelVerificare;
  /** Ziua in care expira hartia. */
  expira: string;
  /** Ziua pana la care trebuie depusa cererea. */
  cerere: string;
  /** Luna expirarii, 0–11. */
  luna: number;
}

export interface PlanulAnului {
  an: number;
  /** Cate douasprezece, chiar si goale: o luna goala e o informatie. */
  peLuni: RandDePlan[][];
  /**
   * Aparatele supuse verificarii carora nu li se stie termenul.
   *
   * Nu intra in nicio luna, si tocmai de asta trebuie scrise separat: altfel
   * un plan cu patruzeci de randuri ar parea complet, cand de fapt mai sunt
   * doisprezece aparate despre care nu se stie nimic.
   */
  faraTermen: { device: MedicalDevice; fel: FelVerificare }[];
}

const anul = (iso?: string): number | null => {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Number(m[1]) : null;
};

const luna = (iso: string): number => Number(iso.slice(5, 7)) - 1;

/**
 * Planul unui an.
 *
 * Aparatele casate nu intra: nu se mai verifica nimic la un aparat scos din
 * uz, si un plan umflat cu ele l-ar face pe cel care il citeste sa nu mai aiba
 * incredere in el.
 */
export const planulAnului = (devices: MedicalDevice[], an: number): PlanulAnului => {
  const peLuni: RandDePlan[][] = Array.from({ length: 12 }, () => []);
  const faraTermen: PlanulAnului['faraTermen'] = [];

  for (const d of devices) {
    if (d.status === DeviceStatus.RETIRED) continue;

    const feluri: { fel: FelVerificare; cerut: boolean; data?: string }[] = [
      { fel: 'metrologie', cerut: !!d.metrologyRequired, data: d.metrologyExpiry },
      { fel: 'cncan', cerut: !!d.isCNCAN, data: d.cncanExpiry },
    ];

    for (const f of feluri) {
      if (!f.cerut) continue;
      const a = anul(f.data);
      if (a === null) { faraTermen.push({ device: d, fel: f.fel }); continue; }
      if (a !== an) continue;
      peLuni[luna(f.data!)].push({
        device: d, fel: f.fel, expira: f.data!, cerere: ziuaCererii(f.data!), luna: luna(f.data!),
      });
    }
  }

  for (const l of peLuni) {
    l.sort((a, b) => a.expira.localeCompare(b.expira)
      || (a.device.department || '').localeCompare(b.device.department || '', 'ro')
      || (a.device.name || '').localeCompare(b.device.name || '', 'ro'));
  }
  faraTermen.sort((a, b) => (a.device.department || '').localeCompare(b.device.department || '', 'ro'));

  return { an, peLuni, faraTermen };
};

/** Cate verificari sunt in tot planul. */
export const catePlanificate = (plan: PlanulAnului): number =>
  plan.peLuni.reduce((n, l) => n + l.length, 0);

/**
 * Lunile in care trebuie depuse cereri, cu cate.
 *
 * E cealalta citire a aceluiasi plan, si cea care foloseste: nu "in martie
 * expira patru", ci "in septembrie am de depus patru cereri".
 */
export const cereriPeLuni = (plan: PlanulAnului): { luna: number; an: number; cate: number }[] => {
  const cate = new Map<string, number>();
  for (const l of plan.peLuni) {
    for (const r of l) {
      if (!r.cerere) continue;
      const cheie = r.cerere.slice(0, 7);
      cate.set(cheie, (cate.get(cheie) || 0) + 1);
    }
  }
  return [...cate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cheie, n]) => ({ an: Number(cheie.slice(0, 4)), luna: Number(cheie.slice(5, 7)) - 1, cate: n }));
};

const ETICHETA_FEL: Record<FelVerificare, string> = {
  metrologie: 'Verificare metrologică',
  cncan: 'Autorizaţie CNCAN',
};

const azi = () => new Date().toISOString().split('T')[0];

export const planVerificariExcel = async (
  plan: PlanulAnului,
  autoritate = '',
): Promise<Blob> => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Biomedic';
  wb.created = new Date();

  const COL = 11;
  const ws = wb.addWorksheet(`Plan ${plan.an}`, { pageSetup: PAGINA_PEISAJ });
  ws.columns = [
    { width: 14 }, { width: 5 }, { width: 32 }, { width: 18 }, { width: 16 },
    { width: 13 }, { width: 22 }, { width: 22 }, { width: 14 }, { width: 14 }, { width: 22 },
  ];

  titluFoii(ws, `PLANUL ANUAL AL VERIFICĂRILOR PERIODICE — ${plan.an}`, COL);
  subtitluFoii(ws, [
    autoritate,
    `${catePlanificate(plan)} verificări planificate`,
    `cererea se depune cu ${LUNI_INAINTE_DE_CERERE} luni înainte`,
    `generat ${new Date().toLocaleString('ro-RO')}`,
  ].filter(Boolean).join('  •  '), COL);
  aer(ws);

  const intarziate = plan.peLuni.flat().filter(r => r.cerere && r.cerere < azi());
  bandaDeSocoteli(ws, [
    { eticheta: 'VERIFICARI IN AN', valoare: catePlanificate(plan), culoare: ALBASTRU },
    { eticheta: 'METROLOGIE', valoare: plan.peLuni.flat().filter(r => r.fel === 'metrologie').length, culoare: CENUSIU },
    { eticheta: 'CNCAN', valoare: plan.peLuni.flat().filter(r => r.fel === 'cncan').length, culoare: CENUSIU },
    { eticheta: 'CERERI INTARZIATE', valoare: intarziate.length, culoare: ROSU },
    { eticheta: 'FARA TERMEN STIUT', valoare: plan.faraTermen.length, culoare: CHIHLIMBAR },
  ]);
  aer(ws);

  const cap = capulTabelului(ws, [
    'Luna', '#', 'Dispozitivul', 'Producător / model', 'Serie',
    'Nr. inventar', 'Punct de lucru', 'Felul verificării', 'Expiră la', 'Cerere până la', 'Laboratorul',
  ]);

  let i = 0;
  plan.peLuni.forEach((randuri, l) => {
    /* O luna goala se scrie, nu se sare: "in august nu e nimic" e o
       informatie, iar un plan din care lipsesc luni pare neterminat. */
    if (!randuri.length) {
      randDeDate(ws, [NUMELE_LUNILOR[l], '', '— nicio verificare —', '', '', '', '', '', '', '', ''], i++, {
        1: { bold: true, centrat: true, culoare: CENUSIU },
        3: { culoare: 'FF94A3B8' },
      });
      return;
    }
    randuri.forEach((r, k) => {
      const tarziu = !!r.cerere && r.cerere < azi();
      randDeDate(ws, [
        k === 0 ? NUMELE_LUNILOR[l] : '', k + 1, scris(r.device.name),
        [scris(r.device.manufacturer), scris(r.device.model)].filter(Boolean).join(' '),
        scris(r.device.serialNumber), scris(r.device.inventoryNumber), scris(r.device.department),
        ETICHETA_FEL[r.fel], r.expira, r.cerere || '',
        r.fel === 'metrologie' ? (r.device.metrologyLab || '') : 'CNCAN',
      ], i++, {
        1: { bold: true, culoare: ALBASTRU },
        2: { centrat: true, culoare: 'FF94A3B8' },
        3: { bold: true, rupe: true },
        5: { cod: true }, 6: { cod: true },
        8: { centrat: true, culoare: r.fel === 'cncan' ? CHIHLIMBAR : CENUSIU },
        9: { centrat: true },
        10: { centrat: true, bold: tarziu, culoare: tarziu ? ROSU : VERDE },
      });
    });
  });

  /*
   * Aparatele fara termen stiut, la sfarsit si cu un cap al lor. Sunt partea
   * din plan care cere o fapta imediata: nu se poate planifica o verificare
   * despre care nu se stie cand expira.
   */
  if (plan.faraTermen.length) {
    aer(ws);
    const cap2 = capulTabelului(ws, [
      'FĂRĂ TERMEN', '#', 'Dispozitivul', 'Producător / model', 'Serie',
      'Nr. inventar', 'Punct de lucru', 'Felul verificării', '—', '—', 'De verificat',
    ]);
    plan.faraTermen.forEach((f, k) => {
      randDeDate(ws, [
        '', k + 1, scris(f.device.name),
        [scris(f.device.manufacturer), scris(f.device.model)].filter(Boolean).join(' '),
        scris(f.device.serialNumber), scris(f.device.inventoryNumber), scris(f.device.department),
        ETICHETA_FEL[f.fel], '', '', 'Nu se ştie data expirării',
      ], k, {
        2: { centrat: true, culoare: 'FF94A3B8' }, 3: { bold: true, rupe: true },
        5: { cod: true }, 6: { cod: true }, 8: { centrat: true },
        11: { bold: true, culoare: CHIHLIMBAR, rupe: true },
      });
    });
    void cap2;
  }

  inghetaSiFiltreaza(ws, cap, i, COL);

  /* ── foaia 2: lunile in care se depun cererile ── */
  const ws2 = wb.addWorksheet('Cand se depun cererile');
  ws2.columns = [{ width: 24 }, { width: 16 }, { width: 60 }];
  titluFoii(ws2, 'LUNILE ÎN CARE SE DEPUN CERERILE', 3);
  subtitluFoii(ws2, 'Aceleaşi verificări, citite invers: nu când expiră, ci când e de depus cererea.', 3);
  aer(ws2);
  const capC = capulTabelului(ws2, ['Luna', 'Câte cereri', 'Pentru ce expiră']);
  const cereri = cereriPeLuni(plan);
  cereri.forEach((c, k) => {
    const pentru = plan.peLuni.flat()
      .filter(r => r.cerere.slice(0, 7) === `${c.an}-${String(c.luna + 1).padStart(2, '0')}`)
      .map(r => `${scris(r.device.name)}${scris(r.device.serialNumber) ? ` (${scris(r.device.serialNumber)})` : ''} — ${r.expira}`)
      .join('\n');
    const tarziu = `${c.an}-${String(c.luna + 1).padStart(2, '0')}` < azi().slice(0, 7);
    randDeDate(ws2, [`${NUMELE_LUNILOR[c.luna]} ${c.an}`, c.cate, pentru], k, {
      1: { bold: true, culoare: tarziu ? ROSU : ALBASTRU },
      2: { centrat: true, bold: true },
      3: { rupe: true, culoare: 'FF475569' },
    });
  });
  inghetaSiFiltreaza(ws2, capC, cereri.length, 3);

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

export const numelePlanului = (an: number): string => `Plan-verificari_${an}.xlsx`;
