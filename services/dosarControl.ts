import { MedicalDevice, MedicalTask, Contract, Referat, FoundationDoc, Invoice } from '../types';
import { Pregatirea } from './pregatitControl';
import { registruEvidentaExcel, FiltruRegistru } from './registruEvidenta';
import { planulAnului, planVerificariExcel, catePlanificate } from './planVerificari';
import { fisaAparatuluiDocx, numeleFisei } from './fisaAparat';
import { PersoanaResponsabila } from './setari';
import { AntetInstitutie } from './antet';
import { scris } from './loctiitori';
import {
  titluFoii, subtitluFoii, aer, capulTabelului, randDeDate, inghetaSiFiltreaza,
  PAGINA_PEISAJ, ROSU, CENUSIU,
} from './excelStil';

/**
 * Dosarul de control, intr-un singur fisier.
 *
 * Cand se anunta un control, se strang aceleasi hartii de fiecare data:
 * registrul de evidenta, planul verificarilor, lista cu ce lipseste, fisele
 * aparatelor despre care se va intreba. Fiecare se scotea separat, din alt
 * ecran, si se puneau de mana intr-un folder — iar a doua zi, dupa ce se mai
 * incarca doua buletine, trebuiau scoase toate din nou ca sa fie la fel.
 *
 * Aici ies toate deodata, intr-un ZIP, cu un cuprins care spune ce e fiecare
 * si — mai important — ce nu e in el. Aplicatia stie ce s-a trecut in ea; nu
 * stie ce exista la dosar in realitate, si dosarul trebuie sa spuna asta
 * limpede, nu sa lase pe cineva sa creada ca e complet.
 */

export interface ZestreaDosarului {
  tasks?: MedicalTask[];
  contracte?: Contract[];
  referate?: Referat[];
  fundamentari?: FoundationDoc[];
  facturi?: Invoice[];
  antet?: AntetInstitutie;
  responsabil?: PersoanaResponsabila;
}

export interface CeIntraInDosar {
  /** Numai aparatele unui punct de lucru. Gol inseamna tot spitalul. */
  sectie?: string;
  /** Anul pentru care se scoate planul verificarilor. */
  an?: number;
  /**
   * Si fisele aparatelor, fiecare in Word.
   *
   * Se genereaza pe loc, fara niciun drum la retea, dar la doua mii de aparate
   * sunt doua mii de documente: se cere anume, nu se pune din oficiu.
   */
  cuFise?: boolean;
  /** Cand se cer fisele: numai ale aparatelor carora le lipseste ceva. */
  doarFiseleCuLipsuri?: boolean;
}

const curat = (s: string) => s.replace(/[^\p{L}\p{N} _.-]/gu, '').trim().replace(/\s+/g, '-') || 'fara-nume';

