import { Referat, ReferatItem } from '../types';
import { COTA_TVA, cuTva } from './tva';

/**
 * Documentul de fundamentare scos din referatul care l-a cerut.
 *
 * Cele doua hartii spun in mare acelasi lucru, la doua zile distanta: referatul
 * cere si arata de ce, fundamentarea angajeaza banii pentru acelasi lucru.
 * Obiectul e acelasi, sectia e aceeasi, aparatele sunt aceleasi, firma si
 * oferta sunt aceleasi, iar suma e chiar totalul pozitiilor din referat. Pana
 * acum, cine facea fundamentarea le scria pe toate a doua oara, dintr-o hartie
 * deschisa alaturi — si de acolo veneau nepotrivirile dintre ele: o suma
 * rotunjita altfel, un obiect scris cu alte cuvinte, un aparat uitat.
 *
 * Aici se trece o data, din referat. Nimic nu se salveaza singur: formularul se
 * deschide completat si se schimba orice, fiindca raman lucruri pe care numai
 * omul le stie — numarul de inregistrare, codul SSI, ce anume s-a negociat
 * intre timp.
 *
 * Ce nu vine de aici nu se inventeaza. Numarul unic de inregistrare il da
 * registratura, nu aplicatia; valoarea precedenta e zero fiindca o fundamentare
 * pornita dintr-un referat e prima revizie a ei.
 */

const fmt = (n: number) => n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Cum s-a ajuns la suma, scris ca pe documentele reale: "1x 3.226,67", iar cand
 * referatul are mai multe pozitii, "2x 1.210,00 + 4x 302,50".
 *
 * E singurul rand din tabelul de valori care arata socoteala; scris de mana, el
 * e primul care nu mai corespunde cu totalul. Preturile sunt cele cu TVA, ca sa
 * se poata inmulti si aduna pe hartie si sa iasa fix valoarea din tabel.
 */
export const parametriiDinPozitii = (pozitii: ReferatItem[] = [], cota = COTA_TVA): string =>
  pozitiiScrise(pozitii, cota)
    .map(p => `${p.bucati}x ${fmt(p.pret)}`)
    .join(' + ');

/** Pozitiile care ajung pe hartie, cu pretul rotunjit o singura data. */
const pozitiiScrise = (pozitii: ReferatItem[] = [], cota = COTA_TVA) =>
  pozitii
    .filter(p => (p.name || '').trim())
    .map(p => ({ bucati: p.quantity || 0, pret: cuTva(p.unitPrice || 0, cota) }));

/**
 * Totalul cu TVA, adunat din pozitiile scrise pe hartie.
 *
 * Se aduna preturile deja rotunjite, nu se pune TVA peste total: altfel randul
 * cu parametrii ar spune o suma, iar tabelul alta, cu cativa bani diferenta, si
 * cine verifica hartia n-ar sti pe care sa creada.
 */
export const totalCuTva = (r: Referat, cota = COTA_TVA): number => {
  const scrise = pozitiiScrise(r.items, cota);
  if (!scrise.length) return cuTva(r.estimatedValue || 0, cota);
  return Math.round(scrise.reduce((s, p) => s + p.bucati * p.pret, 0) * 100) / 100;
};

/** Campurile fundamentarii care se pot lua din referat. */
export interface ZestreaReferatului {
  referatId: string;
  deviceIds: string[];
  subject: string;
  shortDescription: string;
  description: string;
  compartment: string;
  budgetArticle: string;
  element: string;
  parameters: string;
  previousValue: number;
  influence: number;
  /** Cota cu care s-a socotit suma. Se scrie pe document, ca sa se stie. */
  vatRate: number;
  currency: string;
  supplier: string;
  referenceNumber: string;
}

/**
 * Referatul estimeaza fara TVA — asa scrie pe el, si asa se compara ofertele.
 * Fundamentarea angajeaza banii care chiar ies din buget, adica cu TVA. Pana
 * acum trecerea dintre cele doua se facea in cap sau pe telefon, si se facea la
 * fiecare hartie.
 */
export const fundamentareaDinReferat = (r: Referat, cota = COTA_TVA): ZestreaReferatului => {
  const total = totalCuTva(r, cota);
  return {
    referatId: r.id,
    deviceIds: [...(r.deviceIds || [])],
    subject: r.subject || '',
    /* Punctul 2 e descrierea pe scurt, si pe hartie e chiar obiectul achizitiei. */
    shortDescription: r.subject || '',
    /* Punctul 3 e starea de fapt si de drept — adica justificarea referatului. */
    description: r.justification || '',
    /* Compartimentul de specialitate e cel care a emis referatul. */
    compartment: r.issuedBy || '',
    budgetArticle: r.budgetArticle || '',
    /* Coloana 1 din tabelul de valori: pe o reparatie scrie chiar obiectul. */
    element: r.subject || '',
    parameters: parametriiDinPozitii(r.items, cota),
    previousValue: 0,
    influence: total,
    vatRate: cota,
    currency: r.currency || 'RON',
    supplier: r.offerProvider || '',
    referenceNumber: r.offerNumbers || '',
  };
};
