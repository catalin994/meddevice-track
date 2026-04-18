
import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { LayoutDashboard, List, Stethoscope, Menu, X, ShieldCheck, Loader2, CheckSquare, Settings as SettingsIcon, CalendarRange, RefreshCw, Cloud, CloudOff, Database, AlertCircle, Zap } from 'lucide-react';

const importDashboard = () => import('./components/Dashboard');
const importDeviceList = () => import('./components/DeviceList');
const importDeviceDetail = () => import('./components/DeviceDetail');
const importAddDeviceForm = () => import('./components/AddDeviceForm');
const importMaintenancePlanner = () => import('./components/MaintenancePlanner');
const importSettings = () => import('./components/Settings');
const importTaskTracker = () => import('./components/TaskTracker');

const Dashboard = lazy(importDashboard);
const DeviceList = lazy(importDeviceList);
const DeviceDetail = lazy(importDeviceDetail);
const AddDeviceForm = lazy(importAddDeviceForm);
const MaintenancePlanner = lazy(importMaintenancePlanner);
const Settings = lazy(importSettings);
const TaskTracker = lazy(importTaskTracker);

const prefetchModules = () => {
  // Use requestIdleCallback if available, otherwise setTimeout
  const schedule = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 1000));
  
  schedule(() => {
    // Stagger imports to avoid network congestion
    const imports = [
      importDashboard,
      importDeviceList,
      importDeviceDetail,
      importAddDeviceForm,
      importMaintenancePlanner,
      importSettings,
      importTaskTracker
    ];
    
    imports.forEach((imp, index) => {
      setTimeout(() => imp(), index * 200);
    });
  });
};

import { MedicalDevice, MedicalTask, ViewState, DeviceStatus, MaintenanceType, TaskStatus, TaskPriority } from './types';
import { supabase, isSupabaseConfigured, checkConnection } from './services/supabase';
import { getAllDevicesFromDB, saveDevicesToDB, deleteDeviceFromDB, getAllTasksFromDB, saveTasksToDB, deleteTaskFromDB } from './services/storageService';

