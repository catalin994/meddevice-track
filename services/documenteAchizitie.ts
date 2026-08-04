import { Referat, FoundationDoc, FOUNDATION_DOC_RO, normaliseFoundationType, referatTotal } from '../types';
import { par, gol, tabel, construieste, dataRo, suma, Cell } from './docx';
import { completeazaSablon } from './sablonWord';
import { iaSablon } from './sabloane';

/**
 * Referatul de necesitate si documentul de fundamentare, asa cum arata pe
 * hartie.
 *
 * Structura, ordinea sectiunilor si textele fixe sunt luate din formularele
 * folosite de spital. Ce se schimba de la un act la altul vine din inregistrare;
 * restul e sablonul, scris aici o data.
 *
 * Diacriticele sunt corecte in document, chiar daca interfata aplicatiei
 * scrie fara ele: unul e un act oficial care se semneaza, celalalt e un ecran.
 */

/** Antetul institutiei — acelasi pe fiecare hartie a spitalului. */
export interface Antet {
  autoritate?: string;
  manager?: string;
}

const A4_LATIME = 9638; // dxa disponibili intre margini pe A4 portret

/**
 * Referatul in Word.
 *
 * Daca institutia si-a pus sablonul, se porneste de la el si se schimba doar
 * valorile — asa documentul iese identic cu hartia lor, cu sigla si antetul
 * ei. Fara sablon se deseneaza aici o varianta corecta, dar nu identica.
 */
