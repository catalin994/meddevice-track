import { DeviceFile } from '../types';

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
 * Hartia care da termenul unei gramezi: ultima incarcata dintre cele cu termen.
 *
 * Nu cea cu data cea mai indepartata. Un buletin nou il inlocuieste pe cel
 * vechi chiar daca din greseala i s-a scris un termen mai scurt, iar ce conteaza
 * e ce spune ultima hartie pusa la dosar.
 */
export const ultimaCuTermen = (fisiere: DeviceFile[] = []): DeviceFile | null =>
  fisiere
    .filter(f => f.validUntil)
    .sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || '')
      || (b.id || '').localeCompare(a.id || ''))[0] || null;
