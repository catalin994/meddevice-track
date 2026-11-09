/**
 * Antetul institutiei, intr-un singur loc.
 *
 * Numele autoritatii contractante si al managerului se scriu o data si apoi se
 * repeta identic pe fiecare hartie care iese din aplicatie — referat,
 * fundamentare, fisa de aparat, registru. Statea retinut in formularul
 * referatului, de unde l-au luat apoi si celelalte documente prin aceeasi
 * cheie de localStorage scrisa a doua oara. Doua copii ale aceleiasi chei
 * inseamna ca o redenumire strica jumatate din hartii fara sa spuna nimeni.
 *
 * Sta pe dispozitiv, nu in sincronizare: numele spitalului e acelasi pentru
 * toata lumea, dar nu e o informatie care sa merite un drum la cloud ca sa se
 * tipareasca un document.
 */

export interface AntetInstitutie {
  autoritate?: string;
  manager?: string;
  issuedBy?: string;
  approvedBy?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export const CHEIE_ANTET = 'meditrack_referat_antet';

export const antetInstitutiei = (): AntetInstitutie => {
  try { return JSON.parse(localStorage.getItem(CHEIE_ANTET) || '{}') || {}; }
  catch { return {}; }
};

export const punAntetul = (a: AntetInstitutie) => {
  try { localStorage.setItem(CHEIE_ANTET, JSON.stringify(a)); } catch { /* antetul e o comoditate */ }
};
