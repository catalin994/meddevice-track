
export enum DeviceStatus {
  ACTIVE = 'Active',
  MAINTENANCE = 'In Maintenance',
  BROKEN = 'Broken',
  RETIRED = 'Retired',
}

export enum MaintenanceType {
  PREVENTIVE = 'Preventive',
  CORRECTIVE = 'Corrective',
  CALIBRATION = 'Calibration',
}

export enum TaskPriority {
  CRITICAL = 'Critical',
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low',
}

export enum TaskStatus {
  PENDING = 'Pending',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
}

export const HOSPITAL_DEPARTMENTS = [
  'Radiology',
  'Cardiology',
  'Emergency',
  'ICU / Critical Care',
  'Oncology',
  'Pediatrics',
  'Surgery / OR',
  'Pathology',
  'Neurology',
  'Gastroenterology',
  'Physiotherapy',
  'Administration',
  'Biomedical Engineering',
  'Laboratory'
] as const;

export const DEVICE_CATEGORIES = [
  'Aparat ventilatie mecanica',
  'Aparat anestezie',
  'Monitor functii vitale',
  'Defibrilator',
  'Infuzomat / Injectomat',
  'Echipament Imagistica',
  'Ecograf',
  'Electrocardiograf (ECG)',
  'Altele'
] as const;

export type HospitalDepartment = typeof HOSPITAL_DEPARTMENTS[number];
export type DeviceCategory = typeof DEVICE_CATEGORIES[number];

/**
 * A record that something was deleted.
 *
 * Without these, a device deleted on one phone still exists in the local copy
 * of every other phone — and on their next sync they upload it back, undoing
 * the deletion and leaving the fleet counts different between devices.
 */
export interface Deletion {
  id: string;                                  // "device:DEV-0001"
  entity: 'device' | 'task' | 'invoice' | 'referat' | 'fundamentare' | 'comanda';
  entityId: string;
  deletedAt: string;
  updated_at?: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  kind: 'image' | 'video' | 'file';
  /** Key in Supabase Storage. Newer records use this instead of `url`. */
  path?: string;
  /** Legacy inline data URL, kept so old records still open. */
  url?: string;
  size: number;      // bytes
  dateAdded: string;
}

export interface MedicalTask {
  id: string;
  title: string;
  description: string;
  deviceId?: string; // Optional link to a device
  deviceName?: string; // Cached for display
  department: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  updated_at?: string;
  dueDate?: string;
  notes?: string;
  attachments?: TaskAttachment[];
}

export interface MaintenanceRecord {
  id: string;
  date: string;
  type: MaintenanceType;
  technician: string;
  description: string;
  nextScheduledDate?: string;
  completed: boolean;
}