export const referatDocx = async (r: Referat, antet: Antet = {}): Promise<Blob> => {
  const pozitii0 = r.items?.length
    ? r.items
    : [{ id: '1', name: r.subject, unit: 'Buc', quantity: 1, unitPrice: r.estimatedValue || 0, specs: '' }];

  const sablon = await iaSablon('referat');
  if (sablon) {
    return completeazaSablon(sablon, {
      valori: {
        autoritate: antet.autoritate || '',
        manager: antet.manager || '',
        emitent: r.issuedBy || '',
        data: dataRo(r.date),
        aprobat: r.approvedBy || '',
        obiect: r.subject || '',
        justificare: r.justification || '',
        oferte: r.offerProvider || r.offerNumbers
          ? `Se poate realiza conform ofertelor ataşate de firma ${r.offerProvider || ''}`
            + `${r.offerNumbers ? `, cu numărul ${r.offerNumbers}` : ''}`
          : '',
        articol: r.budgetArticle || '',
        total: suma(referatTotal(pozitii0 as any)),
        contact_nume: r.contactName || '',
        contact_functie: r.contactRole || '',
        contact_compartiment: r.issuedBy || '',
        contact_email: r.contactEmail || '',
        contact_telefon: r.contactPhone || '',
        sef: r.approvedBy || '',
      },
      randuri: pozitii0.map((p, i) => ({
        nr: String(i + 1),
        denumire: p.name,
        um: p.unit || 'Buc',
        cant: String(p.quantity ?? ''),
        pret: p.unitPrice ? suma(p.unitPrice) : '',
        valoare: p.unitPrice ? suma((p.quantity || 0) * p.unitPrice) : '',
        caracteristici: p.specs || '',
      })),
    });
  }

  const pozitii = r.items?.length
    ? r.items
    : [{ id: '1', name: r.subject, unit: 'Buc', quantity: 1, unitPrice: r.estimatedValue || 0, specs: '' }];
  const total = referatTotal(pozitii as any);

  // Nr | Denumire | UM | Cant | Pret unitar | Valoare | Caracteristici
  const L = [520, 3100, 620, 620, 1300, 1300, 2178];
  const cap = (t: string, i: number): Cell => ({
    text: t, width: L[i], shade: 'EDEDED', style: { bold: true, size: 9, align: 'center' },
  });

  const randuri: Cell[][] = [
    ['Nr. crt', 'Denumire produs', 'U.M.', 'Cant', 'Valoare unitară estimată lei fără TVA',
     'Valoare estimată lei fără TVA', 'Caracteristici tehnice'].map(cap),
    ['0', '1', '2', '3', '4', '5=3x4', '6'].map((t, i) => ({
      text: t, width: L[i], style: { size: 8, align: 'center', italic: true },
    })),
    ...pozitii.map((p, i) => ([
      { text: String(i + 1), width: L[0], style: { size: 9, align: 'center' as const } },
      { text: p.name, width: L[1], style: { size: 9 } },
      { text: p.unit || 'Buc', width: L[2], style: { size: 9, align: 'center' as const } },
      { text: String(p.quantity ?? ''), width: L[3], style: { size: 9, align: 'center' as const } },
      { text: p.unitPrice ? suma(p.unitPrice) : '', width: L[4], style: { size: 9, align: 'right' as const } },
      { text: p.unitPrice ? suma((p.quantity || 0) * p.unitPrice) : '', width: L[5], style: { size: 9, align: 'right' as const } },
      { text: p.specs || '', width: L[6], style: { size: 9 } },
    ])),
    [
      { text: '', width: L[0] },
      { text: 'Total', width: L[1], style: { bold: true, size: 9 } },
      { text: '', width: L[2] }, { text: '', width: L[3] }, { text: '', width: L[4] },
      { text: suma(total), width: L[5], style: { bold: true, size: 9, align: 'right' as const } },
      { text: '', width: L[6] },
    ],
  ];

  const corp = [
    par('APROBAT', { align: 'right', bold: true, size: 11, after: 0 }),
    par('MANAGER,', { align: 'right', bold: true, size: 11, after: 0 }),
    par(antet.manager || '', { align: 'right', size: 11, after: 12 }),

    par(`Autoritatea contractantă: ${antet.autoritate || ''}`, { size: 11, after: 0 }),
    par(`Emis de: ${r.issuedBy || ''}`, { size: 11, after: 0 }),
    par(`Data: ${dataRo(r.date)}`, { size: 11, after: 0 }),
    par(`Aprobat de: ${r.approvedBy || ''}`, { size: 11, after: 14 }),

    par('REFERAT DE NECESITATE', { align: 'center', bold: true, size: 14, after: 12 }),

    par('Vă rugăm să aprobați achiziționarea următoarelor (materiale/aparatură):', { size: 11 }),
    par(`Obiectul achiziţiei:    ${r.subject || ''}`, { bold: true, size: 11, after: 8 }),

    tabel(randuri),
    gol(),
    par('Notă:   Coloanele 4 şi 5 se vor completa doar dacă se cunosc valori estimate ale produselor',
        { size: 8, italic: true, after: 10 }),

    par('a) descrierea produsului / produselor ce se doresc / doreşte a fi achiziţionat / achiziţionate, '
      + 'cuprinzând şi eventuale date despre parametri tehnici, descriptivi, calitativi, cantitativi, etc. ai acestuia;',
      { size: 10 }),
    par(pozitii.map(p => `${p.name}${p.specs ? ` — ${p.specs}` : ''}`).join('\n'), { size: 10, after: 8 }),

    par('b) eventuale clauze contractuale considerate necesare a fi impuse: ex. condiţii de livrare, '
      + 'termene de livrare sau garanţie, etc.', { size: 10, after: 8 }),

    par('c) Fundamentaţi / specificaţi pentru ce şi în ce scop solicitaţi achiziţia', { size: 10 }),
    par(r.justification || '', { size: 11, align: 'both', after: 8 }),

    r.offerProvider || r.offerNumbers
      ? par(`Reparația se poate realiza conform ofertelor ataşate de firma ${r.offerProvider || ''}`
            + `${r.offerNumbers ? `, cu numărul ${r.offerNumbers}` : ''}`, { size: 11 })
      : '',
    r.budgetArticle
      ? par(`Articolul bugetar aferent achiziţiei este ${r.budgetArticle}`, { size: 11, after: 14 })
      : gol(),

    par('Referatul de necesitate', { bold: true, size: 11, after: 0 }),
    tabel([[
      { text: 'Are ataşat:', width: 3200, style: { size: 10 } },
      { text: 'Oferta de preţ', width: 3200, style: { size: 10 } },
      { text: r.offerNumbers ? 'x' : '', width: 3238, style: { size: 10, align: 'center' } },
    ]]),
    gol(),

    par('Persoana de contact în legătură cu informaţiile din acest Referat de necesitate, din secţia / '
      + 'compartimentul beneficiar al achiziţiei', { size: 10, after: 6 }),
    par(`Nume şi Prenume: ${r.contactName || ''}`, { size: 11, after: 0 }),
    par(`Funcţia: ${r.contactRole || ''}`, { size: 11, after: 0 }),
    par(`Denumirea secţiei / compartimentului: ${r.issuedBy || ''}`, { size: 11, after: 0 }),
    par(`Email: ${r.contactEmail || ''}`, { size: 11, after: 0 }),
    par(`Telefon: ${r.contactPhone || ''}`, { size: 11, after: 18 }),

    par('Şef secţie / compartiment', { align: 'right', size: 11, after: 0 }),
    par(r.approvedBy || '', { align: 'right', bold: true, size: 11 }),
  ].join('');

  return construieste(corp);
};