/** Lista lipsurilor, ca foaie de lucru: ce e de facut, pe aparate. */
const lipsuriExcel = async (p: Pregatirea, autoritate: string): Promise<Blob> => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Biomedic';
  wb.created = new Date();

  const COL = 8;
  const ws = wb.addWorksheet('Lipsuri', { pageSetup: PAGINA_PEISAJ });
  ws.columns = [
    { width: 5 }, { width: 34 }, { width: 32 }, { width: 18 }, { width: 14 },
    { width: 22 }, { width: 52 }, { width: 14 },
  ];
  titluFoii(ws, 'CE LIPSEŞTE DIN EVIDENŢĂ ÎNAINTE DE CONTROL', COL);
  subtitluFoii(ws, [
    autoritate,
    `${p.gata} din ${p.dinCate} cerinţe îndeplinite`,
    `${p.aparateCuLipsuri.length} dispozitive cu lipsuri din ${p.cateAparate}`,
    `generat ${new Date().toLocaleString('ro-RO')}`,
  ].filter(Boolean).join('  •  '), COL);
  aer(ws);

  const cap = capulTabelului(ws, [
    '#', 'Cerinţa', 'Dispozitivul', 'Producător / model', 'Serie',
    'Punct de lucru', 'Ce lipseşte', 'Nr. inventar',
  ]);

  let i = 0;
  for (const c of p.cerinte) {
    if (c.cerinta.peUnitate) {
      if (c.gata) continue;
      randDeDate(ws, [
        ++i, c.cerinta.titlu, '— priveşte unitatea, nu un dispozitiv —', '', '', '',
        c.cerinta.ce, '',
      ], i - 1, { 1: { centrat: true, culoare: 'FF94A3B8' }, 2: { bold: true, rupe: true, culoare: ROSU }, 3: { culoare: CENUSIU }, 7: { rupe: true } });
      continue;
    }
    for (const l of c.lipsuri) {
      randDeDate(ws, [
        ++i, c.cerinta.titlu, scris(l.device.name),
        [scris(l.device.manufacturer), scris(l.device.model)].filter(Boolean).join(' '),
        scris(l.device.serialNumber), scris(l.device.department), l.deCe, scris(l.device.inventoryNumber),
      ], i - 1, {
        1: { centrat: true, culoare: 'FF94A3B8' },
        2: { bold: true, rupe: true },
        3: { bold: true, rupe: true },
        5: { cod: true }, 8: { cod: true },
        7: { rupe: true, culoare: ROSU },
      });
    }
  }
  inghetaSiFiltreaza(ws, cap, i, COL);

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

/**
 * Cuprinsul dosarului.
 *
 * Partea care conteaza din el nu e lista fisierelor — e ce scrie la sfarsit:
 * ce nu e in dosar. Un dosar care tace despre ce-i lipseste il lasa pe cel
 * care il duce la control sa creada ca e complet.
 */
const cuprins = (
  p: Pregatirea, ce: CeIntraInDosar, autoritate: string, resp: PersoanaResponsabila,
  catePlan: number, cateFise: number,
): string => {
  const randuri: string[] = [];
  randuri.push('# Dosar pentru control — dispozitive medicale', '');
  if (autoritate) randuri.push(`**Unitatea:** ${autoritate}`);
  randuri.push(`**Punctul de lucru:** ${ce.sectie || 'toate'}`);
  randuri.push(`**Generat:** ${new Date().toLocaleString('ro-RO')}`);
  if (resp.nume) {
    randuri.push(`**Persoana responsabilă:** ${resp.nume}${resp.functie ? `, ${resp.functie}` : ''}`
      + (resp.decizieNumar ? ` — decizia nr. ${resp.decizieNumar}${resp.decizieData ? ` din ${resp.decizieData}` : ''}` : ''));
  }
  randuri.push('', '## Ce conţine', '');
  randuri.push('**01 Registru de evidenta.xlsx** — registrul dispozitivelor aflate în utilizare, cu patru foi: '
    + 'registrul propriu-zis (un rând pe dispozitiv), mutările interne, mentenanţa şi verificările, incidentele.');
  randuri.push(`**02 Plan verificari ${ce.an}.xlsx** — verificările metrologice şi autorizaţiile care expiră în ${ce.an}, `
    + `aşezate pe luni (${catePlan} în total), cu ziua până la care trebuie depusă cererea; a doua foaie le citeşte invers, `
    + 'pe lunile în care se depun cererile.');
  randuri.push('**03 Lipsuri la control.xlsx** — ce lipseşte din evidenţă, pe cerinţe şi pe dispozitive. '
    + 'E foaia de lucru, nu una de arătat.');
  if (cateFise) randuri.push(`**04 Fise dispozitive/** — ${cateFise} fişe în Word, una pe dispozitiv, cu tot istoricul lui.`);

  randuri.push('', '## Cum stă evidenţa acum', '');
  randuri.push(`${p.gata} din ${p.dinCate} cerinţe îndeplinite · `
    + `${p.aparateCuLipsuri.length} dispozitive cu lipsuri din ${p.cateAparate} aflate în utilizare.`, '');
  for (const c of p.cerinte) {
    const stare = c.cateIntrebate === 0 ? '— nu se aplică'
      : c.gata ? 'îndeplinită'
      /* Cerinţa care priveşte unitatea n-are dispozitive de numărat: scrisă cu
         „0 din 1 dispozitive", ar spune exact pe dos ce se întâmplă. */
      : c.cerinta.peUnitate ? '**neîndeplinită**'
      : `**${c.lipsuri.length} din ${c.cateIntrebate} dispozitive nu o îndeplinesc**`;
    randuri.push(`- ${c.cerinta.titlu}: ${stare}`);
  }

  randuri.push('', '## Ce NU e în dosarul acesta', '');
  randuri.push('Documentele scanate nu sunt incluse: buletinele de verificare, declaraţiile de conformitate, '
    + 'rapoartele de service, contractele şi facturile stau în aplicaţie, la dispozitivele lor, şi se descarcă de acolo.');
  randuri.push('');
  randuri.push('Decizia de numire a persoanei responsabile, procesele-verbale de punere în funcţiune şi de casare '
    + 'se generează separat şi se semnează; ele nu intră automat aici.');
  randuri.push('');
  randuri.push('**Dosarul arată ce s-a trecut în aplicaţie, nu ce există la dosar în realitate.** '
    + 'O cerinţă îndeplinită înseamnă că aplicaţia nu vede nimic lipsă, nu că actul există şi e valabil.');

  return randuri.join('\n');
};

