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

export interface MedicalDevice {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  department: string;
  purchaseDate: string;
  status: DeviceStatus;
  image?: string;
  notes?: string;
  maintenanceHistory: MaintenanceRecord[];
  contracts: Contract[];
  files: DeviceFile[];
}

export type ViewState = 'DASHBOARD' | 'INVENTORY' | 'DEVICE_DETAIL' | 'ADD_DEVICE' | 'SETTINGS' | 'PLANNER';