export interface Contract {
  id: string;
  name?: string;
  provider: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  coverageDetails: string;
  contactPhone: string;
  /** Valoarea fara TVA — cifra cu care se lucreaza peste tot in aplicatie. */
  annualCost: number;
  /** Valoarea cu TVA, asa cum e scrisa in contract. TVA-ul e diferenta lor. */
  annualCostWithVat?: number;
  /** Contractul scanat, tinut in stocare ca orice alt document. */
  filePath?: string;
  /** Copia din rand, pentru contractele atasate fara semnal. */
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

/**
 * Dosarul unei achizitii, in ordinea in care se aduna.
 *
 * Referatul de necesitate deschide procedura: sectia scrie ce ii trebuie si
 * de ce. Documentele de fundamentare sustin valoarea estimata din el — nota
 * justificativa, studiul de piata, ofertele. Contractul si facturile vin
 * dupa, si erau deja aici; lipsea inceputul.
 */
export enum ReferatStatus {
  DRAFT = 'Draft',
  SUBMITTED = 'Submitted',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  CLOSED = 'Closed',
}

export const REFERAT_STATUS_RO: Record<ReferatStatus, string> = {
  [ReferatStatus.DRAFT]: 'In lucru',
  [ReferatStatus.SUBMITTED]: 'Depus',
  [ReferatStatus.APPROVED]: 'Aprobat',
  [ReferatStatus.REJECTED]: 'Respins',
  [ReferatStatus.CLOSED]: 'Finalizat',
};

/**
 * O pozitie din tabelul referatului.
 *
 * Referatul real nu are o singura valoare, are un tabel: sapte injectomatoare
 * si aspiratoare, fiecare cu seria lui si cu pretul lui, iar totalul e suma
 * lor. Un singur camp "valoare estimata" ar fi cerut sa fie adunate pe hartie
 * si apoi tastate — exact munca pe care aplicatia ar trebui sa o scuteasca.
 */
export interface ReferatItem {
  id: string;
  /** "Injectomat Sinomedical cu SN :0265171026A007799" */
  name: string;
  /** Buc, Set, Ora, Luna... */
  unit: string;
  quantity: number;
  /** Pretul unitar estimat, in lei fara TVA. */
  unitPrice: number;
  /** Caracteristici tehnice, coloana 6 din formular. */
  specs?: string;
}

export const referatTotal = (items: ReferatItem[] = []): number =>
  items.reduce((s, it) => s + (it.quantity || 0) * (it.unitPrice || 0), 0);

export interface Referat {
  id: string;
  /** Numarul de inregistrare, asa cum apare pe hartie. */
  number: string;
  date: string;
  /** Compartimentul care emite: "Birou Tehnic", "Serviciul Tehnic". */
  issuedBy: string;
  /** Seful care aproba: "Ing. Isopescu Liliana". */
  approvedBy?: string;
  /** Sectia beneficiara, cand achizitia e pentru una anume. */
  department: string;
  /** "Obiectul achizitiei" din formular. */
  subject: string;
  /** Pozitiile din tabel. */
  items: ReferatItem[];
  /** Punctul c): pentru ce si in ce scop se solicita achizitia. */
  justification?: string;
  /** "Articolul bugetar aferent achizitiei este 66100 UPU" */
  budgetArticle?: string;
  /** Firma care a ofertat, cand referatul se sprijina pe oferte. */
  offerProvider?: string;
  /** Numerele ofertelor atasate, asa cum sunt scrise in referat. */
  offerNumbers?: string;
  currency: string;
  status: ReferatStatus;
  /** Aparatele vizate, cand referatul e legat de echipamente existente. */
  deviceIds: string[];
  /** Persoana de contact pentru informatiile din referat. */
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  contactPhone?: string;
  filePath?: string;
  fileUrl?: string;
  fileName?: string;
  updated_at?: string;
  /** Referate salvate inainte de tabelul de pozitii aveau o singura valoare. */
  estimatedValue?: number;
}

/**
 * "Elementul de fundamentare" — ce anume se angajeaza bugetar.
 *
 * Prima varianta clasifica dupa felul actului atasat (oferta, studiu de piata,
 * caiet de sarcini). Documentele reale arata ca asta e gresit: ofertele sunt
 * anexe la referat, iar documentul de fundamentare se distinge dupa temeiul
 * angajamentului — o achizitie directa, o alocare lunara pe un contract
 * subsecvent, un acord-cadru.
 */
export enum FoundationDocType {
  ACHIZITIE_DIRECTA = 'AchizitieDirecta',
  CONTRACT_SUBSECVENT = 'ContractSubsecvent',
  ACORD_CADRU = 'AcordCadru',
  CONTRACT = 'Contract',
  COMANDA = 'Comanda',
  ALTUL = 'Altul',
}

export const FOUNDATION_DOC_RO: Record<FoundationDocType, string> = {
  [FoundationDocType.ACHIZITIE_DIRECTA]: 'Achizitie directa',
  [FoundationDocType.CONTRACT_SUBSECVENT]: 'Contract subsecvent',
  [FoundationDocType.ACORD_CADRU]: 'Acord-cadru',
  [FoundationDocType.CONTRACT]: 'Contract',
  [FoundationDocType.COMANDA]: 'Comanda',
  [FoundationDocType.ALTUL]: 'Alt temei',
};

/** Documentele salvate cu vechea clasificare cad pe "Alt temei". */
export const normaliseFoundationType = (raw: unknown): FoundationDocType =>
  Object.values(FoundationDocType).includes(raw as FoundationDocType)
    ? (raw as FoundationDocType)
    : FoundationDocType.ALTUL;

/**
 * Documentul de fundamentare, in forma ceruta de lege.
 *
 * Nu e o oferta atasata, cum credeam: e actul care justifica angajamentul
 * bugetar. Are numar unic de inregistrare, se revizuieste — revizia 7 a
 * aceluiasi document, pentru luna august — si poarta valoarea in trei coloane:
 * cat era la revizia precedenta, cu cat se schimba, cat devine.
 */
export interface FoundationDoc {
  id: string;
  /** Referatul pe care il sustine. Gol la cele care nu pornesc de la unul,
   *  cum sunt alocarile lunare pe un contract subsecvent. */
  referatId?: string;
  type: FoundationDocType;
  /** "Numar unic de inregistrare: 17835/31.07.2026" — partea de numar. */
  number?: string;
  date: string;
  /** A cata revizuire. Prima e 0. */
  revision?: number;
  revisionDate?: string;
  /** "Compartiment de specialitate: Serviciul Tehnic" */
  compartment?: string;
  /** Titlul de pe prima pagina — "Reparatie defibrilator Corpuls Elicopter 336". */
  subject?: string;
  /** Punctul 2: descrierea pe scurt / motivul revizuirii. Nu e mereu acelasi
   *  lucru cu titlul: pe DF 17979 titlul e "Contract subsecvent Papapostolul",
   *  iar punctul 2 spune "Servicii de intretinere preventiva si reparatii
   *  aparatura medicala Contract subsecvent cu Papapostolul". Gol, se ia titlul. */
  shortDescription?: string;
  /** Punctul 3: descrierea pe larg a starii de fapt si de drept. */
  description?: string;
  /** Articolul bugetar si codul SSI din tabelul de valori. */
  budgetArticle?: string;
  ssiCode?: string;
  program?: string;
  /** Coloana 1 din tabelul de valori. Pe un contract subsecvent scrie tipul
   *  ("Contract subsecvent"), pe o reparatie scrie obiectul ("Reparatie
   *  defibrilator Corpuls Elicopter 336") — deci nu se poate deduce din tip. */
  element?: string;
  /** "1x 3.226,67" — cum s-a ajuns la suma. */
  parameters?: string;
  /** Valoarea de la revizia precedenta, influenta, si totalul actualizat.
   *  La prima revizie primele doua sunt zero. */
  previousValue?: number;
  influence?: number;
  amount?: number;
  currency?: string;
  /** "[ ] ramane in suma de ___ lei, conform fundamentarii aprobate intr-o
   *  revizuire anterioara". */
  remainingAmount?: number;
  /** Firma si numarul ofertei sau contractului pe care se sprijina. */
  supplier?: string;
  referenceNumber?: string;
  /** Acordul-cadru pe care se sprijina un contract subsecvent. */
  frameworkContract?: string;
  /**
   * Valoarea totala a acordului-cadru.
   *
   * Contractele subsecvente trag dintr-un plafon. Fara cifra asta nimeni nu
   * vede cat a mai ramas pana la epuizare — se afla in luna in care alocarea
   * nu mai incape, adica prea tarziu ca sa se mai poata face o procedura noua.
   */
  frameworkTotal?: number;
  /** Frazele care leaga documentul de oferta sau de contract. Se propune una
   *  din campurile de mai sus, dar se poate scrie orice — documentele reale nu
   *  au doua la fel. */
  reference?: string;
  /**
   * Documentele de pe un contract se fac lunar, unul pentru fiecare luna, ca
   * revizuiri succesive ale aceluiasi document. Cele trei campuri de mai jos
   * leaga lunile intre ele.
   */
  recurring?: boolean;
  /** Toate lunile aceluiasi contract poarta acelasi seriesId — id-ul primeia. */
  seriesId?: string;
  /** Luna acoperita, "2026-08". Dupa ea se stie ce mai e de facut. */
  periodMonth?: string;
  notes?: string;
  filePath?: string;
  fileUrl?: string;
  fileName?: string;
  updated_at?: string;
}

export const LUNI_RO = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
] as const;