export const dosarulDeControlZip = async (
  devices: MedicalDevice[],
  p: Pregatirea,
  ce: CeIntraInDosar = {},
  zestre: ZestreaDosarului = {},
  /** Se striga dupa fiecare pas, ca ecranul sa poata spune unde a ajuns. */
  pas?: (text: string) => void,
): Promise<Blob> => {
  const an = ce.an ?? new Date().getFullYear();
  const { tasks = [], contracte = [], referate = [], fundamentari = [], facturi = [], antet = {}, responsabil = {} } = zestre;
  const autoritate = antet.autoritate || '';

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const filtru: FiltruRegistru = { sectie: ce.sectie, faraCasate: true };

  pas?.('Scriu registrul de evidenţă...');
  zip.file('01 Registru de evidenta.xlsx',
    await registruEvidentaExcel(devices, filtru, { tasks, contracte, autoritate }));

  pas?.('Scriu planul verificărilor...');
  const plan = planulAnului(
    devices.filter(d => !ce.sectie || (d.department || '').trim().toLowerCase() === ce.sectie.trim().toLowerCase()),
    an);
  zip.file(`02 Plan verificari ${an}.xlsx`, await planVerificariExcel(plan, autoritate));

  pas?.('Scriu lista lipsurilor...');
  zip.file('03 Lipsuri la control.xlsx', await lipsuriExcel(p, autoritate));

  let cateFise = 0;
  if (ce.cuFise) {
    const cuLipsuri = new Set(p.aparateCuLipsuri.map(x => x.device.id));
    const alese = devices
      .filter(d => !ce.sectie || (d.department || '').trim().toLowerCase() === ce.sectie.trim().toLowerCase())
      .filter(d => !ce.doarFiseleCuLipsuri || cuLipsuri.has(d.id));
    const folder = zip.folder('04 Fise dispozitive')!;
    for (const d of alese) {
      cateFise++;
      pas?.(`Scriu fişele dispozitivelor (${cateFise} din ${alese.length})...`);
      folder.file(numeleFisei(d),
        await fisaAparatuluiDocx(d, { tasks, referate, fundamentari, facturi, contracte, antet }));
    }
  }

  pas?.('Scriu cuprinsul...');
  zip.file('CUPRINS.md', cuprins(p, { ...ce, an }, autoritate, responsabil, catePlanificate(plan), cateFise));

  pas?.('Împachetez dosarul...');
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
};

export const numeleDosarului = (sectie?: string): string =>
  `${['Dosar-control', sectie && curat(sectie), new Date().toISOString().split('T')[0]].filter(Boolean).join('_')}.zip`;
