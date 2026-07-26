
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

export interface DeviceFile {
  id: string;
  name: string;
  type: 'manual' | 'report' | 'image' | 'other' | 'service' | 'achizitie';
  url: string;
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

export enum InvoiceStatus {
  PAID = 'Paid',
  UNPAID = 'Unpaid',
  OVERDUE = 'Overdue',
}

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
  id: string;
  name: string;
  role: UserRole;
  pin: string;
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
  entity: 'device' | 'task' | 'invoice';
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
  contractNumber?: string;   // optional link to a service contract
  deviceIds: string[];       // devices this cost is associated with
  description?: string;
  fileUrl?: string;          // attached invoice PDF (data URL)
  fileName?: string;
  updated_at?: string;
}

export const getUniqueDepartments = (devices: MedicalDevice[], tasks: MedicalTask[] = []): string[] => {
  const depts = new Set<string>(HOSPITAL_DEPARTMENTS);
  devices.forEach(d => { if (d.department) depts.add(d.department.trim()); });
  tasks.forEach(t => { if (t.department) depts.add(t.department.trim()); });
  return Array.from(depts).sort();
};