/** "2026-08" → "august 2026". */
export const lunaRo = (perioada: string): string => {
  const [an, luna] = (perioada || '').split('-');
  const i = parseInt(luna, 10) - 1;
  return i >= 0 && i < 12 ? `${LUNI_RO[i]} ${an}` : perioada || '';
};

/** Luna curenta, in forma in care se tin perioadele. */
export const lunaAcum = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** "2026-08" + 1 → "2026-09". */
export const lunaUrmatoare = (perioada: string, pasi = 1): string => {
  const [an, luna] = perioada.split('-').map(Number);
  const d = new Date(an, luna - 1 + pasi, 1);
  return lunaAcum(d);
};

/** Cate luni sunt intre doua perioade. Negativ daca a doua e mai veche. */
export const luniIntre = (de: string, la: string): number => {
  const [a1, l1] = de.split('-').map(Number);
  const [a2, l2] = la.split('-').map(Number);
  return (a2 - a1) * 12 + (l2 - l1);
};

/**
 * Schimba numele lunii dintr-un text, pastrand felul in care era scris.
 *
 * "Alocarea sumei necesare pentru luna AUGUST" devine "...pentru luna
 * SEPTEMBRIE", nu "septembrie". Fara asta, documentul pe luna noua ar purta
 * numele lunii vechi in titlu si in descriere — greseala care trece cel mai
 * usor neobservata, fiindca restul documentului e corect.
 *
 * "mai" e si cuvant obisnuit ("mai multe", "mai mult"). De aceea se inlocuieste
 * doar scris cu majuscule sau precedat de "luna".
 */