export const fundamentareDocx = async (d: FoundationDoc, referat?: Referat): Promise<Blob> => {
  const tip = FOUNDATION_DOC_RO[normaliseFoundationType(d.type)];
  const precedenta = d.previousValue || 0;
  const influenta = d.influence ?? ((d.amount || 0) - precedenta);
  const actualizata = d.amount ?? (precedenta + influenta);

  const sablon = await iaSablon('fundamentare');
  if (sablon) {
    return completeazaSablon(sablon, {
      valori: {
        obiect: d.subject || '',
        numar: d.number || '',
        data: dataRo(d.date),
        revizie: String(d.revision ?? 0),
        data_revizie: dataRo(d.revisionDate || d.date),
        compartiment: d.compartment || '',
        descriere: d.description || '',
        referinta: d.supplier || d.referenceNumber
          ? `Se realizează conform ofertei / contractului${d.supplier ? ` de la firma ${d.supplier}` : ''}`
            + `${d.referenceNumber ? `, cu numărul ${d.referenceNumber}` : ''}.`
          : '',
        articol: d.budgetArticle || '',
        element: tip,
        program: d.program || '',
        cod_ssi: d.ssiCode || '',
        parametri: d.parameters || '',
        val_precedenta: suma(precedenta),
        influenta: suma(influenta),
        val_actualizata: suma(actualizata),
      },
    });
  }

  // Element | Program | Cod SSI | Parametrii | Precedenta | Influente | Actualizata
  const L = [2300, 1500, 2100, 2100, 1900, 1600, 1900];
  const cap = (t: string, i: number): Cell => ({
    text: t, width: L[i], shade: 'EDEDED', style: { bold: true, size: 8, align: 'center' },
  });

  const valori: Cell[][] = [
    ['Element de fundamentare', 'Program', 'Cod SSI', 'Parametrii de fundamentare',
     'Valoare totală revizie precedentă (lei)', 'Influenţe +/– (lei)',
     'Valoare totală actualizată (lei)'].map(cap),
    ['1', '2', '3', '4', '5', '6', '7 = 5 + 6'].map((t, i) => ({
      text: t, width: L[i], style: { size: 8, align: 'center' as const, italic: true },
    })),
    [
      { text: tip, width: L[0], style: { size: 9 } },
      { text: d.program || '', width: L[1], style: { size: 9, align: 'center' as const } },
      { text: d.ssiCode || '', width: L[2], style: { size: 9, align: 'center' as const } },
      { text: d.parameters || '', width: L[3], style: { size: 9, align: 'center' as const } },
      { text: suma(precedenta), width: L[4], style: { size: 9, align: 'right' as const } },
      { text: suma(influenta), width: L[5], style: { size: 9, align: 'right' as const } },
      { text: suma(actualizata), width: L[6], style: { size: 9, align: 'right' as const } },
    ],
    [
      { text: 'TOTAL', width: L[0], style: { bold: true, size: 9 } },
      { text: 'X', width: L[1], style: { size: 9, align: 'center' as const } },
      { text: 'X', width: L[2], style: { size: 9, align: 'center' as const } },
      { text: 'X', width: L[3], style: { size: 9, align: 'center' as const } },
      { text: suma(precedenta), width: L[4], style: { bold: true, size: 9, align: 'right' as const } },
      { text: suma(influenta), width: L[5], style: { bold: true, size: 9, align: 'right' as const } },
      { text: suma(actualizata), width: L[6], style: { bold: true, size: 9, align: 'right' as const } },
    ],
  ];

  const semnaturi = (a: string, b: string): Cell[][] => ([
    [
      { text: a, width: 4819, style: { bold: true, size: 10, align: 'center' } },
      { text: b, width: 4819, style: { bold: true, size: 10, align: 'center' } },
    ],
    [
      { text: '\n\n', width: 4819 },
      { text: '\n\n', width: 4819 },
    ],
  ]);

  const corp = [
    par('DOCUMENT DE FUNDAMENTARE', { align: 'center', bold: true, size: 14, after: 2 }),
    par(d.subject || '', { align: 'center', bold: true, size: 12, after: 12 }),

    par(`Număr unic de înregistrare:  ${d.number || ''}${d.date ? `/${dataRo(d.date)}` : ''}`
      + `           revizuirea  ${d.revision ?? 0} / data  ${dataRo(d.revisionDate || d.date)}`,
      { size: 11, after: 10 }),

    par('Secţiunea A: Obiectul documentului de fundamentare', { bold: true, size: 12, after: 8 }),

    par(`1. Compartiment de specialitate:  ${d.compartment || ''}`, { size: 11 }),
    par(`2. Descrierea pe scurt a obiectului documentului de fundamentare / motivul revizuirii:  ${d.subject || ''}`,
      { size: 11 }),
    par('3. Descrierea pe larg a stării de fapt şi de drept:', { size: 11, after: 2 }),
    par(d.description || '', { size: 11, align: 'both' }),
    d.supplier || d.referenceNumber
      ? par(`Se realizează conform ofertei / contractului${d.supplier ? ` de la firma ${d.supplier}` : ''}`
            + `${d.referenceNumber ? `, cu numărul ${d.referenceNumber}` : ''}.`, { size: 11 })
      : '',
    d.budgetArticle
      ? par(`Articolul bugetar aferent achiziţiei este ${d.budgetArticle}`, { size: 11, after: 10 })
      : gol(),

    par('4. Valoarea angajamentelor legale (pe toată perioada de valabilitate a documentului de fundamentare):',
      { bold: true, size: 11, after: 6 }),
    tabel(valori),
    gol(),

    referat
      ? par(`Prezentul document susţine referatul de necesitate nr. ${referat.number} din ${dataRo(referat.date)} — ${referat.subject}.`,
            { size: 10, italic: true, after: 10 })
      : '',

    d.notes ? par(`Observaţii: ${d.notes}`, { size: 10, after: 10 }) : '',

    par('În baza celor prezentate la secţiunea A, avizăm în calitate de compartiment de specialitate',
      { size: 10, after: 6 }),
    tabel(semnaturi('Director medical / Director de îngrijiri', 'Serviciul Contabilitate')),
    gol(),
    tabel(semnaturi('Avizat', 'Întocmit')),
    gol(),

    par('Aprob cele prevăzute în prezentul document', { bold: true, size: 11, after: 6 }),
    tabel(semnaturi('Ordonator de credite', 'CFPP')),
  ].join('');

  return construieste(corp, true);
};

/** Nume de fisier fara caractere care sperie sistemul de fisiere. */
export const numeFisier = (parti: (string | undefined)[], ext = 'docx'): string => {
  const baza = parti.filter(Boolean).join('_')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 120);
  return `${baza || 'document'}.${ext}`;
};
