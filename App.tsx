import React, { useState, useEffect } from 'react';
import { LayoutDashboard, List, PlusCircle, Settings as SettingsIcon, Stethoscope, Menu, X, QrCode, Cloud, CloudOff, CalendarRange } from 'lucide-react';
import Dashboard from './components/Dashboard';
import DeviceList from './components/DeviceList';
import DeviceDetail from './components/DeviceDetail';
import AddDeviceForm from './components/AddDeviceForm';
import MaintenancePlanner from './components/MaintenancePlanner';
import Settings from './components/Settings';
import { MedicalDevice, DeviceStatus, ViewState, MaintenanceType } from './types';
import { supabase, isSupabaseConfigured } from './services/supabase';

// Mock Data Initialization (Fallback)
const MOCK_DEVICES: MedicalDevice[] = [
  {
    id: 'DEV-001',
    name: 'MRI Scanner Elite X',
    manufacturer: 'Siemens Healthineers',
    model: 'Magnetom Vida',
    serialNumber: 'SN-9982-X2',
    department: 'Radiology',
    purchaseDate: '2022-03-15',
    status: DeviceStatus.ACTIVE,
    notes: 'Primary MRI for emergency ward. Requires weekly cooling system check.',
    files: [{ id: 'f1', name: 'User Manual v2.pdf', type: 'manual', url: '#', dateAdded: '2022-03-15' }],
    maintenanceHistory: [
      { id: 'm1', date: '2023-10-10', type: MaintenanceType.PREVENTIVE, technician: 'John Doe', description: 'Annual coil calibration', completed: true, nextScheduledDate: '2024-10-10' }
    ],
    contracts: [
      { id: 'c1', provider: 'Siemens Direct', contractNumber: 'SVC-2022-99', startDate: '2022-03-15', endDate: '2025-03-15', coverageDetails: 'Full parts and labor, 24h response', contactPhone: '555-0192', annualCost: 45000 }
    ]
  }
];

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [isLoading, setIsLoading] = useState(false);
  
  const [devices, setDevices] = useState<MedicalDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<MedicalDevice | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const getLocalData = (): MedicalDevice[] => {
    try {
      const savedData = localStorage.getItem('meditrack_devices');
      return savedData ? JSON.parse(savedData) : MOCK_DEVICES;
    } catch (e) {
      return MOCK_DEVICES;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      let loadedDevices: MedicalDevice[] = [];

      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase.from('devices').select('*');
          if (error) throw error;
          if (data) loadedDevices = data as MedicalDevice[];
        } catch (error) {
          console.error("Supabase load error:", error);
          loadedDevices = getLocalData();
        }
      } else {
        loadedDevices = getLocalData();
      }

      setDevices(loadedDevices);
      
      const params = new URLSearchParams(window.location.search);
      const deepLinkIds = params.get('deviceId');
      if (deepLinkIds) {
          const targetDevice = loadedDevices.find(d => d.id === deepLinkIds);
          if (targetDevice) {
              setSelectedDevice(targetDevice);
              setView('DEVICE_DETAIL');
          }
      }

      setIsLoading(false);
    };

    loadData();
  }, []);

  const persistDeviceChange = async (newDevices: MedicalDevice[], changedDevice?: MedicalDevice | MedicalDevice[], action?: 'INSERT' | 'UPDATE' | 'DELETE' | 'BULK_INSERT') => {
    setDevices(newDevices);
    localStorage.setItem('meditrack_devices', JSON.stringify(newDevices));

    if (isSupabaseConfigured && supabase && changedDevice && action) {
      try {
        if (action === 'DELETE' && !Array.isArray(changedDevice)) {
          await supabase.from('devices').delete().eq('id', changedDevice.id);
        } else if (action === 'INSERT' && !Array.isArray(changedDevice)) {
          await supabase.from('devices').insert([changedDevice]);
        } else if (action === 'UPDATE' && !Array.isArray(changedDevice)) {
          await supabase.from('devices').update(changedDevice).eq('id', changedDevice.id);
        } else if (action === 'BULK_INSERT' && Array.isArray(changedDevice)) {
          await supabase.from('devices').insert(changedDevice);
        }
      } catch (err) {
        console.error("Failed to sync with cloud:", err);
      }
    }
  };

  const handleSelectDevice = (device: MedicalDevice) => {
    setSelectedDevice(device);
    setView('DEVICE_DETAIL');
  };

  const handleUpdateDevice = (updated: MedicalDevice) => {
    const newDevices = devices.map(d => d.id === updated.id ? updated : d);
    persistDeviceChange(newDevices, updated, 'UPDATE');
    setSelectedDevice(updated);
  };

  const handleAddDevice = (newDevice: MedicalDevice) => {
    const newDevices = [newDevice, ...devices];
    persistDeviceChange(newDevices, newDevice, 'INSERT');
    setView('INVENTORY');
  };

  const handleBulkAddDevices = (newDevicesList: MedicalDevice[]) => {
    const newDevices = [...newDevicesList, ...devices];
    persistDeviceChange(newDevices, newDevicesList, 'BULK_INSERT');
    setView('INVENTORY');
  };

  const handleDeleteDevice = (id: string) => {
    const deviceToDelete = devices.find(d => d.id === id);
    const newDevices = devices.filter(d => d.id !== id);
    persistDeviceChange(newDevices, deviceToDelete, 'DELETE');
    
    if (selectedDevice?.id === id) {
      setSelectedDevice(null);
      setView('INVENTORY');
    }
  };
  
  const handleImportData = (importedDevices: MedicalDevice[]) => {
      setDevices(importedDevices);
      localStorage.setItem('meditrack_devices', JSON.stringify(importedDevices));
      setView('INVENTORY');
  };

  const handleApplyGlobalPlan = (updatedDevices: MedicalDevice[]) => {
    persistDeviceChange(updatedDevices, updatedDevices, 'BULK_INSERT');
    setView('INVENTORY');
  };

  const NavItem = ({ icon, label, targetView }: { icon: React.ReactNode, label: string, targetView: ViewState }) => (
    <button 
      onClick={() => { setView(targetView); setSidebarOpen(false); }}
      className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
        view === targetView && view !== 'DEVICE_DETAIL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center gap-3 border-b border-slate-800">
            <div className="bg-blue-600 p-2 rounded-lg"><Stethoscope className="w-6 h-6 text-white" /></div>
            <h1 className="text-xl font-bold tracking-tight">MediTrack</h1>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            <NavItem icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" targetView="DASHBOARD" />
            <NavItem icon={<List className="w-5 h-5" />} label="Inventory" targetView="INVENTORY" />
            <NavItem icon={<CalendarRange className="w-5 h-5" />} label="Maintenance Planner" targetView="PLANNER" />
            <div className="pt-8 pb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tools</div>
            <button className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg">
              <QrCode className="w-5 h-5" /> Scan QR Code
            </button>
            <button onClick={() => { setView('SETTINGS'); setSidebarOpen(false); }}
               className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors ${view === 'SETTINGS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <SettingsIcon className="w-5 h-5" /> Settings
            </button>
          </nav>

          <div className="p-4 border-t border-slate-800">
            <div className="mb-4 px-2">
              {isSupabaseConfigured ? (
                <div className="flex items-center gap-2 text-xs text-green-400 bg-green-900/30 px-3 py-2 rounded-md border border-green-900">
                  <Cloud className="w-3 h-3" /> <span>Cloud Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/30 px-3 py-2 rounded-md border border-amber-900">
                  <CloudOff className="w-3 h-3" /> <span>Offline Mode</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xs">JD</div>
              <div>
                <p className="text-sm font-medium">Jane Doe</p>
                <p className="text-xs text-slate-500">Clinical Engineer</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-blue-600">Syncing with cloud...</p>
            </div>
          </div>
        )}

        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
             <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-slate-600"><Menu className="w-6 h-6" /></button>
             <h2 className="text-lg font-semibold text-slate-800">
               {view === 'DASHBOARD' && 'Overview'}
               {view === 'INVENTORY' && 'Device Inventory'}
               {view === 'PLANNER' && 'Maintenance Planner'}
               {view === 'ADD_DEVICE' && 'Register Device'}
               {view === 'DEVICE_DETAIL' && 'Device Details'}
               {view === 'SETTINGS' && 'Settings'}
             </h2>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto h-full">
            {view === 'DASHBOARD' && <Dashboard devices={devices} />}
            {view === 'INVENTORY' && (
              <DeviceList 
                devices={devices} 
                onSelectDevice={handleSelectDevice} 
                onDelete={handleDeleteDevice}
                onAddDevice={() => setView('ADD_DEVICE')} 
              />
            )}
            {view === 'PLANNER' && (
              <MaintenancePlanner 
                devices={devices} 
                onApplyPlan={handleApplyGlobalPlan} 
              />
            )}
            {view === 'ADD_DEVICE' && (
              <AddDeviceForm 
                onSave={handleAddDevice}
                onBulkSave={handleBulkAddDevices}
                onCancel={() => setView('INVENTORY')}
              />
            )}
            {view === 'DEVICE_DETAIL' && selectedDevice && (
              <DeviceDetail 
                device={selectedDevice} 
                onBack={() => setView('INVENTORY')}
                onUpdate={handleUpdateDevice}
                onDelete={() => handleDeleteDevice(selectedDevice.id)}
              />
            )}
            {view === 'SETTINGS' && <Settings devices={devices} onImport={handleImportData} />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;