
import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { LayoutDashboard, List, Stethoscope, Menu, X, ShieldCheck, Loader2, CheckSquare, Settings as SettingsIcon, CalendarRange, RefreshCw, Cloud, CloudOff, Database, AlertCircle, Zap, QrCode, ScanLine, Wallet, Search, LogOut, User, Plus } from 'lucide-react';

const importDashboard = () => import('./components/Dashboard');
const importDeviceList = () => import('./components/DeviceList');
const importDeviceDetail = () => import('./components/DeviceDetail');
const importAddDeviceForm = () => import('./components/AddDeviceForm');
const importMaintenancePlanner = () => import('./components/MaintenancePlanner');
const importSettings = () => import('./components/Settings');
const importTaskTracker = () => import('./components/TaskTracker');
const importQRScanner = () => import('./components/QRScanner');
const importDocumentScanner = () => import('./components/DocumentScanner');
const importFinanceManager = () => import('./components/FinanceManager');
const importCommandPalette = () => import('./components/CommandPalette');

const Dashboard = lazy(importDashboard);
const QRScanner = lazy(importQRScanner);
const DocumentScanner = lazy(importDocumentScanner);
const DeviceList = lazy(importDeviceList);
const DeviceDetail = lazy(importDeviceDetail);
const AddDeviceForm = lazy(importAddDeviceForm);
const MaintenancePlanner = lazy(importMaintenancePlanner);
const Settings = lazy(importSettings);
const TaskTracker = lazy(importTaskTracker);
const FinanceManager = lazy(importFinanceManager);
const CommandPalette = lazy(importCommandPalette);

const prefetchModules = () => {
  // In dev mode Vite serves unminified deps — prefetching causes the browser to
  // parse 3-4 MB of JS (recharts, xlsx, exceljs…) right after load, causing jank.
  // In production chunks are minified and cached; prefetch is safe there.
  if (import.meta.env.DEV) return;

  const schedule = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 2000));
  schedule(() => {
    const imports = [
      importDashboard,
      importDeviceList,
      importDeviceDetail,
      importAddDeviceForm,
      importMaintenancePlanner,
      importSettings,
      importTaskTracker
    ];
    imports.forEach((imp, index) => setTimeout(() => imp(), index * 300));
  });
};

import { MedicalDevice, MedicalTask, Invoice, Contract, Deletion, ViewState, DeviceStatus, MaintenanceType, TaskStatus, TaskPriority, AppUser, AuditEntry, hasPermission, ROLE_LABELS } from './types';
import { supabase, isSupabaseConfigured, checkConnection, fetchAllRows, upsertInChunks } from './services/supabase';
import { getAllDevicesFromDB, saveDevicesToDB, deleteDeviceFromDB, getAllTasksFromDB, saveTasksToDB, deleteTaskFromDB, getAllInvoicesFromDB, saveInvoicesToDB, deleteInvoiceFromDB, getAllAuditFromDB, saveAuditToDB, getAllDeletionsFromDB, saveDeletionsToDB } from './services/storageService';
import { getCurrentUser, logout as authLogout } from './services/authService';
import { mergeDeviceRecords, buildUploadSet } from './services/syncMerge';
import LoginScreen from './components/LoginScreen';

const VIEW_LABELS: Record<string, string> = {
  DASHBOARD: 'Panou',
  INVENTORY: 'Inventar',
  DEVICE_DETAIL: 'Fisa dispozitivului',
  ADD_DEVICE: 'Dispozitiv nou',
  SETTINGS: 'Configurare',
  PLANNER: 'Mentenanta',
  CONTRACTS: 'Contracte',
  TASKS: 'Tichete service',
  FINANCE: 'Financiar',
};

/**
 * The three actions people reach for constantly. They sit in their own bar
 * under the header rather than as unlabelled dark icons among the utility
 * controls, so they read the same way on every page.
 */