export const schimbaLuna = (text: string, dinPerioada: string, inPerioada: string): string => {
  if (!text) return text;
  const iVechi = parseInt((dinPerioada || '').split('-')[1], 10) - 1;
  const iNou = parseInt((inPerioada || '').split('-')[1], 10) - 1;
  if (!(iVechi >= 0 && iVechi < 12) || !(iNou >= 0 && iNou < 12) || iVechi === iNou) return text;
  const vechi = LUNI_RO[iVechi];
  const nou = LUNI_RO[iNou];
  const laFel = (gasit: string) =>
    gasit === gasit.toUpperCase() ? nou.toUpperCase()
    : gasit[0] === gasit[0].toUpperCase() ? nou[0].toUpperCase() + nou.slice(1)
    : nou;

  if (vechi === 'mai') {
    return text
      .replace(/\bMAI\b/g, () => laFel('MAI'))
      .replace(/(\bluna\s+)(mai|Mai)\b/gi, (_, p, g) => p + laFel(g));
  }
  return text.replace(new RegExp(`\\b${vechi}\\b`, 'gi'), g => laFel(g));
};

export interface DeviceFile {
  id: string;
  name: string;
  type: 'manual' | 'report' | 'image' | 'other' | 'service' | 'achizitie' | 'metrologie';
  /** Key in Supabase Storage. Newer records use this instead of `url`. */
  path?: string;
  /** Legacy inline data URL, kept so old records still open. */
  url?: string;
  size?: number;
  dateAdded: string;
}

export interface DeviceComponent {
  id: string;
  name: string;
  serialNumber: string;
  status: DeviceStatus;
  installDate?: string;
}

export interface LocationLog {
  date: string;
  department: string;
}

export interface MedicalDevice {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  department: string;
  purchaseDate: string;
  warrantyExpiration?: string;
  status: DeviceStatus;
  isCNCAN?: boolean;
  /** Autorizatia CNCAN are termen; se reinnoieste. */
  cncanExpiry?: string;
  /**
   * Verificarea metrologica periodica.
   *
   * Aparatele care masoara — tensiometre, cantare, injectomate, defibrilatoare
   * — sunt mijloace de masurare supuse controlului metrologic legal. Buletinul
   * are termen, si un aparat cu buletinul expirat nu are voie sa fie folosit,
   * oricat de bine ar functiona. E singurul termen din aplicatie care nu se
   * negociaza cu nimeni.
   */
  metrologyRequired?: boolean;
  /** Numarul buletinului de verificare metrologica. */
  metrologyCertificate?: string;
  /** Data verificarii. */
  metrologyDate?: string;
  /** Pana cand e valabil. De obicei un an, dar nu intotdeauna. */
  metrologyExpiry?: string;
  /** Laboratorul care a facut verificarea. */
  metrologyLab?: string;
  image?: string;
  notes?: string;
  maintenanceHistory: MaintenanceRecord[];
  contracts: Contract[];
  files: DeviceFile[];
  components: DeviceComponent[];
  locationHistory?: LocationLog[];
  nextMaintenanceDate?: string;
  tags?: string[];
  updated_at?: string;
}

export const PM_INTERVALS_MONTHS: Record<string, number> = {
  'Aparat ventilatie mecanica': 6,
  'Aparat anestezie': 6,
  'Monitor functii vitale': 12,
  'Defibrilator': 6,
  'Infuzomat / Injectomat': 12,
  'Echipament Imagistica': 12,
  'Ecograf': 12,
  'Electrocardiograf (ECG)': 12,
  'Altele': 12
};

