import { MedicalDevice, Contract, DeviceStatus } from '../types';
import { ziuaCererii } from './termene';
import { contracteleAparatului } from './dosarAparat';
import { PersoanaResponsabila } from './setari';
import { scris, lipseste } from './loctiitori';

/**
 * Cat de pregatita e evidenta pentru un control.
 *
 * Inainte de un control, intrebarea nu e "cate aparate avem" — e "ce lipseste".
 * Pana acum raspunsul se afla deschizand fisa aparatelor, una cate una, cu o
 * zi inainte, si tot nu se afla: la doua mii de aparate nimeni nu le deschide
 * pe toate. Ce iesea la control iesea pe loc, in fata inspectorului.
 *
 * Aici se intreaba o data toata evidenta, pe cerintele dupa care se uita cine
 * vine: registrul, persoana responsabila, buletinele de verificare, cererile
 * depuse la timp, autorizatiile, dovada mentenantei, hartiile din dosar. Pentru
 * fiecare cerinta se spune cate aparate nu o indeplinesc si care anume, ca sa
 * se poata deschide si rezolva.
 *
 * ATENTIE la ce e si ce nu e lucrul asta. E o verificare a evidentei din
 * aplicatie, nu o verificare a conformitatii cu legea: aplicatia stie ce s-a
 * trecut in ea, nu ce exista la dosar in realitate. "Gata" inseamna "nu lipseste
 * nimic din ce poate vedea aplicatia", nu "controlul va iesi bine". Temeiurile
 * scrise mai jos sunt cele dupa care s-a construit verificarea si trebuie
 * confruntate cu ordinul in vigoare inainte de a fi citate ca atare.
 */

export type CheieCerinta =
  | 'responsabil' | 'registru' | 'punere' | 'metrologie' | 'cerere'
  | 'cncan' | 'mentenanta' | 'dosar';

export interface Cerinta {
  cheie: CheieCerinta;
  titlu: string;
  /** Ce se verifica, pe scurt si in cuvintele celui care raspunde la control. */
  ce: string;
  /** Pe ce ne bazam. Se confrunta cu ordinul in vigoare. */
  temei: string;
  /**
   * Cerinta se refera la unitate, nu la aparate: n-are lista de aparate, are
   * un da sau nu.
   */
  peUnitate?: boolean;
}

export const CERINTE: Cerinta[] = [
  {
    cheie: 'responsabil', peUnitate: true,
    titlu: 'Persoana responsabila, numita prin decizie',
    ce: 'Numele, functia si decizia de numire sunt trecute in aplicatie.',
    temei: 'Prima hartie ceruta la control; numirea e o hotarare a conducerii, nu se poate deduce din evidenta.',
  },
  {
    cheie: 'registru',
    titlu: 'Registrul de evidenta, complet',
    ce: 'Fiecare dispozitiv are denumire, punct de utilizare si un identificator — serie sau numar de inventar.',
    temei: 'Evidenta dispozitivelor medicale aflate in utilizare.',
  },
  {
    cheie: 'punere',
    titlu: 'Data punerii in functiune',
    ce: 'Se stie de cand e dispozitivul in exploatare — nu doar de cand e cumparat.',
    temei: 'De la punerea in functiune curge garantia si se numara vechimea reala.',
  },
  {
    cheie: 'metrologie',
    titlu: 'Buletine de verificare valabile',
    ce: 'Dispozitivele supuse controlului metrologic au buletinul trecut si nevalabil expirat.',
    temei: 'Un mijloc de masurare cu buletinul expirat nu are voie sa fie folosit.',
  },
  {
    cheie: 'cerere',
    titlu: 'Cererile de verificare, depuse la timp',
    ce: 'Ziua pana la care trebuia depusa cererea nu a trecut.',
    temei: 'Cererea se depune cu luni inainte de expirare, nu in ziua ei.',
  },
  {
    cheie: 'cncan',
    titlu: 'Autorizatii CNCAN valabile',
    ce: 'Aparatele cu radiatii au autorizatia trecuta si nevalabila expirata.',
    temei: 'Instalatiile radiologice functioneaza numai pe baza autorizatiei in termen.',
  },
  {
    cheie: 'mentenanta',
    titlu: 'Dovada mentenantei',
    ce: 'Fiecare dispozitiv are o lucrare in ultimul an sau un contract de service in vigoare.',
    temei: 'Mentenanta se dovedeste cu o hartie, nu cu o afirmatie.',
  },
  {
    cheie: 'dosar',
    titlu: 'Documente in dosarul dispozitivului',
    ce: 'Fiecare dispozitiv are cel putin un document incarcat — declaratie de conformitate, manual, document de achizitie.',
    temei: 'Dosarul dispozitivului se cere pe loc, la control.',
  },
];

export interface Lipsa {
  device: MedicalDevice;
  /** De ce nu indeplineste cerinta, scris ca sa se poata citi in lista. */
  deCe: string;
}

export interface StareaCerintei {
  cerinta: Cerinta;
  /** Cate aparate au fost intrebate. Zero inseamna ca cerinta nu li se aplica. */
  cateIntrebate: number;
  lipsuri: Lipsa[];
  gata: boolean;
}

export interface Pregatirea {
  cerinte: StareaCerintei[];
  /** Cate cerinte sunt indeplinite din cate se aplica. */
  gata: number;
  dinCate: number;
  /** Aparatele care au cel putin un lipsa, cel cu cele mai multe primul. */
  aparateCuLipsuri: { device: MedicalDevice; cate: number }[];
  /** Cate aparate au fost luate in seama. */
  cateAparate: number;
}