const PrimaryAction: React.FC<{
  icon: React.ReactNode;
  label: string;
  shortLabel: string;
  hint: string;
  variant: 'blue' | 'dark' | 'green';
  onClick: () => void;
}> = ({ icon, label, shortLabel, hint, variant, onClick }) => {
  const styles = {
    blue: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20',
    dark: 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20',
    green: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20',
  }[variant];
  return (
    <button
      onClick={onClick}
      title={hint}
      className={`${styles} flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-3.5 text-white rounded-xl shadow-lg font-black text-[10px] sm:text-[11px] uppercase tracking-widest transition active:scale-95`}
    >
      {icon}
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

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
  // Why the last sync ended the way it did — without this, a failure is
  // indistinguishable from "still working" and the button looks dead.
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [devices, setDevices] = useState<MedicalDevice[]>([]);
  const [tasks, setTasks] = useState<MedicalTask[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('--:--');
  const [showScanner, setShowScanner] = useState(false);
  const [showDocScanner, setShowDocScanner] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getCurrentUser());
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  const canFinance = hasPermission(currentUser, 'finance');
  const canEdit = hasPermission(currentUser, 'edit');
  const canDelete = hasPermission(currentUser, 'delete');

  // Global Ctrl+K / Cmd+K shortcut for the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowPalette(p => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = useCallback(() => {
    authLogout();
    setCurrentUser(null);
    setView('DASHBOARD');
  }, []);

  // Every in-app navigation pushes a real history entry, so the phone's Back
  // button and the back-swipe gesture step back through the app instead of
  // leaving it. `historyDepth` tracks how many entries we own, so the in-app
  // back control can reuse the same history when there is one.
  const historyDepth = useRef(0);

  const navigate = useCallback((nextView: ViewState, deviceId: string | null = null) => {
    setView(nextView);
    setSelectedDeviceId(deviceId);
    try {
      window.history.pushState({ mtView: nextView, mtDeviceId: deviceId }, '');
      historyDepth.current += 1;
    } catch { /* history unavailable — the view still changed */ }
  }, []);

  const goBack = useCallback(() => {
    if (historyDepth.current > 0) {
      window.history.back();
    } else {
      // Opened straight into a device (QR deep link), so there is nothing to
      // pop — land on the inventory instead of falling out of the app.
      setView('INVENTORY');
      setSelectedDeviceId(null);
    }
  }, []);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      historyDepth.current = Math.max(0, historyDepth.current - 1);
      const state = e.state as { mtView?: ViewState; mtDeviceId?: string | null } | null;
      setView(state?.mtView || 'DASHBOARD');
      setSelectedDeviceId(state?.mtDeviceId ?? null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Deep Linking & Standalone Mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const idParam = params.get('id');
    const standaloneParam = params.get('standalone');

    if (standaloneParam === 'true') {
      setIsStandalone(true);
    }

    const deepLinked = viewParam === 'DEVICE_DETAIL' && !!idParam;
    if (deepLinked) {
      setSelectedDeviceId(idParam);
      setView('DEVICE_DETAIL');
    }

    // Stamp the entry we started on, so popping back to it restores the right
    // view rather than dumping the user on the dashboard.
    try {
      window.history.replaceState(
        { mtView: deepLinked ? 'DEVICE_DETAIL' : 'DASHBOARD', mtDeviceId: deepLinked ? idParam : null },
        ''
      );
    } catch { /* ignore */ }

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
      tags: Array.isArray(d.tags) ? d.tags : [],
      updated_at: d.updated_at || d.updatedAt
    } as MedicalDevice;
  }, []);

  /** Records that an entity was deleted, locally and in the cloud, so other
   *  devices remove it instead of uploading their stale copy back. */
  const recordDeletion = useCallback(async (entity: Deletion['entity'], entityId: string) => {
    const tombstone: Deletion = {
      id: `${entity}:${entityId}`,
      entity,
      entityId,
      deletedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await saveDeletionsToDB([tombstone]).catch(() => {});
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('deletions').upsert([tombstone], { onConflict: 'id' });
      if (error) console.warn('[Sync] Deletion not recorded in cloud:', error.message);
    }
  }, [isSupabaseConfigured]);

  const logAudit = useCallback((action: AuditEntry['action'], entity: AuditEntry['entity'], entityId: string, entityName: string, details?: string) => {
    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userName: getCurrentUser()?.name || 'Necunoscut',
      action, entity, entityId, entityName, details,
      updated_at: new Date().toISOString(),
    };
    setAuditLog(prev => [entry, ...prev].slice(0, 2000));
    // Best-effort persistence — the audit trail must never break the main flow
    saveAuditToDB([entry]).catch(() => {});
    if (isSupabaseConfigured && supabase) {
      supabase.from('audit_logs').insert([entry]).then(({ error }) => {
        if (error) console.warn('[Audit] Cloud log skipped:', error.message);
      });
    }
  }, []);

  const loadAndSync = useCallback(async () => {
    setIsLoading(true);
    setIsSyncingNow(true);
    setSyncStatus('local');
    setSyncMessage('Se citesc datele locale...');
    try {
      // 1. Immediate UI from Local Storage
      const [localDevices, localTasks, localInvoices, localDeletions] = await Promise.all([
        getAllDevicesFromDB(),
        getAllTasksFromDB(),
        getAllInvoicesFromDB().catch(() => [] as Invoice[]),
        getAllDeletionsFromDB().catch(() => [] as Deletion[])
      ]);
      
      const deviceMap = new Map<string, MedicalDevice>();
      localDevices.forEach(d => deviceMap.set(d.id, d));
      
      // Data Cleanup: Trim departments to unify duplicates
      const cleanedDevices = (localDevices.length > 0 ? localDevices : MOCK_DEVICES).map(d => ({ ...d, department: (d.department || 'Unassigned').trim() }));
      const cleanedTasks = localTasks.map(t => ({ ...t, department: (t.department || 'Unassigned').trim() }));

      setDevices(cleanedDevices);
      setTasks(cleanedTasks);
      setInvoices(localInvoices);
      getAllAuditFromDB()
        .then(entries => setAuditLog(entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 2000)))
        .catch(() => {});

      // UI is ready with local data - hide loader immediately for faster perceived performance
      setIsLoading(false);

      // 2. Cloud Handshake & Sync in background
      if (isSupabaseConfigured && supabase) {
        const connection = await checkConnection();
        
        if (!connection.success) {
          if (connection.errorType === 'paused') setSyncStatus('paused');
          else if (connection.errorType === 'table') setSyncStatus('table-missing');
          else setSyncStatus('error');
          setSyncMessage(connection.message || 'Conexiunea la cloud a esuat');
          setIsSyncingNow(false);
          return;
        }
        setSyncMessage('Se descarca din cloud...');

        // 3. Successful Wake-up Sync
        try {
          // Parallel fetch from cloud
          const [deviceRes, taskRes, deletionRes] = await Promise.all([
            fetchAllRows<any>('devices'),
            fetchAllRows<any>('tasks'),
            fetchAllRows<Deletion>('deletions').catch(() => ({ data: [] as Deletion[], error: null }))
          ]);

          // Merge tombstones from every device, then apply them: anything
          // deleted anywhere must disappear here too, and must never be
          // uploaded back to the cloud.
          const tombstones = new Map<string, Deletion>(localDeletions.map(d => [d.id, d]));
          (deletionRes.data || []).forEach(d => { if (d?.id) tombstones.set(d.id, d); });

          const deletedDeviceIds = new Set(
            Array.from(tombstones.values()).filter(d => d.entity === 'device').map(d => d.entityId)
          );
          const deletedTaskIds = new Set(
            Array.from(tombstones.values()).filter(d => d.entity === 'task').map(d => d.entityId)
          );

          // Persist the combined log and push back any tombstone the cloud lacks
          const allTombstones = Array.from(tombstones.values());
          if (allTombstones.length > 0) {
            await saveDeletionsToDB(allTombstones).catch(() => {});
            const cloudIds = new Set((deletionRes.data || []).map(d => d.id));
            const missingInCloud = allTombstones.filter(d => !cloudIds.has(d.id));
            if (missingInCloud.length > 0) {
              await upsertInChunks('deletions', missingInCloud, 200);
            }
          }

          // Drop locally-held copies of things that were deleted elsewhere
          if (deletedDeviceIds.size > 0) {
            for (const gone of deletedDeviceIds) {
              if (deviceMap.has(gone)) {
                deviceMap.delete(gone);
                await deleteDeviceFromDB(gone).catch(() => {});
              }
            }
          }

          if (deviceRes.error) throw deviceRes.error;
          
          // Sync Devices
          if (deviceRes.data && deviceRes.data.length > 0) {
            const cloudDevices: MedicalDevice[] = deviceRes.data.map(normalizeDevice);
            
            // Merge each side field by field: scalars follow the newer copy,
            // but documents and history are combined so a scan made on one
            // phone is never dropped by another phone's older record.
            cloudDevices.forEach((d: MedicalDevice) => {
              if (deletedDeviceIds.has(d.id)) return; // deleted elsewhere
              deviceMap.set(d.id, mergeDeviceRecords(deviceMap.get(d.id), d));
            });

            const finalMerged = Array.from(deviceMap.values());
            setDevices(finalMerged);
            await saveDevicesToDB(finalMerged);

            const newerLocals = buildUploadSet(
              finalMerged.filter(d => !deletedDeviceIds.has(d.id)),
              cloudDevices,
            );
            if (newerLocals.length > 0) {
              const { error: pushErr } = await upsertInChunks('devices', newerLocals);
              if (pushErr) console.warn('[App] Device push incomplete:', pushErr.message);
            }
          } else if (localDevices.length > 0) {
            const { error: seedErr } = await upsertInChunks('devices', localDevices);
            if (seedErr) console.warn('[App] Device seed incomplete:', seedErr.message);
          }

          // Sync Tasks
          if (taskRes.error) {
             console.warn("[App] Tasks sync skipped (table might be missing)");
          } else if (taskRes.data && taskRes.data.length > 0) {
             const cloudTasks: MedicalTask[] = taskRes.data;
             const taskMap = new Map<string, MedicalTask>(localTasks.filter(t => !deletedTaskIds.has(t.id)).map(t => [t.id, t]));

             cloudTasks.forEach(ct => {
               if (deletedTaskIds.has(ct.id)) return;
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
               await upsertInChunks('tasks', newerLocalTasks);
             }
          } else if (localTasks.length > 0) {
             await upsertInChunks('tasks', localTasks);
          }

          // Sync Invoices (tolerant — table may not exist yet)
          try {
            const invoiceRes = await fetchAllRows<Invoice>('invoices');
            if (!invoiceRes.error && invoiceRes.data) {
              const cloudInvoices: Invoice[] = invoiceRes.data;
              const invoiceMap = new Map<string, Invoice>(localInvoices.map(i => [i.id, i]));

              cloudInvoices.forEach(ci => {
                const local = invoiceMap.get(ci.id);
                const cloudTime = ci.updated_at ? new Date(ci.updated_at).getTime() : 0;
                const localTime = local?.updated_at ? new Date(local.updated_at).getTime() : 0;
                if (!local || !local.updated_at || cloudTime > localTime) {
                  invoiceMap.set(ci.id, ci);
                }
              });

              const finalInvoices = Array.from(invoiceMap.values());
              setInvoices(finalInvoices);
              await saveInvoicesToDB(finalInvoices);

              const newerLocalInvoices = finalInvoices.filter(i => {
                const cloud = cloudInvoices.find(ci => ci.id === i.id);
                const cloudTime = cloud?.updated_at ? new Date(cloud.updated_at).getTime() : 0;
                const localTime = i.updated_at ? new Date(i.updated_at).getTime() : 0;
                return !cloud || localTime > cloudTime;
              });
              if (newerLocalInvoices.length > 0) {
                await upsertInChunks('invoices', newerLocalInvoices);
              }
            } else if (invoiceRes.error) {
              console.warn("[App] Invoices sync skipped (table might be missing)");
            }
          } catch {
            console.warn("[App] Invoices sync skipped");
          }

          setSyncStatus('cloud');
          setSyncMessage('');
          setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        } catch (e: any) {
          console.error("[App] Cloud sync error:", e);
          setSyncStatus('error');
          setSyncMessage(e?.message || String(e) || 'Eroare la sincronizare');
        }
      } else {
        setSyncMessage('Cloud neconfigurat — datele ramin doar pe acest dispozitiv');
      }
    } catch (err: any) {
      console.error("[App] Registry engine failure:", err);
      setSyncStatus('error');
      setSyncMessage(err?.message || 'Eroare la citirea datelor');
      setIsLoading(false);
    } finally {
      setIsSyncingNow(false);
    }
  }, [normalizeDevice]);

  useEffect(() => { loadAndSync(); }, [loadAndSync]);

  const handleDeleteDevice = useCallback(async (id: string) => {
    if (!id) return;
    const safeId = String(id).trim();
    const target = devicesMap.get(safeId);
    logAudit('delete', 'device', safeId, target?.name || safeId, target ? `SN: ${target.serialNumber}` : undefined);
    setSelectedDeviceId(null);
    setView('INVENTORY');
    // Rewrite the current entry rather than pushing: pressing Back after a
    // delete must not return to the device that no longer exists.
    try { window.history.replaceState({ mtView: 'INVENTORY', mtDeviceId: null }, ''); } catch { /* ignore */ }
    setDevices(prev => prev.filter(d => d.id !== safeId));

    setIsSyncing(true);
    try {
      await deleteDeviceFromDB(safeId);
      await recordDeletion('device', safeId);
      if (isSupabaseConfigured && supabase) {
        await supabase.from('devices').delete().eq('id', safeId);
      }
    } catch (error) {
      console.error("[Registry] Purge failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSupabaseConfigured, devicesMap, logAudit, recordDeletion]);

  const handleUpsertDevices = useCallback(async (data: MedicalDevice | MedicalDevice[]) => {
    const now = new Date().toISOString();
    const items = Array.isArray(data) ? data : [data];
    const payload: MedicalDevice[] = items.map(d => ({ ...normalizeDevice(d), updated_at: now }));
    if (payload.length === 0) return;

    // Audit: individual entries for small edits, one summary entry for bulk imports
    if (payload.length <= 3) {
      payload.forEach(p => logAudit(devicesMap.has(p.id) ? 'update' : 'create', 'device', p.id, p.name, `SN: ${p.serialNumber}`));
    } else {
      logAudit('update', 'device', 'bulk', `${payload.length} dispozitive`, 'Import / actualizare in masa');
    }

    setDevices((prev: MedicalDevice[]) => {
      const map = new Map<string, MedicalDevice>(prev.map((d: MedicalDevice) => [d.id, d]));
      payload.forEach((p: MedicalDevice) => map.set(p.id, p));
      return Array.from(map.values());
    });

    setIsSyncing(true);
    try {
      await saveDevicesToDB(payload);
      if (isSupabaseConfigured && supabase) {
        // Chunked: a 2000-row Excel import in one request exceeds the size limit
        const { error } = await upsertInChunks('devices', payload);
        if (error) throw error;
      }
    } catch (err) {
      console.error("[Registry] Sync deferred:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSupabaseConfigured, normalizeDevice, devicesMap, logAudit]);

  const handleUpsertTasks = useCallback(async (data: MedicalTask | MedicalTask[]) => {
    const now = new Date().toISOString();
    const items = (Array.isArray(data) ? data : [data]).map(t => ({ ...t, updated_at: now }));
    if (items.length === 0) return;

    const existingIds = new Set(tasks.map(t => t.id));
    items.forEach(t => logAudit(existingIds.has(t.id) ? 'update' : 'create', 'task', t.id, t.title, t.deviceName));

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
  }, [isSupabaseConfigured, tasks, logAudit, recordDeletion]);

  const handleUpsertInvoice = useCallback(async (invoice: Invoice) => {
    const payload: Invoice = { ...invoice, updated_at: new Date().toISOString() };

    logAudit(invoices.some(i => i.id === payload.id) ? 'update' : 'create', 'invoice', payload.id, payload.invoiceNumber, `${payload.supplier} · ${payload.amount} ${payload.currency}`);

    setInvoices(prev => {
      const map = new Map(prev.map(i => [i.id, i]));
      map.set(payload.id, payload);
      return Array.from(map.values());
    });

    setIsSyncing(true);
    try {
      await saveInvoicesToDB([payload]);
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('invoices').upsert([payload], { onConflict: 'id' });
        if (error) console.warn("[Invoices] Cloud sync deferred:", error.message);
      }
    } catch (err) {
      console.error("[Invoices] Sync deferred:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSupabaseConfigured, invoices, logAudit, recordDeletion]);

  const handleDeleteInvoice = useCallback(async (id: string) => {
    if (!id) return;
    const target = invoices.find(i => i.id === id);
    logAudit('delete', 'invoice', id, target?.invoiceNumber || id, target ? `${target.supplier} · ${target.amount} ${target.currency}` : undefined);
    setInvoices(prev => prev.filter(i => i.id !== id));

    setIsSyncing(true);
    try {
      await deleteInvoiceFromDB(id);
      await recordDeletion('invoice', id);
      if (isSupabaseConfigured && supabase) {
        await supabase.from('invoices').delete().eq('id', id);
      }
    } catch (err) {
      console.error("[Invoices] Purge failed:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSupabaseConfigured, invoices, logAudit]);

  const handleSaveContract = useCallback(async (contract: Contract, deviceIds: string[]) => {
    const targets = devices.filter(d => deviceIds.includes(d.id));
    const updated = targets.map(d => ({
      ...d,
      contracts: [...(d.contracts || []).filter(c => c.contractNumber !== contract.contractNumber), contract]
    }));
    await handleUpsertDevices(updated);
  }, [devices, handleUpsertDevices]);

  const handleQRScan = useCallback((scanned: string) => {
    setShowScanner(false);
    const key = String(scanned).trim();
    // A label may carry the device id or just its serial number — accept both,
    // and match case-insensitively so a re-typed serial still resolves.
    const byId = devicesMap.get(key);
    const resolved = byId
      || devices.find(d => String(d.serialNumber || '').trim().toLowerCase() === key.toLowerCase())
      || devices.find(d => String(d.id).trim().toLowerCase() === key.toLowerCase());
    navigate('DEVICE_DETAIL', resolved ? resolved.id : key);
  }, [devices, devicesMap, navigate]);

  const handleDocScanSave = useCallback(async (deviceId: string, file: import('./types').DeviceFile) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;
    const updated = { ...device, files: [...(device.files || []), file] };
    await handleUpsertDevices(updated);
  }, [devices, handleUpsertDevices]);

  const handleSelectDevice = useCallback((d: import('./types').MedicalDevice) => {
    navigate('DEVICE_DETAIL', d.id);
  }, [navigate]);

  const handleAddDevice = useCallback(() => navigate('ADD_DEVICE'), [navigate]);

  const handleDeleteTask = useCallback(async (id: string) => {
    if (!id) return;
    const safeId = String(id).trim();
    const target = tasks.find(t => t.id === safeId);
    logAudit('delete', 'task', safeId, target?.title || safeId, target?.deviceName);
    setTasks(prev => prev.filter(t => t.id !== safeId));

    setIsSyncing(true);
    try {
      await deleteTaskFromDB(safeId);
      await recordDeletion('task', safeId);
      if (isSupabaseConfigured && supabase) {
        await supabase.from('tasks').delete().eq('id', safeId);
      }
    } catch (error) {
      console.error("[Tasks] Purge failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSupabaseConfigured, tasks, logAudit]);

  // Login gate — everything below requires an authenticated user
  if (!currentUser && !isStandalone) {
    return <LoginScreen onLogin={setCurrentUser} />;
  }

  return (
    <div className="flex app-shell bg-[#F8FAFC] overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      {!isStandalone && (
        <AppSidebar
          isSidebarOpen={isSidebarOpen}
          view={view}
          setView={navigate}
          setSidebarOpen={setSidebarOpen}
          syncStatus={syncStatus}
          lastSyncTime={lastSyncTime}
          loadAndSync={loadAndSync}
          syncMessage={syncMessage}
          isSyncingNow={isSyncingNow}
          canFinance={canFinance}
        />
      )}

      <main className={`flex-1 flex flex-col overflow-hidden relative ${isStandalone ? 'bg-white' : ''}`}>
        {!isStandalone && (
          <header className="h-16 sm:h-24 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 lg:px-10 shrink-0 z-50 gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
               <button
                 onClick={() => setSidebarOpen(true)}
                 aria-label="Deschide meniul"
                 title="Deschide meniul"
                 className="lg:hidden shrink-0 flex items-center gap-2 pl-3 pr-3.5 py-3 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-900/20 hover:bg-blue-600 active:scale-95 transition-all"
               >
                 <Menu className="w-6 h-6 shrink-0" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Meniu</span>
               </button>
               <div className="min-w-0">
                 <h2 className="text-base sm:text-xl font-black text-slate-900 uppercase tracking-tight leading-none truncate">{VIEW_LABELS[view] || view.replace('_', ' ')}</h2>
                 <p className="hidden sm:block text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-2">Sistem de Management Echipamente</p>
               </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
              {isSyncing && (
                <div className="flex items-center gap-2.5 px-2.5 sm:px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl">
                  <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                  <span className="hidden sm:inline text-[10px] font-black text-blue-600 uppercase tracking-widest">Se salveaza</span>
                </div>
              )}
              <button
                onClick={() => setShowPalette(true)}
                className="hidden md:flex items-center gap-3 px-4 py-3 bg-slate-50 border-2 border-slate-200 text-slate-500 rounded-xl hover:border-blue-300 hover:text-slate-700 transition-colors"
                title="Cautare globala"
              >
                <Search className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Cauta...</span>
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-black">Ctrl K</kbd>
              </button>
              {/* Mobile: compact search icon */}
              <button onClick={() => setShowPalette(true)} className="md:hidden p-2.5 bg-slate-50 border-2 border-slate-200 text-slate-600 rounded-xl" title="Cautare">
                <Search className="w-4 h-4" />
              </button>
              <div className="hidden sm:block h-8 w-px bg-slate-200" />
              <div className="flex items-center gap-3">
                <div className="hidden md:block text-right">
                  <p className="text-xs font-black text-slate-900 leading-none">{currentUser?.name}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{currentUser ? ROLE_LABELS[currentUser.role] : ''}</p>
                </div>
                <button onClick={handleLogout} className="p-2.5 sm:p-3 bg-slate-50 border-2 border-slate-200 text-slate-500 rounded-xl hover:text-red-600 hover:border-red-300 transition-colors" title="Delogare">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>
        )}

        {!isStandalone && (
          <div className="shrink-0 flex items-stretch gap-2 sm:gap-3 px-3 sm:px-6 lg:px-10 py-2.5 sm:py-3 bg-white border-b border-slate-200 z-40">
            {canEdit && (
              <PrimaryAction
                icon={<Plus className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />}
                label="Dispozitiv nou"
                shortLabel="Dispozitiv nou"
                hint="Inregistreaza un dispozitiv nou in inventar"
                variant="blue"
                onClick={() => navigate('ADD_DEVICE')}
              />
            )}
            <PrimaryAction
              icon={<QrCode className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />}
              label="Scaneaza cod QR"
              shortLabel="Scaneaza QR"
              hint="Scaneaza eticheta QR a unui dispozitiv ca sa-i deschizi fisa"
              variant="dark"
              onClick={() => setShowScanner(true)}
            />
          </div>
        )}

        <div className={`flex-1 overflow-y-auto overscroll-y-contain relative custom-scrollbar ${isStandalone ? 'p-0' : 'p-3 pb-12 sm:p-6 sm:pb-10 lg:p-10'}`}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-6 animate-fade-in">
              <div className="relative">
                 <div className="w-24 h-24 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                 <Stethoscope className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">MediTrack OS</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Se initializeaza registrul...</p>
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto animate-fade-in">
              <Suspense fallback={
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Se incarca modulul...</p>
                </div>
              }>
                {view === 'DASHBOARD' && <Dashboard devices={devices} tasks={tasks} />}
                {view === 'INVENTORY' && <DeviceList devices={devices} onSelectDevice={handleSelectDevice} onUpdateDevice={handleUpsertDevices} onBulkUpdate={handleUpsertDevices} onDelete={handleDeleteDevice} onAddDevice={handleAddDevice} />}
                {view === 'DEVICE_DETAIL' && selectedDevice && (
                  <DeviceDetail 
                    device={selectedDevice} 
                    allDevices={devices} 
                    tasks={tasks.filter(t => String(t.deviceId).trim() === String(selectedDevice.id).trim())} 
                    onBack={goBack} 
                    onUpdate={handleUpsertDevices} 
                    onDelete={handleDeleteDevice} 
                    onAddTask={handleUpsertTasks}
                    isStandalone={isStandalone}
                    invoices={invoices}
                    auditEntries={auditLog}
                  />
                )}
                {/* A scanned QR pointing at an unknown id used to render nothing at all */}
                {view === 'DEVICE_DETAIL' && !selectedDevice && (
                  <div className="py-24 flex flex-col items-center text-center gap-4 px-6">
                    <div className="p-5 bg-amber-50 rounded-full"><AlertCircle className="w-12 h-12 text-amber-500" /></div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Dispozitivul nu a fost gasit</p>
                      <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                        Codul QR indica spre <span className="font-mono text-slate-700">{selectedDeviceId || '—'}</span>,
                        care nu exista in lista de pe acest dispozitiv. Sincronizeaza si incearca din nou.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                      <button onClick={loadAndSync} disabled={isSyncingNow}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition disabled:opacity-50">
                        {isSyncingNow ? 'Se sincronizeaza...' : 'Re-sincronizare'}
                      </button>
                      <button onClick={goBack}
                        className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition">
                        Inapoi la inventar
                      </button>
                    </div>
                  </div>
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
                {view === 'ADD_DEVICE' && <AddDeviceForm devices={devices} onSave={async (d) => { await handleUpsertDevices(d); navigate('INVENTORY'); }} onBulkSave={async (ds) => { await handleUpsertDevices(ds); navigate('INVENTORY'); }} onCancel={goBack} />}
                {view === 'PLANNER' && <MaintenancePlanner devices={devices} onApplyPlan={handleUpsertDevices} onSelectDevice={handleSelectDevice} />}
                {view === 'FINANCE' && canFinance && (
                  <FinanceManager
                    devices={devices}
                    invoices={invoices}
                    onUpsertInvoice={handleUpsertInvoice}
                    onDeleteInvoice={handleDeleteInvoice}
                    onSaveContract={handleSaveContract}
                  />
                )}
                {view === 'FINANCE' && !canFinance && (
                  <div className="py-32 flex flex-col items-center text-center">
                    <ShieldCheck className="w-16 h-16 text-slate-200 mb-4" />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Acces restrictionat</p>
                    <p className="text-xs text-slate-400 mt-2">Rolul tau nu are acces la modulul Financiar.</p>
                  </div>
                )}
                {view === 'SETTINGS' && <Settings devices={devices} onImport={handleUpsertDevices} auditLog={auditLog} currentUser={currentUser} />}
              </Suspense>
            </div>
          )}
        </div>
      </main>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-[90] lg:hidden transition-opacity duration-300" onClick={() => setSidebarOpen(false)} />
      )}

      {showScanner && (
        <Suspense fallback={null}>
          <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
        </Suspense>
      )}

      {showDocScanner && (
        <Suspense fallback={null}>
          <DocumentScanner devices={devices} onSave={handleDocScanSave} onClose={() => setShowDocScanner(false)} />
        </Suspense>
      )}

      {showPalette && (
        <Suspense fallback={null}>
          <CommandPalette
            devices={devices}
            tasks={tasks}
            invoices={invoices}
            canFinance={canFinance}
            onNavigate={navigate}
            onSelectDevice={(id) => navigate('DEVICE_DETAIL', id)}
            onClose={() => setShowPalette(false)}
          />
        </Suspense>
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

const SYNC_LABELS: Record<string, { text: string; dot: string; tone: string }> = {
  cloud:           { text: 'Operational',            dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]', tone: 'text-emerald-600' },
  local:           { text: 'Doar local',             dot: 'bg-amber-500',  tone: 'text-amber-600' },
  error:           { text: 'Eroare de sincronizare', dot: 'bg-red-500',    tone: 'text-red-600' },
  'table-missing': { text: 'Schema lipsa in cloud',  dot: 'bg-red-500',    tone: 'text-red-600' },
  paused:          { text: 'Proiect Supabase oprit', dot: 'bg-red-500',    tone: 'text-red-600' },
};

const AppSidebar = React.memo(({ isSidebarOpen, view, setView, setSidebarOpen, syncStatus, lastSyncTime, loadAndSync, syncMessage, isSyncingNow, canFinance }: {
  isSidebarOpen: boolean; view: string; setView: (v: any) => void;
  setSidebarOpen: (v: boolean) => void; syncStatus: string;
  lastSyncTime: string; loadAndSync: () => void;
  syncMessage: string; isSyncingNow: boolean; canFinance: boolean;
}) => (
  <aside className={`fixed lg:static inset-y-0 left-0 z-[100] w-72 bg-white border-r border-slate-200 transform transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
    <div className="h-full flex flex-col relative">
      <div className="absolute top-0 right-0 w-1 h-full bg-slate-50" />
      <div className="p-6 lg:p-8 flex items-center gap-4 border-b border-slate-100 bg-white">
        <div className="bg-slate-900 p-2.5 rounded-xl shadow-xl shadow-slate-900/10 ring-1 ring-white/20 shrink-0">
          <Stethoscope className="w-6 h-6 text-blue-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase leading-none">MediTrack</h1>
          {/* The close button takes this room on phones, and the subtitle
              wrapped to two lines rather than fitting beside it */}
          <p className="hidden lg:block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5">Fleet Registry v3.1</p>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label="Inchide meniul"
          title="Inchide meniul"
          className="lg:hidden ml-auto shrink-0 p-3 bg-slate-50 border-2 border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 active:scale-95 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <nav className="flex-1 p-6 space-y-1.5 overflow-y-auto no-scrollbar bg-white">
        <div className="px-3 mb-4"><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Operatiuni</p></div>
        <NavItem active={view === 'DASHBOARD'} onClick={() => { setView('DASHBOARD'); setSidebarOpen(false); }} icon={<LayoutDashboard className="w-4 h-4" />} label="Panou" />
        <NavItem active={view === 'INVENTORY'} onClick={() => { setView('INVENTORY'); setSidebarOpen(false); }} icon={<List className="w-4 h-4" />} label="Inventar" />
        <NavItem active={view === 'TASKS'} onClick={() => { setView('TASKS'); setSidebarOpen(false); }} icon={<CheckSquare className="w-4 h-4" />} label="Tichete Service" />
        <NavItem active={view === 'PLANNER'} onClick={() => { setView('PLANNER'); setSidebarOpen(false); }} icon={<CalendarRange className="w-4 h-4" />} label="Mentenanta" />
        {canFinance && <NavItem active={view === 'FINANCE'} onClick={() => { setView('FINANCE'); setSidebarOpen(false); }} icon={<Wallet className="w-4 h-4" />} label="Financiar" />}
        <div className="px-3 mt-8 mb-4"><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Sistem</p></div>
        <NavItem active={view === 'SETTINGS'} onClick={() => { setView('SETTINGS'); setSidebarOpen(false); }} icon={<SettingsIcon className="w-4 h-4" />} label="Configurare" />
      </nav>
      <div className="p-6 border-t border-slate-100 bg-slate-50/50">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
          {(() => {
            const info = SYNC_LABELS[syncStatus] || SYNC_LABELS.local;
            const isFailure = syncStatus === 'error' || syncStatus === 'table-missing' || syncStatus === 'paused';
            return (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizare Cloud</p>
                  <div className={`w-2 h-2 rounded-full ${isSyncingNow ? 'bg-blue-500 animate-pulse' : info.dot}`} />
                </div>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isSyncingNow ? 'bg-blue-50 text-blue-600' : isFailure ? 'bg-red-50 text-red-600' : syncStatus === 'cloud' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {isSyncingNow ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : isFailure ? <AlertCircle className="w-4 h-4" />
                      : syncStatus === 'cloud' ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-bold ${isSyncingNow ? 'text-blue-600' : isFailure ? 'text-red-600' : 'text-slate-900'}`}>
                      {isSyncingNow ? 'Se sincronizeaza...' : info.text}
                    </p>
                    <p className="text-[10px] font-medium text-slate-500">Ultima: {lastSyncTime}</p>
                  </div>
                </div>

                {/* The actual reason — otherwise a failed sync looks like nothing happened */}
                {!isSyncingNow && syncMessage && (
                  <p className={`text-[10px] font-bold leading-relaxed ${isFailure ? 'text-red-600' : 'text-amber-600'}`}>
                    {syncMessage}
                  </p>
                )}
                {isFailure && (
                  <button onClick={() => { setView('SETTINGS'); setSidebarOpen(false); }}
                    className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition">
                    Vezi diagnosticul
                  </button>
                )}

                <button onClick={loadAndSync} disabled={isSyncingNow}
                  className="w-full py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSyncingNow && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isSyncingNow ? 'In curs...' : 'Re-sincronizare'}
                </button>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  </aside>
));

export default App;
