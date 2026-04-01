
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
  type: 'manual' | 'report' | 'image' | 'other';
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

export type ViewState = 'DASHBOARD' | 'INVENTORY' | 'DEVICE_DETAIL' | 'ADD_DEVICE' | 'SETTINGS' | 'PLANNER' | 'CONTRACTS' | 'TASKS';

export const getUniqueDepartments = (devices: MedicalDevice[], tasks: MedicalTask[] = []): string[] => {
  const depts = new Set<string>(HOSPITAL_DEPARTMENTS);
  devices.forEach(d => { if (d.department) depts.add(d.department.trim()); });
  tasks.forEach(t => { if (t.department) depts.add(t.department.trim()); });
  return Array.from(depts).sort();
};