const MOCK_DEVICES: MedicalDevice[] = [
  {
    id: 'DEV-INITIAL-001',
    name: 'MRI Scanner Elite X',
    category: 'Echipament Imagistica',
    manufacturer: 'Siemens Healthineers',
    model: 'Magnetom Vida',
    serialNumber: 'SN-9982-X2',
    department: 'Radiology',
    purchaseDate: '2022-03-15',
    status: DeviceStatus.ACTIVE,
    isCNCAN: true,
    notes: 'Primary MRI for emergency ward.',
    files: [],
    maintenanceHistory: [],
    contracts: [],
    components: [],
    updated_at: new Date().toISOString()
  }
];

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'cloud' | 'local' | 'error' | 'table-missing' | 'paused'>('local');
  const [devices, setDevices] = useState<MedicalDevice[]>([]);
  const [tasks, setTasks] = useState<MedicalTask[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Deep Linking & Standalone Mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const idParam = params.get('id');
    const standaloneParam = params.get('standalone');

    if (standaloneParam === 'true') {
      setIsStandalone(true);
    }

    if (viewParam === 'DEVICE_DETAIL' && idParam) {
      setSelectedDeviceId(idParam);
      setView('DEVICE_DETAIL');
    }

    // Prefetch other modules after initial load
    prefetchModules();
  }, []);

  const devicesMap = useMemo(() => {
    return new Map(devices.map(d => [String(d.id).trim(), d]));
  }, [devices]);

  const selectedDevice = useMemo(() => {
    if (!selectedDeviceId) return null;
    return devicesMap.get(String(selectedDeviceId).trim()) || null;
  }, [devicesMap, selectedDeviceId]);

  const normalizeDevice = useCallback((d: any): MedicalDevice => {
    const safeId = String(d.id || d.ID || crypto.randomUUID()).trim();
    const files = Array.isArray(d.files) ? d.files : [];
    
    // Debug large files
    if (files.length > 0) {
      const totalSize = files.reduce((acc: number, f: any) => acc + (f.url?.length || 0), 0);
      if (totalSize > 1024 * 1024) {
        console.log(`[App] Device ${safeId} has large file payload: ~${Math.round(totalSize / 1024)}KB`);
      }
    }

    return {
      ...d,
      id: safeId,
      name: d.name || d.Name || 'Unnamed Asset',
      category: d.category || d.Category || 'Altele',
      status: d.status || d.Status || DeviceStatus.ACTIVE,
      department: d.department || d.Department || 'Unassigned',
      manufacturer: d.manufacturer || d.Manufacturer || 'Unknown',
      model: d.model || d.Model || 'N/A',
      serialNumber: d.serialNumber || d.SerialNumber || 'N/A',
      maintenanceHistory: Array.isArray(d.maintenanceHistory) ? d.maintenanceHistory : [],
      contracts: Array.isArray(d.contracts) ? d.contracts : [],
      files: files,
      components: Array.isArray(d.components) ? d.components : [],
      updated_at: d.updated_at || d.updatedAt
    } as MedicalDevice;
  }, []);

  const loadAndSync = useCallback(async () => {
    setIsLoading(true);
    setSyncStatus('local');
    try {
      // 1. Immediate UI from Local Storage
      const [localDevices, localTasks] = await Promise.all([
        getAllDevicesFromDB(),
        getAllTasksFromDB()
      ]);
      
      const deviceMap = new Map<string, MedicalDevice>();
      localDevices.forEach(d => deviceMap.set(d.id, d));
      
      // Data Cleanup: Trim departments to unify duplicates
      const cleanedDevices = (localDevices.length > 0 ? localDevices : MOCK_DEVICES).map(d => ({ ...d, department: (d.department || 'Unassigned').trim() }));
      const cleanedTasks = localTasks.map(t => ({ ...t, department: (t.department || 'Unassigned').trim() }));

      setDevices(cleanedDevices);
      setTasks(cleanedTasks);

      // UI is ready with local data - hide loader immediately for faster perceived performance
      setIsLoading(false);

      // 2. Cloud Handshake & Sync in background
      if (isSupabaseConfigured && supabase) {
        const connection = await checkConnection();
        
        if (!connection.success) {
          if (connection.errorType === 'paused') setSyncStatus('paused');
          else if (connection.errorType === 'table') setSyncStatus('table-missing');
          else setSyncStatus('error');
          return;
        }

        // 3. Successful Wake-up Sync
        try {
          // Parallel fetch from cloud
          const [deviceRes, taskRes] = await Promise.all([
            supabase.from('devices').select('*').order('id', { ascending: true }),
            supabase.from('tasks').select('*').order('id', { ascending: true })
          ]);

          if (deviceRes.error) throw deviceRes.error;
          
          // Sync Devices
          if (deviceRes.data && deviceRes.data.length > 0) {
            const cloudDevices: MedicalDevice[] = deviceRes.data.map(normalizeDevice);
            
            cloudDevices.forEach((d: MedicalDevice) => {
              const local = deviceMap.get(d.id);
              // Only overwrite if:
              // 1. Local doesn't exist
              // 2. Local doesn't have a timestamp (old data)
              // 3. Cloud has a strictly newer timestamp
              const cloudTime = d.updated_at ? new Date(d.updated_at).getTime() : 0;
              const localTime = local?.updated_at ? new Date(local.updated_at).getTime() : 0;

              if (!local || !local.updated_at || (cloudTime > localTime)) {
                deviceMap.set(d.id, d);
              }
            });

            const finalMerged = Array.from(deviceMap.values());
            setDevices(finalMerged);
            await saveDevicesToDB(finalMerged);
            
            // If local was newer, push it to cloud
            const newerLocals = Array.from(deviceMap.values()).filter(d => {
              const cloud = cloudDevices.find(cd => cd.id === d.id);
              const cloudTime = cloud?.updated_at ? new Date(cloud.updated_at).getTime() : 0;
              const localTime = d.updated_at ? new Date(d.updated_at).getTime() : 0;
              return !cloud || (localTime > cloudTime);
            });
            if (newerLocals.length > 0) {
              await supabase.from('devices').upsert(newerLocals);
            }
          } else if (localDevices.length > 0) {
            await supabase.from('devices').upsert(localDevices);
          }

          // Sync Tasks
          if (taskRes.error) {
             console.warn("[App] Tasks sync skipped (table might be missing)");
          } else if (taskRes.data && taskRes.data.length > 0) {
             const cloudTasks: MedicalTask[] = taskRes.data;
             const taskMap = new Map<string, MedicalTask>(localTasks.map(t => [t.id, t]));
             
             cloudTasks.forEach(ct => {
               const local = taskMap.get(ct.id);
               const cloudTime = ct.updated_at ? new Date(ct.updated_at).getTime() : 0;
               const localTime = local?.updated_at ? new Date(local.updated_at).getTime() : 0;
               
               if (!local || !local.updated_at || cloudTime > localTime) {
                 taskMap.set(ct.id, ct);
               }
             });

             const finalTasks = Array.from(taskMap.values());
             setTasks(finalTasks);
             await saveTasksToDB(finalTasks);

             // Push newer local tasks to cloud
             const newerLocalTasks = finalTasks.filter(t => {
               const cloud = cloudTasks.find(ct => ct.id === t.id);
               const cloudTime = cloud?.updated_at ? new Date(cloud.updated_at).getTime() : 0;
               const localTime = t.updated_at ? new Date(t.updated_at).getTime() : 0;
               return !cloud || localTime > cloudTime;
             });
             if (newerLocalTasks.length > 0) {
               await supabase.from('tasks').upsert(newerLocalTasks);
             }
          } else if (localTasks.length > 0) {
             await supabase.from('tasks').upsert(localTasks);
          }

          setSyncStatus('cloud');
        } catch (e) {
          console.error("[App] Cloud sync error:", e);
          setSyncStatus('error');
        }
      }
    } catch (err) {
      console.error("[App] Registry engine failure:", err);
      setSyncStatus('error');
      setIsLoading(false);
    }
  }, [normalizeDevice]);

  useEffect(() => { loadAndSync(); }, [loadAndSync]);

  const handleDeleteDevice = useCallback(async (id: string) => {
    if (!id) return;
    const safeId = String(id).trim();
    setSelectedDeviceId(null);
    setView('INVENTORY');
    setDevices(prev => prev.filter(d => d.id !== safeId));

    setIsSyncing(true);
    try {
      await deleteDeviceFromDB(safeId);
      if (isSupabaseConfigured && supabase) {
        await supabase.from('devices').delete().eq('id', safeId);
      }
    } catch (error) {
      console.error("[Registry] Purge failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSupabaseConfigured]);

  const handleUpsertDevices = useCallback(async (data: MedicalDevice | MedicalDevice[]) => {
    const now = new Date().toISOString();
    const items = Array.isArray(data) ? data : [data];
    const payload: MedicalDevice[] = items.map(d => ({ ...normalizeDevice(d), updated_at: now }));
    if (payload.length === 0) return;

    setDevices((prev: MedicalDevice[]) => {
      const map = new Map<string, MedicalDevice>(prev.map((d: MedicalDevice) => [d.id, d]));
      payload.forEach((p: MedicalDevice) => map.set(p.id, p));
      return Array.from(map.values());
    });

    setIsSyncing(true);
    try {
      console.log(`[Registry] Committing ${payload.length} items to local and cloud storage...`);
      await saveDevicesToDB(payload);
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('devices').upsert(payload, { onConflict: 'id' });
        if (error) throw error;
        console.log(`[Registry] Cloud sync successful.`);
      }
    } catch (err) {
      console.error("[Registry] Sync deferred:", err);
    } finally { 
      setIsSyncing(false); 
    }
  }, [isSupabaseConfigured, normalizeDevice]);

  const handleUpsertTasks = useCallback(async (data: MedicalTask | MedicalTask[]) => {
    const now = new Date().toISOString();
    const items = (Array.isArray(data) ? data : [data]).map(t => ({ ...t, updated_at: now }));
    if (items.length === 0) return;

    setTasks((prev: MedicalTask[]) => {
      const map = new Map<string, MedicalTask>(prev.map((t: MedicalTask) => [t.id, t]));
      items.forEach((p: MedicalTask) => map.set(p.id, p));
      return Array.from(map.values());
    });

    setIsSyncing(true);
    try {
      await saveTasksToDB(items);
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('tasks').upsert(items, { onConflict: 'id' });
        if (error) throw error;
      }
    } catch (err) {
      console.error("[Tasks] Sync deferred:", err);
    } finally { 
      setIsSyncing(false); 
    }
  }, [isSupabaseConfigured]);

  const handleSelectDevice = useCallback((d: import('./types').MedicalDevice) => {
    setSelectedDeviceId(d.id);
    setView('DEVICE_DETAIL');
  }, []);

  const handleAddDevice = useCallback(() => setView('ADD_DEVICE'), []);

  const handleDeleteTask = useCallback(async (id: string) => {
    if (!id) return;
    const safeId = String(id).trim();
    setTasks(prev => prev.filter(t => t.id !== safeId));

    setIsSyncing(true);
    try {
      await deleteTaskFromDB(safeId);
      if (isSupabaseConfigured && supabase) {
        await supabase.from('tasks').delete().eq('id', safeId);
      }
    } catch (error) {
      console.error("[Tasks] Purge failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSupabaseConfigured]);

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      {!isStandalone && (
        <aside className={`fixed lg:static inset-y-0 left-0 z-[100] w-72 bg-white border-r border-slate-200 transform transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="h-full flex flex-col relative">
            <div className="absolute top-0 right-0 w-1 h-full bg-slate-50" />
            <div className="p-8 flex items-center gap-4 border-b border-slate-100 bg-white">
              <div className="bg-slate-900 p-2.5 rounded-xl shadow-xl shadow-slate-900/10 ring-1 ring-white/20">
                <Stethoscope className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase leading-none">MediTrack</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5">Fleet Registry v3.1</p>
              </div>
            </div>
            
            <nav className="flex-1 p-6 space-y-1.5 overflow-y-auto no-scrollbar bg-white">
              <div className="px-3 mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Operations</p>
              </div>
              <NavItem active={view === 'DASHBOARD'} onClick={() => { setView('DASHBOARD'); setSidebarOpen(false); }} icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" />
              <NavItem active={view === 'INVENTORY'} onClick={() => { setView('INVENTORY'); setSidebarOpen(false); }} icon={<List className="w-4 h-4" />} label="Inventory" />
              <NavItem active={view === 'TASKS'} onClick={() => { setView('TASKS'); setSidebarOpen(false); }} icon={<CheckSquare className="w-4 h-4" />} label="Service Tickets" />
              <NavItem active={view === 'PLANNER'} onClick={() => { setView('PLANNER'); setSidebarOpen(false); }} icon={<CalendarRange className="w-4 h-4" />} label="Maintenance" />
              
              <div className="px-3 mt-8 mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">System</p>
              </div>
              <NavItem active={view === 'SETTINGS'} onClick={() => { setView('SETTINGS'); setSidebarOpen(false); }} icon={<SettingsIcon className="w-4 h-4" />} label="Configuration" />
            </nav>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50/50">
               <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cloud Sync</p>
                    <div className={`w-2 h-2 rounded-full ${syncStatus === 'cloud' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500'}`} />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${syncStatus === 'cloud' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {syncStatus === 'cloud' ? <Cloud className="w-4 h-4" /> : <RefreshCw className="w-4 h-4 animate-spin" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-slate-900">{syncStatus === 'cloud' ? 'Operational' : 'Syncing...'}</p>
                      <p className="text-[10px] font-medium text-slate-500">Last: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <button onClick={loadAndSync} className="w-full py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors active:scale-95">Re-Sync Engine</button>
               </div>
            </div>
          </div>
        </aside>
      )}

      <main className={`flex-1 flex flex-col overflow-hidden relative ${isStandalone ? 'bg-white' : ''}`}>
        {!isStandalone && (
          <header className="h-24 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0 z-50">
            <div className="flex items-center gap-4">
               <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"><Menu className="w-5 h-5" /></button>
               <div>
                 <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">{view.replace('_', ' ')}</h2>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-2">Fleet Management System</p>
               </div>
            </div>
            <div className="flex items-center gap-6">
              {isSyncing && (
                <div className="flex items-center gap-2.5 px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl">
                  <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Committing Data</span>
                </div>
              )}
              <div className="h-8 w-px bg-slate-200" />
              {view === 'INVENTORY' && (
                <button onClick={() => setView('ADD_DEVICE')} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all hover:bg-blue-700 hover:-translate-y-0.5">
                  + Register New Asset
                </button>
              )}
            </div>
          </header>
        )}

        <div className={`flex-1 overflow-y-auto relative custom-scrollbar ${isStandalone ? 'p-0' : 'p-6 lg:p-10'}`}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-6 animate-fade-in">
              <div className="relative">
                 <div className="w-24 h-24 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                 <Stethoscope className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">MediTrack OS</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Initializing Core Registry...</p>
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto animate-slide-up">
              <Suspense fallback={
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Module...</p>
                </div>
              }>
                {view === 'DASHBOARD' && <Dashboard devices={devices} tasks={tasks} />}
                {view === 'INVENTORY' && <DeviceList devices={devices} onSelectDevice={handleSelectDevice} onUpdateDevice={handleUpsertDevices} onBulkUpdate={handleUpsertDevices} onDelete={handleDeleteDevice} onAddDevice={handleAddDevice} />}
                {view === 'DEVICE_DETAIL' && selectedDevice && (
                  <DeviceDetail 
                    device={selectedDevice} 
                    allDevices={devices} 
                    tasks={tasks.filter(t => String(t.deviceId).trim() === String(selectedDevice.id).trim())} 
                    onBack={() => { setView('INVENTORY'); setSelectedDeviceId(null); }} 
                    onUpdate={handleUpsertDevices} 
                    onDelete={handleDeleteDevice} 
                    onAddTask={handleUpsertTasks} 
                    isStandalone={isStandalone}
                  />
                )}
                {view === 'TASKS' && (
                  <TaskTracker 
                    tasks={tasks} 
                    devices={devices} 
                    onAddTask={handleUpsertTasks} 
                    onUpdateTask={handleUpsertTasks} 
                    onDeleteTask={handleDeleteTask} 
                  />
                )}
                {view === 'ADD_DEVICE' && <AddDeviceForm devices={devices} onSave={async (d) => { await handleUpsertDevices(d); setView('INVENTORY'); }} onBulkSave={async (ds) => { await handleUpsertDevices(ds); setView('INVENTORY'); }} onCancel={() => setView('INVENTORY')} />}
                {view === 'PLANNER' && <MaintenancePlanner devices={devices} onApplyPlan={handleUpsertDevices} />}
                {view === 'SETTINGS' && <Settings devices={devices} onImport={handleUpsertDevices} />}
              </Suspense>
            </div>
          )}
        </div>
      </main>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-[90] lg:hidden transition-opacity duration-300" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
};

const NavItem = React.memo(({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-4 w-full px-4 py-3.5 text-sm font-bold rounded-xl transition-all duration-200 group ${active ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>
    <div className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</div>
    <span className="flex-1 text-left tracking-tight">{label}</span>
    {active && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />}
  </button>
));

export default App;