export const calculateNextMaintenanceDate = (baseDate: string, category: string): string => {
  const date = new Date(baseDate);
  const interval = PM_INTERVALS_MONTHS[category] || 12;
  date.setMonth(date.getMonth() + interval);
  return date.toISOString().split('T')[0];
};

export type ViewState = 'DASHBOARD' | 'INVENTORY' | 'DEVICE_DETAIL' | 'ADD_DEVICE' | 'SETTINGS' | 'PLANNER' | 'CONTRACTS' | 'TASKS' | 'FINANCE';

/**
 * Where an invoice stands with ConectX.
 *
 * This used to track payment — paid, unpaid, overdue — which is accounting's
 * business, not the biomedical department's. What the department actually
 * needs to know is whether the invoice has been pushed into ConectX yet.
 */
export enum InvoiceStatus {
  UPLOADED = 'Uploaded',
  NOT_UPLOADED = 'NotUploaded',
}

/**
 * Invoices saved before the change carry 'Paid' / 'Unpaid' / 'Overdue'.
 * None of them says anything about ConectX, so they all start as not
 * uploaded — inventing an upload that never happened would be worse than
 * asking someone to tick a box.
 */
export const normaliseInvoiceStatus = (raw: unknown): InvoiceStatus =>
  raw === InvoiceStatus.UPLOADED ? InvoiceStatus.UPLOADED : InvoiceStatus.NOT_UPLOADED;

// Romanian display labels — stored values stay in English so existing data keeps working
export const DEVICE_STATUS_RO: Record<DeviceStatus, string> = {
  [DeviceStatus.ACTIVE]: 'Activ',
  [DeviceStatus.MAINTENANCE]: 'In mentenanta',
  [DeviceStatus.BROKEN]: 'Defect',
  [DeviceStatus.RETIRED]: 'Casat',
};

export const TASK_STATUS_RO: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: 'In asteptare',
  [TaskStatus.IN_PROGRESS]: 'In lucru',
  [TaskStatus.COMPLETED]: 'Finalizat',
};

export const TASK_PRIORITY_RO: Record<TaskPriority, string> = {
  [TaskPriority.CRITICAL]: 'Critica',
  [TaskPriority.HIGH]: 'Ridicata',
  [TaskPriority.MEDIUM]: 'Medie',
  [TaskPriority.LOW]: 'Scazuta',
};

export const MAINTENANCE_TYPE_RO: Record<MaintenanceType, string> = {
  [MaintenanceType.PREVENTIVE]: 'Preventiva',
  [MaintenanceType.CORRECTIVE]: 'Corectiva',
  [MaintenanceType.CALIBRATION]: 'Calibrare',
};

export type UserRole = 'ADMIN' | 'TEHNICIAN' | 'CONTABIL' | 'VIZUALIZARE';

export interface AppUser {
  id: string;          // the Supabase auth user id
  name: string;
  email: string;
  role: UserRole;
  /** Set by an administrator. Until then the database returns nothing. */
  approved: boolean;
}

export type Permission = 'finance' | 'edit' | 'delete' | 'manageUsers';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: ['finance', 'edit', 'delete', 'manageUsers'],
  TEHNICIAN: ['edit'],
  CONTABIL: ['finance', 'edit'],
  VIZUALIZARE: [],
};

export const hasPermission = (user: AppUser | null, perm: Permission): boolean =>
  !!user && ROLE_PERMISSIONS[user.role]?.includes(perm);

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  TEHNICIAN: 'Tehnician',
  CONTABIL: 'Contabil',
  VIZUALIZARE: 'Doar vizualizare',
};

