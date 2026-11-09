import {
  MedicalDevice, MedicalTask, Referat, FoundationDoc, Invoice, Contract, DeviceFile,
  DEVICE_STATUS_RO, TASK_STATUS_RO, MAINTENANCE_TYPE_RO, REFERAT_STATUS_RO,
  FOUNDATION_DOC_RO, normaliseFoundationType,
} from '../types';
import { par, gol, tabel, construieste, dataRo, suma, Cell } from './docx';
import { ziuaCererii, LUNI_INAINTE_DE_CERERE } from './termene';
import { dosarulAparatului, contracteleAparatului } from './dosarAparat';
import { AntetInstitutie } from './antet';
import { scris } from './loctiitori';

/**
 * Fisa dispozitivului medical, ca document.
 *
 * Tot ce stie aplicatia despre un aparat e deja pe ecranul lui: identificarea,
 * termenele, mentenanta, tichetele, documentele, hartiile de achizitie. Dar
 * ecranul nu se poate pune intr-un dosar si nu se poate semna. Cand vine
 * controlul si cere fisa aparatului, sau cand sectia o cere la predare, cineva
 * o scria de mana intr-un Word, uitandu-se pe ecran si copiind — si de acolo
 * veneau fisele care nu seamana intre ele si cele care rateaza jumatate din
 * istoric.
 *
 * Aici iese dintr-o apasare, cu tot ce e in evidenta, in ordinea in care o cere
 * cineva care o citeste: ce e aparatul, de cand, unde, ce s-a facut pe el, ce
 * hartii il privesc. Ce lipseste din evidenta lipseste si din fisa, scris
 * limpede "—", nu ascuns: o rubrica goala e o informatie, nu o scapare.
 *
 * Documentul se deschide in Word si se completeaza mai departe de mana — sunt
 * lucruri pe care numai omul le stie, de la numarul de inregistrare pana la
 * cine a predat si cine a primit aparatul.
 *
 * Diacriticele sunt corecte in document, chiar daca interfata scrie fara ele:
 * unul e un act care se semneaza, celalalt e un ecran.
 */

const A4 = 9638; // dxa disponibili intre margini pe A4 portret

/**
 * Rubrica goala se scrie, nu se sare: cititorul trebuie sa vada ca lipseste.
 *
 * Trece prin `scris`, fiindca aplicatia umple golurile cu "N/A" si
 * "Unassigned" ca ecranul sa aiba ce arata. Pe o fisa care se semneaza, o
 * serie scrisa "N/A" e mai rea decat o liniuta: liniuta se vede ca lipsa.
 */
const ori = (v: unknown, implicit = '—'): string => scris(v) || implicit;

const UMBRA = 'EFEFEF';

/** Titlu de sectiune, numerotat ca pe formularele oficiale. */
const sectiune = (n: number, titlu: string): string =>
  par(`${n}. ${titlu}`, { bold: true, size: 11, after: 4 });

/** Doua coloane: rubrica si valoarea ei. Cel mai des folosit tipar din fisa. */
const rubrici = (randuri: [string, unknown][]): string =>
  tabel(randuri.map(([eticheta, valoare]) => [
    { text: eticheta, width: 3200, style: { bold: true, size: 10 }, shade: UMBRA },
    { text: ori(valoare), width: A4 - 3200, style: { size: 10 } },
  ]));

/** Cap de tabel cu umbra, ca sa se vada unde incep datele. */
const cap = (etichete: string[], latimi: number[]): Cell[] =>
  etichete.map((text, i) => ({ text, width: latimi[i], style: { bold: true, size: 9 }, shade: UMBRA }));

/**
 * Un tabel cu cap, sau un rand care spune ca nu e nimic.
 *
 * Un tabel cu cap si fara niciun rand sub el arata ca o scapare de tipar. Un
 * rand care scrie "Nu sunt inregistrari" spune ce trebuie: s-a cautat si nu
 * e nimic.
 */
const tabelSau = (etichete: string[], latimi: number[], randuri: Cell[][], nimic: string): string =>
  randuri.length
    ? tabel([cap(etichete, latimi), ...randuri])
    : tabel([cap(etichete, latimi), [{ text: nimic, span: etichete.length, width: A4, style: { italic: true, size: 9 } }]]);

const dupaData = (a?: string, b?: string) => (b || '').localeCompare(a || '');