const azi = () => new Date().toISOString().split('T')[0];

const acumUnAn = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
};

const expirat = (data?: string) => !!data && data < azi();

/** Un contract in vigoare azi, dintre cele care acopera aparatul. */
const areContractInVigoare = (d: MedicalDevice, contracte: Contract[]) =>
  contracteleAparatului(d, contracte).some(k => !k.endDate || k.endDate >= azi());

/**
 * Starea evidentei fata de cerintele controlului.
 *
 * Aparatele casate sunt lasate afara: cerinta priveste dispozitivele aflate in
 * utilizare, iar un aparat scos din uz cu buletinul expirat nu e un lipsa, e
 * un aparat scos din uz.
 */
export const pregatirea = (
  devices: MedicalDevice[],
  contracte: Contract[] = [],
  responsabil: PersoanaResponsabila = {},
): Pregatirea => {
  const inUtilizare = devices.filter(d => d.status !== DeviceStatus.RETIRED);
  const prag = acumUnAn();

  /** Cine intra in socoteala fiecarei cerinte, si ce ii lipseste. */
  const reguli: Record<CheieCerinta, { priveste: (d: MedicalDevice) => boolean; deCe: (d: MedicalDevice) => string }> = {
    responsabil: { priveste: () => false, deCe: () => '' },
    registru: {
      priveste: () => true,
      /*
       * Se intreaba `scris`, nu campul: aplicatia umple golurile cu "N/A",
       * "Unassigned" si "Unknown" ca ecranul sa aiba ce arata, si un registru
       * in care seria scrie "N/A" ar trece drept complet.
       */
      deCe: d => [
        lipseste(d.name) && 'fara denumire',
        lipseste(d.serialNumber) && lipseste(d.inventoryNumber) && 'fara serie si fara numar de inventar',
        lipseste(d.department) && 'fara punct de utilizare',
      ].filter(Boolean).join(', '),
    },
    punere: {
      priveste: () => true,
      deCe: d => scris(d.commissioningDate) ? '' : 'data punerii in functiune netrecuta',
    },
    metrologie: {
      priveste: d => !!d.metrologyRequired,
      deCe: d => !d.metrologyExpiry ? 'niciun buletin de verificare trecut'
        : expirat(d.metrologyExpiry) ? `buletinul a expirat la ${d.metrologyExpiry}` : '',
    },
    cerere: {
      priveste: d => !!d.metrologyRequired && !!d.metrologyExpiry && !expirat(d.metrologyExpiry),
      deCe: d => {
        const zi = ziuaCererii(d.metrologyExpiry || '');
        return expirat(zi) ? `cererea trebuia depusa pana la ${zi} (buletinul expira ${d.metrologyExpiry})` : '';
      },
    },
    cncan: {
      priveste: d => !!d.isCNCAN,
      deCe: d => !d.cncanExpiry ? 'nicio autorizatie CNCAN trecuta'
        : expirat(d.cncanExpiry) ? `autorizatia a expirat la ${d.cncanExpiry}` : '',
    },
    mentenanta: {
      priveste: () => true,
      deCe: d => {
        const ultima = [...(d.maintenanceHistory || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
        if (ultima && (ultima.date || '') >= prag) return '';
        if (areContractInVigoare(d, contracte)) return '';
        return ultima ? `ultima lucrare la ${ultima.date}, fara contract in vigoare`
          : 'nicio lucrare de mentenanta si niciun contract';
      },
    },
    dosar: {
      priveste: () => true,
      deCe: d => (d.files || []).length ? '' : 'niciun document incarcat',
    },
  };

  const cateLipsuri = new Map<string, number>();

  const cerinte: StareaCerintei[] = CERINTE.map(cerinta => {
    if (cerinta.peUnitate) {
      const lipsa = !(responsabil.nume || '').trim() || !(responsabil.decizieNumar || '').trim();
      return { cerinta, cateIntrebate: 1, lipsuri: [], gata: !lipsa };
    }
    const r = reguli[cerinta.cheie];
    const privite = inUtilizare.filter(r.priveste);
    const lipsuri: Lipsa[] = [];
    for (const d of privite) {
      const deCe = r.deCe(d);
      if (!deCe) continue;
      lipsuri.push({ device: d, deCe });
      cateLipsuri.set(d.id, (cateLipsuri.get(d.id) || 0) + 1);
    }
    lipsuri.sort((a, b) => (a.device.department || '').localeCompare(b.device.department || '', 'ro')
      || (a.device.name || '').localeCompare(b.device.name || '', 'ro'));
    return { cerinta, cateIntrebate: privite.length, lipsuri, gata: lipsuri.length === 0 };
  });

  /*
   * O cerinta care nu priveste niciun aparat — un spital fara aparate cu
   * radiatii — nu se numara nici ca indeplinita, nici ca neindeplinita.
   * Altfel scorul ar creste cu cat are unitatea mai putine obligatii.
   */
  const seAplica = cerinte.filter(c => c.cateIntrebate > 0);

  const aparateCuLipsuri = [...cateLipsuri.entries()]
    .map(([id, cate]) => ({ device: inUtilizare.find(d => d.id === id)!, cate }))
    .filter(x => !!x.device)
    .sort((a, b) => b.cate - a.cate
      || (a.device.department || '').localeCompare(b.device.department || '', 'ro'));

  return {
    cerinte,
    gata: seAplica.filter(c => c.gata).length,
    dinCate: seAplica.length,
    aparateCuLipsuri,
    cateAparate: inUtilizare.length,
  };
};
