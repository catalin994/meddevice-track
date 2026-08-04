
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
  entity: 'device' | 'task' | 'invoice' | 'referat' | 'fundamentare';
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
  annualCost: number;
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

export interface Referat {
  id: string;
  /** Numarul de inregistrare, asa cum apare pe hartie. */
  number: string;
  date: string;
  /** Sectia care solicita. */
  department: string;
  /** Ce se cere, pe scurt. */
  subject: string;
  /** De ce se cere — justificarea din referat. */
  justification?: string;
  estimatedValue: number;
  currency: string;
  status: ReferatStatus;
  /** Aparatele vizate, cand referatul e legat de echipamente existente. */
  deviceIds: string[];
  filePath?: string;
  fileUrl?: string;
  fileName?: string;
  updated_at?: string;
}

export enum FoundationDocType {
  NOTA_VALOARE = 'NotaValoare',
  STUDIU_PIATA = 'StudiuPiata',
  OFERTA = 'Oferta',
  CAIET_SARCINI = 'CaietSarcini',
  NOTA_OPORTUNITATE = 'NotaOportunitate',
  SPECIFICATII = 'Specificatii',
  ALTUL = 'Altul',
}

export const FOUNDATION_DOC_RO: Record<FoundationDocType, string> = {
  [FoundationDocType.NOTA_VALOARE]: 'Nota justificativa valoare estimata',
  [FoundationDocType.STUDIU_PIATA]: 'Studiu de piata',
  [FoundationDocType.OFERTA]: 'Oferta de pret',
  [FoundationDocType.CAIET_SARCINI]: 'Caiet de sarcini',
  [FoundationDocType.NOTA_OPORTUNITATE]: 'Nota de oportunitate',
  [FoundationDocType.SPECIFICATII]: 'Specificatii tehnice',
  [FoundationDocType.ALTUL]: 'Alt document',
};

export interface FoundationDoc {
  id: string;
  /** Referatul pe care il sustine. Gol cand documentul e inca nelegat. */
  referatId?: string;
  type: FoundationDocType;
  /** Numarul de inregistrare, daca are unul. */
  number?: string;
  date: string;
  /** Cine a emis oferta sau studiul. */
  supplier?: string;
  amount?: number;
  currency?: string;
  notes?: string;
  filePath?: string;
  fileUrl?: string;
  fileName?: string;
  updated_at?: string;
}

export interface DeviceFile {
  id: string;
  name: string;
  type: 'manual' | 'report' | 'image' | 'other' | 'service' | 'achizitie';
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
  entity: 'device' | 'task' | 'invoice' | 'referat' | 'fundamentare';
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
  deviceIds: string[];       // devices this cost is associated with
  description?: string;
  /** Key in Supabase Storage for the attached invoice PDF. */
  filePath?: string;
  /** Legacy inline data URL, kept so old invoices still open. */
  fileUrl?: string;
  fileName?: string;
  updated_at?: string;
}

export const getUniqueDepartments = (devices: MedicalDevice[], tasks: MedicalTask[] = []): string[] => {
  const depts = new Set<string>(HOSPITAL_DEPARTMENTS);
  devices.forEach(d => { if (d.department) depts.add(d.department.trim()); });
  tasks.forEach(t => { if (t.department) depts.add(t.department.trim()); });
  return Array.from(depts).sort();
};
