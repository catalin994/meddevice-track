import { Referat, ReferatItem, referatTotal } from '../types';

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
 * referatul are mai multe pozitii, "2x 1.000,00 + 4x 250,00".
 *
 * E singurul rand din tabelul de valori care arata socoteala; scris de mana, el
 * e primul care nu mai corespunde cu totalul.
 */
export const parametriiDinPozitii = (pozitii: ReferatItem[] = []): string =>
  pozitii
    .filter(p => (p.name || '').trim())
    .map(p => `${p.quantity || 0}x ${fmt(p.unitPrice || 0)}`)
    .join(' + ');

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
  currency: string;
  supplier: string;
  referenceNumber: string;
}

export const fundamentareaDinReferat = (r: Referat): ZestreaReferatului => {
  const total = r.items?.length ? referatTotal(r.items) : (r.estimatedValue || 0);
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
    parameters: parametriiDinPozitii(r.items),
    previousValue: 0,
    influence: total,
    currency: r.currency || 'RON',
    supplier: r.offerProvider || '',
    referenceNumber: r.offerNumbers || '',
  };
};