export interface AuditEntry {
  id: string;
  timestamp: string;
  userName: string;
  action: 'create' | 'update' | 'delete';
  entity: 'device' | 'task' | 'invoice' | 'referat' | 'fundamentare' | 'comanda';
  entityId: string;
  entityName: string;
  details?: string;
  updated_at?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  supplier: string;
  issueDate: string;
  dueDate?: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  /** When it was marked as uploaded to ConectX (ISO date). */
  uploadedAt?: string;
  contractNumber?: string;   // optional link to a service contract
  /** Numarul comenzii pe care vine factura, cand e tiparit pe ea. */
  orderNumber?: string;
  /**
   * Articolul bugetar pe care se face plata.
   *
   * Cand lipseste, pagina de buget il deduce din documentul de fundamentare cu
   * acelasi numar de contract; scris aici, are ultimul cuvant.
   */
  budgetArticle?: string;
  deviceIds: string[];       // devices this cost is associated with
  description?: string;
  /** Key in Supabase Storage for the attached invoice PDF. */
  filePath?: string;
  /** Cati octeti are PDF-ul, ca sa se poata socoti spatiul fara sa fie cerut. */
  fileSize?: number;
  /** Legacy inline data URL, kept so old invoices still open. */
  fileUrl?: string;
  fileName?: string;
  updated_at?: string;
}

/**
 * Comanda catre furnizor.
 *
 * Vine dupa referat si dupa contract, si e actul pe care furnizorul il executa:
 * ce s-a cerut, cate bucati, la ce pret, pana cand se plateste. Pe hartia
 * spitalului are numar propriu, data, gestiunea in care intra marfa, si
 * trimiterile inapoi — la referat, la oferta, la contractul sau acordul-cadru
 * pe care se sprijina.
 */
export enum ComandaStatus {
  /** Trimisa furnizorului, inca fara raspuns. */
  EMISA = 'Emisa',
  CONFIRMATA = 'Confirmata',
  /** A venit o parte din marfa. */
  PARTIAL = 'Partial',
  LIVRATA = 'Livrata',
  ANULATA = 'Anulata',
}

export const COMANDA_STATUS_RO: Record<ComandaStatus, string> = {
  [ComandaStatus.EMISA]: 'Emisa',
  [ComandaStatus.CONFIRMATA]: 'Confirmata',
  [ComandaStatus.PARTIAL]: 'Livrata partial',
  [ComandaStatus.LIVRATA]: 'Livrata',
  [ComandaStatus.ANULATA]: 'Anulata',
};

export const normaliseComandaStatus = (raw: unknown): ComandaStatus =>
  Object.values(ComandaStatus).includes(raw as ComandaStatus)
    ? (raw as ComandaStatus)
    : ComandaStatus.EMISA;

/** O pozitie din tabelul comenzii. */
export interface ComandaItem {
  id: string;
  /** "CUTIE CASETE STERILIZARE PURE120" */
  name: string;
  /** Contul contabil din coloana a doua. */
  account?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  /** Cat a venit efectiv din pozitia asta. */
  received?: number;
}

export const comandaValoare = (items: ComandaItem[] = []): number =>
  items.reduce((s, it) => s + (it.quantity || 0) * (it.unitPrice || 0), 0);

/** Cate pozitii au venit integral. */
export const comandaPrimit = (items: ComandaItem[] = []): number =>
  items.reduce((s, it) => s + Math.min(it.received ?? 0, it.quantity || 0) * (it.unitPrice || 0), 0);

export interface Comanda {
  id: string;
  /** "Nr.comanda: 1984" */
  number: string;
  /** "Data comenzii: 10.08.2026" */
  date: string;
  supplier: string;
  supplierCui?: string;
  /** Trimiterile de pe comanda, asa cum sunt tiparite. */
  referatNumber?: string;
  offerNumber?: string;
  contractNumber?: string;
  frameworkContract?: string;
  /** "Gestiunea: G10 / PIESE SCHIMB DIVERSE" */
  warehouse?: string;
  /** Termenul de plata, in zile. */
  paymentDays?: number;
  items: ComandaItem[];
  currency: string;
  status: ComandaStatus;
  /** Valoarea cu TVA, cand comanda o scrie. Fara TVA se calculeaza din pozitii. */
  totalWithVat?: number;
  /** Cand a venit marfa, ca sa se vada cat a durat. */
  deliveredAt?: string;
  notes?: string;
  /** Aparatele pentru care s-a comandat, cand se stie. */
  deviceIds?: string[];
  filePath?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  updated_at?: string;
}

export const getUniqueDepartments = (devices: MedicalDevice[], tasks: MedicalTask[] = []): string[] => {
  const depts = new Set<string>(HOSPITAL_DEPARTMENTS);
  devices.forEach(d => { if (d.department) depts.add(d.department.trim()); });
  tasks.forEach(t => { if (t.department) depts.add(t.department.trim()); });
  return Array.from(depts).sort();
};
