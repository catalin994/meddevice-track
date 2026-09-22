import { DeviceFile, MedicalDevice } from '../types';

/**
 * Pana cand tine o hartie.
 *
 * Buletinul de verificare metrologica, autorizatia, avizul — toate se termina
 * la o zi anume, iar aparatul cu buletinul expirat nu mai are voie sa fie
 * folosit. Data aia statea numai pe hartia scanata, adica trebuia deschis
 * documentul ca sa se afle, si nu se afla decat cand cineva se gandea sa se
 * uite. De obicei se gandea cineva din afara.
 *
 * Aici sta langa fisier, si se vede fara sa fie deschis.
 */

export type StareaValabilitatii = 'valabil' | 'aproape' | 'expirat';

export interface Valabilitate {
  /** Ziua pana la care tine, asa cum a fost scrisa: "2027-01-14". */
  pana: string;
  /** Cate zile mai sunt. Negativ cand a trecut. */
  zile: number;
  stare: StareaValabilitatii;
  /** Cum se scrie pe ecran, intr-o singura bucata. */
  text: string;
}

/** Cu cate zile inainte incepe sa fie o grija. O verificare se programeaza. */
export const PRAG_APROAPE = 30;

const ZI = 24 * 60 * 60 * 1000;

/** "2027-01-14" → "14.01.2027". Ziua ramane ziua, oriunde ar fi citita. */
export const zi = (data: string): string => {
  const [an, luna, z] = (data || '').split('-');
  return an && luna && z ? `${z}.${luna}.${an}` : data || '';
};

/**
 * Se socoteste in zile intregi, de la miezul noptii, nu din ceas.
 *
 * Altfel un buletin care tine pana azi ar iesi "expirat" la ora cinci
 * dupa-amiaza, desi ziua lui nu s-a terminat.
 */
export const valabilitatea = (pana?: string, azi = new Date()): Valabilitate | null => {
  if (!pana) return null;
  const capat = Date.parse(`${pana}T00:00:00`);
  if (Number.isNaN(capat)) return null;
  const acum = Date.UTC(azi.getFullYear(), azi.getMonth(), azi.getDate());
  const inceput = Date.UTC(
    new Date(capat).getUTCFullYear(), new Date(capat).getUTCMonth(), new Date(capat).getUTCDate());
  const zile = Math.round((inceput - acum) / ZI);

  const stare: StareaValabilitatii = zile < 0 ? 'expirat' : zile <= PRAG_APROAPE ? 'aproape' : 'valabil';
  const text =
    zile < 0 ? `expirat de ${cate(-zile)}`
    : zile === 0 ? 'expira azi'
    : stare === 'aproape' ? `expira in ${cate(zile)} — ${zi(pana)}`
    : `valabil pana la ${zi(pana)}`;

  return { pana, zile, stare, text };
};

/** "o zi", "3 zile", "24 de zile" — romana are regula ei dupa 19. */
const cate = (zile: number): string =>
  zile === 1 ? 'o zi' : zile % 100 > 19 || zile % 100 === 0 ? `${zile} de zile` : `${zile} zile`;

/**
 * Hartia in vigoare dintr-o gramada: cea care tine cel mai departe.
 *
 * Intai am socotit-o pe ultima incarcata, si era gresit. Buletinele se urca
 * aproape intotdeauna deodata, tot teancul dintr-un dosar, si atunci toate au
 * aceeasi zi de incarcare — iar dintre ele iesea la intamplare una din 2023.
 * Aparatul aparea expirat de 776 de zile cu buletinul valabil alaturi, pe
 * acelasi ecran.
 *
 * Buletinul in vigoare e, prin definitie, cel al carui termen n-a trecut; iar
 * cand toate au trecut, cel care a trecut cel mai tarziu — asta e starea de
 * fapt a aparatului. Deci: termenul cel mai indepartat. La termene egale,
 * ultima incarcata, ca sa iasa mereu aceeasi.
 */
export const hartiaInVigoare = (fisiere: DeviceFile[] = []): DeviceFile | null =>
  fisiere
    .filter(f => f.validUntil)
    .sort((a, b) => (b.validUntil || '').localeCompare(a.validUntil || '')
      || (b.dateAdded || '').localeCompare(a.dateAdded || '')
      || (b.id || '').localeCompare(a.id || ''))[0] || null;

/** De unde se stie termenul: de pe fisa aparatului sau de pe hartia din dosar. */
export interface TermenulVerificarii {
  pana: string;
  /** Adevarat cand vine de pe un document incarcat, nu din randul de pe fisa. */
  dinHartie: boolean;
  /** Numele hartiei, cand de acolo vine. */
  hartia?: string;
}

/**
 * Pana cand e verificat aparatul, dintr-o singura privire.
 *
 * Doua izvoare, si intaietatea conteaza. Randul de pe fisa — "Valabil pana la",
 * de la termene si conformitate — e cel dupa care Panoul da alarma, si tot el
 * se muta singur cand se incarca un buletin. Cand e scris, el e adevarul, ca sa
 * nu spuna lista una si Panoul alta despre acelasi aparat.
 *
 * Cand nu e scris, se cauta pe hartii: cea in vigoare, dintre cele
 * care pot fi un buletin. Un manual sau un contract n-are ce cauta aici, dar un
 * buletin urcat la rapoarte de service — cum sunt cele mai multe, fiindca asa
 * se numea gramada inainte sa aiba una a lui — da.
 */
export const termenulVerificarii = (d: MedicalDevice): TermenulVerificarii | null => {
  if (d.metrologyExpiry) return { pana: d.metrologyExpiry, dinHartie: false };
  const potFiBuletine = (d.files || []).filter(f =>
    f.validUntil && (f.type === 'metrologie' || f.type === 'report' || f.type === 'service'));
  const ultima = hartiaInVigoare(potFiBuletine);
  return ultima?.validUntil
    ? { pana: ultima.validUntil, dinHartie: true, hartia: ultima.name }
    : null;
};