/** Ce fel de hartie e, scris cum il stie omul din gramezile de pe fisa. */
const FELUL_HARTIEI: Record<DeviceFile['type'], string> = {
  manual: 'Manual tehnic',
  report: 'Raport de service',
  metrologie: 'Buletin de verificare',
  service: 'Document de service',
  achizitie: 'Document de achiziţie',
  image: 'Imagine',
  other: 'Alt document',
};

export interface ZestreaFisei {
  tasks?: MedicalTask[];
  referate?: Referat[];
  fundamentari?: FoundationDoc[];
  facturi?: Invoice[];
  /** Registrul de contracte: un contract poate acoperi aparatul si de acolo. */
  contracte?: Contract[];
  antet?: AntetInstitutie;
}

export const fisaAparatuluiDocx = async (
  device: MedicalDevice,
  zestre: ZestreaFisei = {},
): Promise<Blob> => {
  const { tasks = [], referate = [], fundamentari = [], facturi = [], contracte = [], antet = {} } = zestre;

  const dosar = dosarulAparatului(device.id, referate, fundamentari, facturi);
  const contracteLui = contracteleAparatului(device, contracte);
  const tichete = tasks
    .filter(t => t.deviceId === device.id)
    .sort((a, b) => dupaData(a.createdAt, b.createdAt));
  const mentenanta = [...(device.maintenanceHistory || [])].sort((a, b) => dupaData(a.date, b.date));
  const fisiere = [...(device.files || [])].sort((a, b) => dupaData(a.dateAdded, b.dateAdded));
  const mutari = [...(device.locationHistory || [])].sort((a, b) => dupaData(a.date, b.date));

  const corp: string[] = [];

  /* ── capul hartiei ── */
  if (antet.autoritate) corp.push(par(antet.autoritate, { bold: true, size: 10, after: 0 }));
  if (antet.issuedBy) corp.push(par(antet.issuedBy, { size: 10, after: 0 }));
  corp.push(gol());
  corp.push(par('FIŞA DISPOZITIVULUI MEDICAL', { bold: true, size: 14, align: 'center', after: 2 }));
  corp.push(par(ori(device.name), { bold: true, size: 12, align: 'center', after: 2 }));
  corp.push(par(
    [scris(device.inventoryNumber) && `Nr. inventar ${scris(device.inventoryNumber)}`,
     scris(device.serialNumber) && `Seria ${scris(device.serialNumber)}`].filter(Boolean).join(' · ') || ' ',
    { size: 10, align: 'center', after: 10 }));

  /* ── 1. identificare ── */
  corp.push(sectiune(1, 'IDENTIFICAREA DISPOZITIVULUI'));
  corp.push(rubrici([
    ['Denumirea', device.name],
    ['Categoria', device.category],
    ['Producătorul', device.manufacturer],
    ['Modelul', device.model],
    ['Seria', device.serialNumber],
    ['Nr. de inventar', device.inventoryNumber],
    ['Cod SMIS al proiectului', device.smisCode],
    ['Starea', DEVICE_STATUS_RO[device.status] || device.status],
    ['Etichete', (device.tags || []).join(', ')],
  ]));
  corp.push(gol());

  /* ── 2. punerea in functiune si termenele ── */
  corp.push(sectiune(2, 'PUNEREA ÎN FUNCŢIUNE ŞI TERMENELE'));
  /*
   * Cererea de verificare periodica sta aici, langa expirarea buletinului, nu
   * socotita in cap de cine citeste fisa: e termenul care se rateaza, si daca
   * nu e scris pe hartie nu-l vede nimeni.
   */
  const cerere = device.metrologyRequired ? ziuaCererii(device.metrologyExpiry || '') : '';
  corp.push(rubrici([
    ['Data achiziţiei', dataRo(device.purchaseDate)],
    ['Punerea în funcţiune', dataRo(device.commissioningDate)],
    ['Garanţia expiră la', dataRo(device.warrantyExpiration)],
    ['Secţia / locul de utilizare', device.department],
    ['Supus controlului metrologic', device.metrologyRequired ? 'Da' : 'Nu'],
    ['Buletin de verificare nr.', device.metrologyCertificate],
    ['Data verificării', dataRo(device.metrologyDate)],
    ['Buletinul este valabil până la', dataRo(device.metrologyExpiry)],
    [`Cererea de verificare se depune până la (cu ${LUNI_INAINTE_DE_CERERE} luni înainte)`, dataRo(cerere)],
    ['Laboratorul de verificare', device.metrologyLab],
    ['Autorizaţie CNCAN', device.isCNCAN ? 'Da' : 'Nu'],
    ['Autorizaţia CNCAN expiră la', dataRo(device.cncanExpiry)],
    ['Următoarea mentenanţă planificată', dataRo(device.nextMaintenanceDate)],
    ['Se introduce în licitaţia de service', device.serviceTender ? 'Da' : 'Nu'],
  ]));
  corp.push(gol());

  /* ── 3. locul de utilizare si mutarile ── */
  corp.push(sectiune(3, 'LOCUL DE UTILIZARE ŞI MUTĂRILE INTERNE'));
  corp.push(tabelSau(
    ['Data', 'Secţia / punctul de lucru'],
    [2200, A4 - 2200],
    mutari.map(m => [
      { text: dataRo(m.date), width: 2200, style: { size: 9 } },
      { text: ori(m.department), width: A4 - 2200, style: { size: 9 } },
    ]),
    `Nu sunt mutări înregistrate. Aparatul este în evidenţă la ${ori(device.department)}.`,
  ));
  corp.push(gol());

  /* ── 4. mentenanta si verificarile ── */
  corp.push(sectiune(4, 'MENTENANŢA ŞI VERIFICĂRILE'));
  corp.push(tabelSau(
    ['Data', 'Felul', 'Executantul', 'Ce s-a făcut', 'Starea'],
    [1300, 1700, 1900, 3438, 1300],
    mentenanta.map(m => [
      { text: dataRo(m.date), width: 1300, style: { size: 9 } },
      { text: ori(MAINTENANCE_TYPE_RO[m.type] || m.type), width: 1700, style: { size: 9 } },
      { text: ori(m.technician), width: 1900, style: { size: 9 } },
      { text: ori(m.description), width: 3438, style: { size: 9 } },
      { text: m.completed ? 'Finalizată' : 'În lucru', width: 1300, style: { size: 9 } },
    ]),
    'Nu sunt lucrări de mentenanţă înregistrate.',
  ));
  corp.push(gol());

  /* ── 5. tichetele de service ── */
  corp.push(sectiune(5, 'INTERVENŢII ŞI DEFECŢIUNI SEMNALATE'));
  corp.push(tabelSau(
    ['Deschis la', 'Ce s-a semnalat', 'Secţia', 'Starea'],
    [1500, 4738, 1900, 1500],
    tichete.map(t => [
      { text: dataRo((t.createdAt || '').slice(0, 10)), width: 1500, style: { size: 9 } },
      {
        text: [t.title, t.description].filter(Boolean).join(' — ').slice(0, 600),
        width: 4738, style: { size: 9 },
      },
      { text: ori(t.department), width: 1900, style: { size: 9 } },
      { text: ori(TASK_STATUS_RO[t.status] || t.status), width: 1500, style: { size: 9 } },
    ]),
    'Nu sunt intervenţii înregistrate.',
  ));
  corp.push(gol());

  /* ── 6. elementele componente ── */
  corp.push(sectiune(6, 'ELEMENTE COMPONENTE'));
  corp.push(tabelSau(
    ['Denumirea', 'Producătorul', 'Modelul', 'Seria'],
    [3038, 2200, 2200, 2200],
    (device.components || []).map(c => [
      { text: ori(c.name), width: 3038, style: { size: 9 } },
      { text: ori(c.manufacturer), width: 2200, style: { size: 9 } },
      { text: ori(c.model), width: 2200, style: { size: 9 } },
      { text: ori(c.serialNumber), width: 2200, style: { size: 9 } },
    ]),
    'Nu sunt elemente componente înregistrate separat.',
  ));
  corp.push(gol());

  /* ── 7. contractele care il acopera ── */
  corp.push(sectiune(7, 'CONTRACTE CARE ACOPERĂ DISPOZITIVUL'));
  corp.push(tabelSau(
    ['Nr. contract', 'Prestatorul', 'De la', 'Până la', 'Valoare anuală'],
    [2000, 2838, 1300, 1300, 2200],
    contracteLui.map(c => [
      { text: ori(c.contractNumber), width: 2000, style: { size: 9 } },
      { text: ori(c.provider), width: 2838, style: { size: 9 } },
      { text: dataRo(c.startDate), width: 1300, style: { size: 9 } },
      { text: dataRo(c.endDate), width: 1300, style: { size: 9 } },
      { text: `${suma(c.annualCost || 0)} lei`, width: 2200, style: { size: 9 } },
    ]),
    'Nu este acoperit de niciun contract înregistrat.',
  ));
  corp.push(gol());

  /* ── 8. documentele din dosar ── */
  corp.push(sectiune(8, 'DOCUMENTE ÎN DOSARUL DISPOZITIVULUI'));
  corp.push(tabelSau(
    ['Felul', 'Denumirea fişierului', 'Adăugat la', 'Valabil până la'],
    [2200, 3938, 1750, 1750],
    fisiere.map(f => [
      { text: ori(FELUL_HARTIEI[f.type] || f.type), width: 2200, style: { size: 9 } },
      { text: ori(f.name), width: 3938, style: { size: 9 } },
      { text: dataRo((f.dateAdded || '').slice(0, 10)), width: 1750, style: { size: 9 } },
      { text: f.validUntil ? dataRo(f.validUntil) : '—', width: 1750, style: { size: 9 } },
    ]),
    'Nu sunt documente încărcate.',
  ));
  corp.push(gol());

  /* ── 9. hartiile de achizitie ── */
  corp.push(sectiune(9, 'REFERATE, DOCUMENTE DE FUNDAMENTARE ŞI FACTURI'));
  const hartii: Cell[][] = [
    ...dosar.referate.map(r => [
      { text: 'Referat de necesitate', width: 2600, style: { size: 9 } },
      { text: ori(r.number), width: 1800, style: { size: 9 } },
      { text: dataRo(r.date), width: 1300, style: { size: 9 } },
      { text: ori(r.subject), width: 2538, style: { size: 9 } },
      { text: ori(REFERAT_STATUS_RO[r.status] || r.status), width: 1400, style: { size: 9 } },
    ]),
    ...dosar.fundamentari.map(d => [
      { text: ori(FOUNDATION_DOC_RO[normaliseFoundationType(d.type)] || 'Document de fundamentare'), width: 2600, style: { size: 9 } },
      { text: ori(d.number), width: 1800, style: { size: 9 } },
      { text: dataRo(d.date), width: 1300, style: { size: 9 } },
      { text: ori(d.subject), width: 2538, style: { size: 9 } },
      { text: `${suma(d.amount || 0)} ${d.currency || 'RON'}`, width: 1400, style: { size: 9 } },
    ]),
    ...dosar.facturi.map(f => [
      { text: 'Factură', width: 2600, style: { size: 9 } },
      { text: ori(f.invoiceNumber), width: 1800, style: { size: 9 } },
      { text: dataRo(f.issueDate), width: 1300, style: { size: 9 } },
      { text: ori(f.supplier), width: 2538, style: { size: 9 } },
      { text: `${suma(f.amount || 0)} ${f.currency || 'RON'}`, width: 1400, style: { size: 9 } },
    ]),
  ];
  corp.push(tabelSau(
    ['Felul hârtiei', 'Numărul', 'Data', 'Obiectul / furnizorul', 'Starea / suma'],
    [2600, 1800, 1300, 2538, 1400],
    hartii,
    'Nu sunt hârtii de achiziţie legate de acest dispozitiv.',
  ));
  corp.push(gol());

  /* ── 10. observatii ── */
  corp.push(sectiune(10, 'OBSERVAŢII'));
  corp.push(par(ori(device.notes, ' '), { size: 10, after: 16 }));

  /*
   * Doua semnaturi, fiindca fisa se predă: una a celui care a scos-o din
   * evidenta, una a celui care o primeste. Data generarii se scrie ca sa se
   * stie din ce zi e adevarata — o fisa de aparat imbatraneste.
   */
  corp.push(par(`Fişă generată din evidenţa tehnică la data de ${dataRo(new Date().toISOString().slice(0, 10))}.`,
    { size: 9, italic: true, after: 16 }));
  corp.push(tabel([[
    { text: 'Întocmit\n\n\n_______________________', width: A4 / 2, style: { size: 10, align: 'center' } },
    { text: 'Luat la cunoştinţă\n\n\n_______________________', width: A4 / 2, style: { size: 10, align: 'center' } },
  ]]));

  return construieste(corp.join(''));
};

/** Numele fisierului: aparatul si ziua, ca sa se gaseasca in folderul de descarcari. */
export const numeleFisei = (device: MedicalDevice): string => {
  const parti = ['Fisa', device.name, device.inventoryNumber || device.serialNumber]
    .filter(Boolean)
    .map(p => String(p).replace(/[^\p{L}\p{N} _.-]/gu, '').trim().replace(/\s+/g, '-'))
    .filter(Boolean);
  return `${parti.join('_')}.docx`;
};
