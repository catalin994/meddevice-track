
import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { LayoutDashboard, List, Menu, X, ShieldCheck, Loader2, CheckSquare, Settings as SettingsIcon, CalendarRange, RefreshCw, Cloud, CloudOff, Database, AlertCircle, Zap, QrCode, ScanLine, Wallet, Search, LogOut, User, Plus, Sun, Moon } from 'lucide-react';

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
const ConflictDialog = lazy(() => import('./components/ConflictDialog'));
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

import { MedicalDevice, MedicalTask, Invoice, Contract, Deletion, ViewState, DeviceStatus, MaintenanceType, TaskStatus, TaskPriority, AppUser, AuditEntry, Referat, FoundationDoc, Comanda, hasPermission, ROLE_LABELS, sePoatePuneLaLoc, NUME_ENTITATE, normaliseDeviceStatus } from './types';
import { supabase, isSupabaseConfigured, checkConnection, fetchAllRows, upsertInChunks } from './services/supabase';
import { getAllDevicesFromDB, saveDevicesToDB, deleteDeviceFromDB, getAllTasksFromDB, saveTasksToDB, deleteTaskFromDB, getAllInvoicesFromDB, saveInvoicesToDB, deleteInvoiceFromDB, getAllAuditFromDB, saveAuditToDB, getAllDeletionsFromDB, saveDeletionsToDB, getAllReferateFromDB, saveReferateToDB, deleteReferatFromDB, getAllFoundationDocsFromDB, saveFoundationDocsToDB, deleteFoundationDocFromDB, getAllComenziFromDB, saveComenziToDB, deleteComandaFromDB, getAllContracteFromDB, saveContracteToDB } from './services/storageService';
import { getCurrentUser, getCachedProfile, signOut as authSignOut, onAuthChange, hasDeviceLock } from './services/authService';
import { getInitialTheme, applyTheme, Theme } from './services/themeService';
import { mergeDeviceRecords, buildUploadSet } from './services/syncMerge';
import { buildPath, uploadDataUrl } from './services/fileStorage';
import { randMaiNou, campuriDiferite, Diferenta } from './services/conflicte';
import { notify } from './services/notices';
import LoginScreen from './components/LoginScreen';
import { vineDinEmailDeRecuperare } from './services/authService';
import { LogoTile, LogoMark } from './components/Logo';

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

/** Forms that fit the header of a phone without being cut mid-word. */
/** Unde bara de actiuni de teren n-are ce cauta. */
const ECRANE_FARA_ACTIUNI = new Set(['SETTINGS', 'FINANCE', 'ADD_DEVICE', 'PLANNER']);

const VIEW_LABELS_SHORT: Record<string, string> = {
  DEVICE_DETAIL: 'Dispozitiv',
  ADD_DEVICE: 'Adauga',
  TASKS: 'Tichete',
  // "Configurare" nu incapea in cele ~140px ramase pe telefon si iesea
  // "CONFIGURA...". Un titlu taiat nu spune nimic mai mult decat unul scurt.
  SETTINGS: 'Setari',
  PLANNER: 'Planificare',
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
      className={`${styles} flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-6 py-3.5 text-white rounded-xl shadow-lg font-black text-[10px] sm:text-[11px] uppercase tracking-widest transition active:scale-95`}
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
  // Dosarul achizitiei: referatul de necesitate si documentele care il sustin
  const [referate, setReferate] = useState<Referat[]>([]);
  const [foundationDocs, setFoundationDocs] = useState<FoundationDoc[]>([]);
  const [comenzi, setComenzi] = useState<Comanda[]>([]);
  /** Ce s-a sters, cu tot cu continut, ca sa se poata pune la loc. */
  const [deletions, setDeletions] = useState<Deletion[]>([]);
  /** Contractele, cu casa lor: unul de consumabile nu se leaga de niciun aparat. */
  const [contracte, setContracte] = useState<Contract[]>([]);
  /** Randul pe care a scris si altcineva, cat timp se asteapta alegerea. */
  const [conflict, setConflict] = useState<{
    ce: string; nume: string; diferente: Diferenta[]; candLui?: string;
  } | null>(null);
  const alegeConflict = useRef<((care: 'meu' | 'lui') => void) | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('--:--');
  const [showScanner, setShowScanner] = useState(false);
  const [showDocScanner, setShowDocScanner] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  // 'checking' while the stored session is validated, 'locked' when a session
  // exists but this phone asks for its PIN first.
  const [authState, setAuthState] = useState<'checking' | 'anon' | 'locked' | 'ready'>('checking');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [lockedUser, setLockedUser] = useState<AppUser | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => { applyTheme(theme); }, [theme]);
  const toggleTheme = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), []);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getCurrentUser();
      if (cancelled) return;
      if (!user) { setAuthState('anon'); return; }
      if (hasDeviceLock()) { setLockedUser(user); setAuthState('locked'); return; }
      setCurrentUser(user);
      setAuthState('ready');
    })();

    // Signing out in another tab, or a refresh token that finally expired
    const unsubscribe = onAuthChange((signedIn) => {
      if (!signedIn) { setCurrentUser(null); setLockedUser(null); setAuthState('anon'); }
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  const handleLogin = useCallback((user: AppUser) => {
    setCurrentUser(user);
    setLockedUser(null);
    setAuthState('ready');
  }, []);

  const handleLogout = useCallback(async () => {
    await authSignOut();
    setCurrentUser(null);
    setLockedUser(null);
    setAuthState('anon');
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

  /** Text curat, sau nimic — ca sa nu se salveze siruri goale peste ceva scris. */
  const txtSauNimic = (v: any): string | undefined => {
    const t = String(v ?? '').trim();
    return t ? t : undefined;
  };

  const normalizeDevice = useCallback((d: any): MedicalDevice => {
    const safeId = String(d.id || d.ID || crypto.randomUUID()).trim();
    const files = Array.isArray(d.files) ? d.files : [];

    return {
      ...d,
      id: safeId,
      name: d.name || d.Name || 'Unnamed Asset',
      category: d.category || d.Category || 'Altele',
      status: normaliseDeviceStatus(d.status ?? d.Status),
      department: d.department || d.Department || 'Unassigned',
      manufacturer: d.manufacturer || d.Manufacturer || 'Unknown',
      model: d.model || d.Model || 'N/A',
      serialNumber: d.serialNumber || d.SerialNumber || 'N/A',
      inventoryNumber: txtSauNimic(d.inventoryNumber ?? d.InventoryNumber ?? d.nr_inv),
      maintenanceHistory: Array.isArray(d.maintenanceHistory) ? d.maintenanceHistory : [],
      contracts: Array.isArray(d.contracts) ? d.contracts : [],
      files: files,
      components: Array.isArray(d.components) ? d.components : [],
      tags: Array.isArray(d.tags) ? d.tags : [],
      updated_at: d.updated_at || d.updatedAt
    } as MedicalDevice;
  }, []);

  /**
   * Verifica daca randul din cloud s-a schimbat de cand a fost incarcat, si
   * daca da, intreaba ce se pastreaza.
   *
   * Intoarce true cand salvarea poate merge mai departe. Cand cloud-ul nu
   * raspunde nu intreaba nimic si lasa salvarea sa treaca: intr-o sectie fara
   * semnal, o aplicatie care refuza sa salveze e mai rea decat o suprascriere.
   */
  const potSalva = useCallback(async (
    tabel: string,
    ce: string,
    alMeu: any,
    nume: string,
    updatedAtLocal?: string,
  ): Promise<boolean> => {
    if (!isSupabaseConfigured) return true;
    const alLui = await randMaiNou<any>(tabel, alMeu.id, updatedAtLocal);
    if (!alLui) return true;
    const care = await new Promise<'meu' | 'lui'>(resolve => {
      alegeConflict.current = resolve;
      setConflict({ ce, nume, diferente: campuriDiferite(alMeu, alLui), candLui: alLui.updated_at });
    });
    setConflict(null);
    alegeConflict.current = null;
    if (care === 'meu') return true;
    // Varianta colegului ramane: se aduce in aplicatie, ca ecranul sa nu mai
    // arate ce tocmai a fost aruncat.
    switch (tabel) {
      case 'devices': setDevices(prev => prev.map(d => (d.id === alLui.id ? normalizeDevice(alLui) : d))); break;
      case 'invoices': setInvoices(prev => prev.map(x => (x.id === alLui.id ? alLui : x))); break;
      case 'referate': setReferate(prev => prev.map(x => (x.id === alLui.id ? alLui : x))); break;
      case 'documente_fundamentare': setFoundationDocs(prev => prev.map(x => (x.id === alLui.id ? alLui : x))); break;
      case 'comenzi': setComenzi(prev => prev.map(x => (x.id === alLui.id ? alLui : x))); break;
      case 'tasks': setTasks(prev => prev.map(x => (x.id === alLui.id ? alLui : x))); break;
    }
    notify('S-a pastrat varianta din cloud.', 'info');
    return false;
  }, [isSupabaseConfigured, normalizeDevice]);

  /** Records that an entity was deleted, locally and in the cloud, so other
   *  devices remove it instead of uploading their stale copy back. */
  /*
   * Cat de mare poate fi randul pastrat in cos.
   *
   * O fisa cu documente ramase inauntru, netrecute inca prin Storage, poate
   * avea megaocteti de base64. Pastrata, ar umfla tabelul de stergeri pentru
   * totdeauna. Peste pragul asta se tine doar urma, si cosul spune deschis ca
   * randul acela nu se mai poate pune la loc.
   */
  const CAT_INCAPE = 1_000_000;

  const recordDeletion = useCallback(async (
    entity: Deletion['entity'],
    entityId: string,
    entityName?: string,
    payload?: any,
  ) => {
    let pastrat: any = payload;
    try {
      if (pastrat && JSON.stringify(pastrat).length > CAT_INCAPE) pastrat = undefined;
    } catch { pastrat = undefined; }

    const tombstone: Deletion = {
      id: `${entity}:${entityId}`,
      entity,
      entityId,
      entityName,
      deletedBy: getCachedProfile()?.name || undefined,
      payload: pastrat,
      deletedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await saveDeletionsToDB([tombstone]).catch(() => {});
    setDeletions(prev => [tombstone, ...prev.filter(d => d.id !== tombstone.id)]);
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('deletions').upsert([tombstone], { onConflict: 'id' });
      if (error) console.warn('[Sync] Deletion not recorded in cloud:', error.message);
    }
  }, [isSupabaseConfigured]);

  const logAudit = useCallback((action: AuditEntry['action'], entity: AuditEntry['entity'], entityId: string, entityName: string, details?: string) => {
    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userName: getCachedProfile()?.name || 'Necunoscut',
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
      getAllReferateFromDB().then(setReferate).catch(() => {});
      getAllFoundationDocsFromDB().then(setFoundationDocs).catch(() => {});
      getAllComenziFromDB().then(setComenzi).catch(() => {});
      
      const deviceMap = new Map<string, MedicalDevice>();
      localDevices.forEach(d => deviceMap.set(d.id, d));
      
      // Data Cleanup: Trim departments to unify duplicates
      const cleanedDevices = (localDevices.length > 0 ? localDevices : MOCK_DEVICES)
        .map(d => ({ ...d, department: (d.department || 'Unassigned').trim(), status: normaliseDeviceStatus(d.status) }));
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
          notify(connection.message || 'Conexiunea la cloud a esuat — lucrezi pe datele de pe telefon', 'warning');
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
          // Cloud-ul are ultimul cuvant: acolo ajunge si anularea unei pietre de
          // mormant, cand cineva a pus la loc de pe alt aparat.
          (deletionRes.data || []).forEach(d => { if (d?.id) tombstones.set(d.id, d); });

          // Ce a fost pus la loc nu mai sterge pe nimeni.
          const inVigoare = Array.from(tombstones.values()).filter(d => !d.restoredAt);
          const deletedDeviceIds = new Set(
            inVigoare.filter(d => d.entity === 'device').map(d => d.entityId)
          );
          const deletedTaskIds = new Set(
            inVigoare.filter(d => d.entity === 'task').map(d => d.entityId)
          );

          // Persist the combined log and push back any tombstone the cloud lacks
          const allTombstones = Array.from(tombstones.values());
          setDeletions(allTombstones);
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

          /*
           * Facturi, referate si documente de fundamentare se sincronizeaza la
           * fel: se ia ce e in cloud, se pastreaza versiunea mai noua dupa
           * updated_at, se salveaza local si se urca inapoi ce e mai nou aici.
           * Scris o data — trei copii ale aceluiasi bloc de treizeci de randuri
           * ar fi insemnat trei locuri de reparat cand tiparul se schimba.
           */
          /**
           * Tabelele care lipsesc din baza de date. Pana acum se scriau doar in
           * consola: sincronizarea spunea "cloud" cu bifa verde, iar referatele
           * ramaneau pe telefonul pe care fusesera facute, fara ca nimeni sa
           * afle. Numele lor ajung acum sub butonul de sincronizare.
           */
          const sarite: string[] = [];

          const sincronizeaza = async <T extends { id: string; updated_at?: string }>(
            tabel: string,
            locale: T[],
            aplica: (finale: T[]) => void,
            salveaza: (items: T[]) => Promise<void>,
            /** Ce s-a sters din felul asta, ca sa nu se invie. */
            fel?: Deletion['entity'],
          ) => {
            try {
              const res = await fetchAllRows<T>(tabel);
              if (res.error || !res.data) {
                console.warn(`[App] ${tabel}: sincronizare sarita (tabelul poate lipsi)`);
                sarite.push(tabel);
                return;
              }
              /*
               * Sterse in alta parte.
               *
               * Fara filtrul asta, o factura stearsa de pe calculator se
               * intorcea de pe telefon: telefonul o avea inca local, n-o gasea
               * in cloud, si o socotea "mai noua decat nimic" — asa ca o urca
               * inapoi. Stergerea parea sa mearga, si a doua zi factura era din
               * nou acolo, fara ca cineva sa inteleaga de ce.
               */
              const sterse = fel
                ? new Set(inVigoare.filter(d => d.entity === fel).map(d => d.entityId))
                : new Set<string>();
              const dinCloud = res.data.filter(c => !sterse.has(c.id));
              const harta = new Map<string, T>(locale.filter(i => !sterse.has(i.id)).map(i => [i.id, i]));
              for (const c of dinCloud) {
                const local = harta.get(c.id);
                const tCloud = c.updated_at ? new Date(c.updated_at).getTime() : 0;
                const tLocal = local?.updated_at ? new Date(local.updated_at).getTime() : 0;
                if (!local || !local.updated_at || tCloud > tLocal) harta.set(c.id, c);
              }
              const finale = Array.from(harta.values());
              aplica(finale);
              await salveaza(finale);

              const maiNoiLocal = finale.filter(i => {
                const c = dinCloud.find(x => x.id === i.id);
                const tCloud = c?.updated_at ? new Date(c.updated_at).getTime() : 0;
                const tLocal = i.updated_at ? new Date(i.updated_at).getTime() : 0;
                return !c || tLocal > tCloud;
              });
              if (maiNoiLocal.length > 0) await upsertInChunks(tabel, maiNoiLocal);
            } catch {
              console.warn(`[App] ${tabel}: sincronizare sarita`);
              sarite.push(tabel);
            }
          };

          await sincronizeaza<Invoice>('invoices', localInvoices, setInvoices, saveInvoicesToDB, 'invoice');
          await sincronizeaza<Referat>('referate',
            await getAllReferateFromDB().catch(() => []), setReferate, saveReferateToDB, 'referat');
          await sincronizeaza<FoundationDoc>('documente_fundamentare',
            await getAllFoundationDocsFromDB().catch(() => []), setFoundationDocs, saveFoundationDocsToDB, 'fundamentare');
          await sincronizeaza<Comanda>('comenzi',
            await getAllComenziFromDB().catch(() => []), setComenzi, saveComenziToDB, 'comanda');
          await sincronizeaza<Contract>('contracte',
            await getAllContracteFromDB().catch(() => []), setContracte, saveContracteToDB);

          setSyncStatus('cloud');
          setSyncMessage(sarite.length
            ? `Lipsesc din baza de date: ${sarite.join(', ')}. Datele lor raman doar pe acest aparat `
              + '— ruleaza scriptul SQL din Configurare.'
            : '');
          setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        } catch (e: any) {
          console.error("[App] Cloud sync error:", e);
          setSyncStatus('error');
          setSyncMessage(e?.message || String(e) || 'Eroare la sincronizare');
          notify(e?.message || 'Sincronizarea a esuat — modificarile raman pe telefon', 'error');
        }
      } else {
        setSyncMessage('Cloud neconfigurat — datele ramin doar pe acest dispozitiv');
      }
    } catch (err: any) {
      console.error("[App] Registry engine failure:", err);
      setSyncStatus('error');
      setSyncMessage(err?.message || 'Eroare la citirea datelor');
      notify(err?.message || 'Nu s-au putut citi datele', 'error');
      setIsLoading(false);
    } finally {
      setIsSyncingNow(false);
    }
  }, [normalizeDevice]);

  // Syncing before the account is approved would only collect 401s
  useEffect(() => {
    if (isStandalone || currentUser?.approved) loadAndSync();
  }, [loadAndSync, currentUser?.approved, isStandalone]);

  const handleDeleteDevice = useCallback(async (id: string) => {
    if (!id) return;
    if (!canDelete) { const m = 'Doar un administrator poate sterge echipamente.';
      setSyncMessage(m); notify(m, 'error'); return; }
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
      await recordDeletion('device', safeId, target?.name || safeId, target);
      if (isSupabaseConfigured && supabase) {
        await supabase.from('devices').delete().eq('id', safeId);
      }
    } catch (error) {
      console.error("[Registry] Purge failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSupabaseConfigured, devicesMap, logAudit, recordDeletion, canDelete]);

  const handleUpsertDevices = useCallback(async (data: MedicalDevice | MedicalDevice[]) => {
    const now = new Date().toISOString();
    const items = Array.isArray(data) ? data : [data];
    const payload: MedicalDevice[] = items.map(d => ({ ...normalizeDevice(d), updated_at: now }));
    if (payload.length === 0) return;

    /*
     * Un singur aparat inseamna cineva care tocmai a completat un formular, si
     * acolo merita intrebat. Un import de doua mii de randuri sau maturatul
     * documentelor spre Storage nu: acolo n-are cine sa raspunda la doua mii de
     * intrebari, iar ce se scrie nu vine din editarea nimanui.
     */
    if (payload.length === 1) {
      const vechi = devicesMap.get(payload[0].id);
      if (vechi && !(await potSalva('devices', 'aparatul', payload[0], payload[0].name, vechi.updated_at))) return;
    }

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
  }, [isSupabaseConfigured, normalizeDevice, devicesMap, logAudit, potSalva]);

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

    const veche = invoices.find(i => i.id === payload.id);
    if (veche && !(await potSalva('invoices', 'factura', payload, payload.invoiceNumber, veche.updated_at))) return;

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
  }, [isSupabaseConfigured, invoices, logAudit, recordDeletion, potSalva]);

  /*
   * Referate si documente de fundamentare — salvare si stergere, dupa acelasi
   * tipar ca facturile: local intai, cloud pe urma, si o piatra de mormant
   * pentru ca stergerea sa nu se intoarca de pe alt dispozitiv.
   */
  const handleUpsertReferat = useCallback(async (referat: Referat) => {
    const payload: Referat = { ...referat, updated_at: new Date().toISOString() };
    const vechiR = referate.find(r => r.id === payload.id);
    if (vechiR && !(await potSalva('referate', 'referatul', payload, payload.number, vechiR.updated_at))) return;

    logAudit(referate.some(r => r.id === payload.id) ? 'update' : 'create', 'referat',
      payload.id, payload.number, `${payload.department} · ${payload.subject}`);
    setReferate(prev => {
      const map = new Map(prev.map(r => [r.id, r]));
      map.set(payload.id, payload);
      return Array.from(map.values());
    });
    setIsSyncing(true);
    try {
      await saveReferateToDB([payload]);
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('referate').upsert([payload], { onConflict: 'id' });
        if (error) console.warn('[Referate] sincronizare amanata:', error.message);
      }
    } catch (err) {
      console.error('[Referate] sincronizare amanata:', err);
    } finally { setIsSyncing(false); }
  }, [isSupabaseConfigured, referate, logAudit]);

  const handleDeleteReferat = useCallback(async (id: string) => {
    if (!canDelete) { const m = 'Doar un administrator poate sterge referate.';
      setSyncMessage(m); notify(m, 'error'); return; }
    if (!id) return;
    const target = referate.find(r => r.id === id);
    logAudit('delete', 'referat', id, target?.number || id, target?.subject);
    setReferate(prev => prev.filter(r => r.id !== id));
    // Documentele raman, dar isi pierd legatura: sunt acte in sine, iar
    // stergerea lor odata cu referatul ar arunca dovezi fara sa intrebe.
    const orfane = foundationDocs.filter(d => d.referatId === id);
    if (orfane.length > 0) {
      const dezlegate = orfane.map(d => ({ ...d, referatId: undefined, updated_at: new Date().toISOString() }));
      setFoundationDocs(prev => prev.map(d => dezlegate.find(x => x.id === d.id) || d));
      await saveFoundationDocsToDB(dezlegate).catch(() => {});
      if (isSupabaseConfigured && supabase) {
        await supabase.from('documente_fundamentare').upsert(dezlegate, { onConflict: 'id' });
      }
      notify(`${orfane.length} document(e) de fundamentare au ramas fara referat`, 'info');
    }
    setIsSyncing(true);
    try {
      await deleteReferatFromDB(id);
      await recordDeletion('referat', id, target?.number || id, target);
      if (isSupabaseConfigured && supabase) await supabase.from('referate').delete().eq('id', id);
    } catch (err) {
      console.error('[Referate] stergere esuata:', err);
    } finally { setIsSyncing(false); }
  }, [isSupabaseConfigured, referate, foundationDocs, logAudit, canDelete, recordDeletion]);

  const handleUpsertFoundationDoc = useCallback(async (doc: FoundationDoc) => {
    const payload: FoundationDoc = { ...doc, updated_at: new Date().toISOString() };
    const vechiD = foundationDocs.find(d => d.id === payload.id);
    if (vechiD && !(await potSalva('documente_fundamentare', 'documentul', payload, payload.number || payload.type, vechiD.updated_at))) return;

    logAudit(foundationDocs.some(d => d.id === payload.id) ? 'update' : 'create', 'fundamentare',
      payload.id, payload.number || payload.type, payload.supplier);
    setFoundationDocs(prev => {
      const map = new Map(prev.map(d => [d.id, d]));
      map.set(payload.id, payload);
      return Array.from(map.values());
    });
    setIsSyncing(true);
    try {
      await saveFoundationDocsToDB([payload]);
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('documente_fundamentare').upsert([payload], { onConflict: 'id' });
        if (error) console.warn('[Fundamentare] sincronizare amanata:', error.message);
      }
    } catch (err) {
      console.error('[Fundamentare] sincronizare amanata:', err);
    } finally { setIsSyncing(false); }
  }, [isSupabaseConfigured, foundationDocs, logAudit]);

  const handleDeleteFoundationDoc = useCallback(async (id: string) => {
    if (!canDelete) { const m = 'Doar un administrator poate sterge documente de fundamentare.';
      setSyncMessage(m); notify(m, 'error'); return; }
    if (!id) return;
    const target = foundationDocs.find(d => d.id === id);
    logAudit('delete', 'fundamentare', id, target?.number || target?.type || id, target?.supplier);
    setFoundationDocs(prev => prev.filter(d => d.id !== id));
    setIsSyncing(true);
    try {
      await deleteFoundationDocFromDB(id);
      await recordDeletion('fundamentare', id, target?.number || target?.type || id, target);
      if (isSupabaseConfigured && supabase) await supabase.from('documente_fundamentare').delete().eq('id', id);
    } catch (err) {
      console.error('[Fundamentare] stergere esuata:', err);
    } finally { setIsSyncing(false); }
  }, [isSupabaseConfigured, foundationDocs, logAudit, canDelete, recordDeletion]);

  const handleUpsertComanda = useCallback(async (c: Comanda) => {
    const payload: Comanda = { ...c, updated_at: new Date().toISOString() };
    const vechiC = comenzi.find(x => x.id === payload.id);
    if (vechiC && !(await potSalva('comenzi', 'comanda', payload, payload.number || payload.id, vechiC.updated_at))) return;

    logAudit(comenzi.some(x => x.id === payload.id) ? 'update' : 'create', 'comanda',
      payload.id, payload.number || payload.id, payload.supplier);
    setComenzi(prev => {
      const map = new Map(prev.map(x => [x.id, x]));
      map.set(payload.id, payload);
      return Array.from(map.values());
    });
    setIsSyncing(true);
    try {
      await saveComenziToDB([payload]);
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('comenzi').upsert([payload], { onConflict: 'id' });
        if (error) console.warn('[Comenzi] sincronizare amanata:', error.message);
      }
    } catch (err) {
      console.error('[Comenzi] sincronizare amanata:', err);
    } finally { setIsSyncing(false); }
  }, [isSupabaseConfigured, comenzi, logAudit]);

  const handleDeleteComanda = useCallback(async (id: string) => {
    if (!canDelete) { const m = 'Doar un administrator poate sterge comenzi.';
      setSyncMessage(m); notify(m, 'error'); return; }
    if (!id) return;
    const target = comenzi.find(x => x.id === id);
    logAudit('delete', 'comanda', id, target?.number || id, target?.supplier);
    setComenzi(prev => prev.filter(x => x.id !== id));
    setIsSyncing(true);
    try {
      await deleteComandaFromDB(id);
      await recordDeletion('comanda', id, target?.number || id, target);
      if (isSupabaseConfigured && supabase) await supabase.from('comenzi').delete().eq('id', id);
    } catch (err) {
      console.error('[Comenzi] stergere esuata:', err);
    } finally { setIsSyncing(false); }
  }, [isSupabaseConfigured, comenzi, logAudit, canDelete, recordDeletion]);

  const handleDeleteInvoice = useCallback(async (id: string) => {
    if (!canDelete) { const m = 'Doar un administrator poate sterge facturi.';
      setSyncMessage(m); notify(m, 'error'); return; }
    if (!id) return;
    const target = invoices.find(i => i.id === id);
    logAudit('delete', 'invoice', id, target?.invoiceNumber || id, target ? `${target.supplier} · ${target.amount} ${target.currency}` : undefined);
    setInvoices(prev => prev.filter(i => i.id !== id));

    setIsSyncing(true);
    try {
      await deleteInvoiceFromDB(id);
      await recordDeletion('invoice', id, target?.invoiceNumber || id, target);
      if (isSupabaseConfigured && supabase) {
        await supabase.from('invoices').delete().eq('id', id);
      }
    } catch (err) {
      console.error("[Invoices] Purge failed:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSupabaseConfigured, invoices, logAudit, canDelete]);

  const handleSaveContract = useCallback(async (contract: Contract, deviceIds: string[]) => {
    const alese = new Set(deviceIds);
    const acelasi = (c: { contractNumber?: string }) => c.contractNumber === contract.contractNumber;
    /*
     * Contractul se pune pe aparatele bifate si se scoate de pe celelalte.
     * Fara a doua parte, la o modificare in care un aparat e debifat el ar fi
     * ramas cu vechea copie a contractului — si doua aparate ar fi aratat
     * acelasi numar de contract cu date diferite.
     */
    const updated = devices
      .filter(d => alese.has(d.id) || (d.contracts || []).some(acelasi))
      .map(d => ({
        ...d,
        contracts: alese.has(d.id)
          ? [...(d.contracts || []).filter(c => !acelasi(c)), contract]
          : (d.contracts || []).filter(c => !acelasi(c)),
      }));
    if (updated.length > 0) await handleUpsertDevices(updated);

    /*
     * Si in tabelul lui, care e casa contractului.
     *
     * Copia din randul fiecarui aparat ramane — de ea atarna tot ce citeste
     * contractele de pe fisa aparatului — dar un contract fara niciun aparat
     * bifat n-avea unde sa stea, si nu se putea salva deloc.
     */
    const payload: Contract = { ...contract, deviceIds, updated_at: new Date().toISOString() };
    setContracte(prev => {
      const map = new Map(prev.map(c => [c.id, c]));
      map.set(payload.id, payload);
      return Array.from(map.values());
    });
    await saveContracteToDB([payload]).catch(() => {});
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('contracte').upsert([payload], { onConflict: 'id' });
      if (error) console.warn('[Contracte] sincronizare amanata:', error.message);
    }
  }, [devices, handleUpsertDevices, isSupabaseConfigured]);

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

  /**
   * Pune la loc ceva sters.
   *
   * Piatra de mormant nu se sterge, se anuleaza. Stearsa, un alt telefon care
   * inca o are local ar urca-o inapoi la urmatoarea sincronizare — e chiar ce
   * face codul de mai sus, ca o stergere sa ajunga peste tot — si ar sterge din
   * nou exact ce tocmai s-a recuperat.
   */
  const handleRestoreDeletion = useCallback(async (d: Deletion) => {
    if (!canDelete) {
      const m = 'Doar un administrator poate pune la loc.';
      setSyncMessage(m); notify(m, 'error'); return;
    }
    if (!sePoatePuneLaLoc(d)) {
      notify('Randul acesta nu mai poate fi pus la loc.', 'warning');
      return;
    }
    setIsSyncing(true);
    try {
      switch (d.entity) {
        case 'device':       await handleUpsertDevices(d.payload as MedicalDevice); break;
        case 'task':         await handleUpsertTasks(d.payload as MedicalTask); break;
        case 'invoice':      await handleUpsertInvoice(d.payload as Invoice); break;
        case 'referat':      await handleUpsertReferat(d.payload as Referat); break;
        case 'fundamentare': await handleUpsertFoundationDoc(d.payload as FoundationDoc); break;
        case 'comanda':      await handleUpsertComanda(d.payload as Comanda); break;
      }

      const anulata: Deletion = {
        ...d,
        restoredAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await saveDeletionsToDB([anulata]).catch(() => {});
      setDeletions(prev => prev.map(x => (x.id === anulata.id ? anulata : x)));
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('deletions').upsert([anulata], { onConflict: 'id' });
        if (error) console.warn('[Cos] anularea nu a ajuns in cloud:', error.message);
      }
      logAudit('update', d.entity, d.entityId, d.entityName || d.entityId, 'pus la loc din cos');
      notify(`${NUME_ENTITATE[d.entity]} ${d.entityName || ''} a fost pus(a) la loc`.replace(/\s+/g, ' ').trim(), 'success');
    } catch (err: any) {
      notify(`Nu s-a putut pune la loc: ${err?.message || 'eroare'}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [canDelete, isSupabaseConfigured, logAudit, handleUpsertDevices, handleUpsertTasks,
      handleUpsertInvoice, handleUpsertReferat, handleUpsertFoundationDoc, handleUpsertComanda]);

  /**
   * Moves documents that are still inline base64 into Storage.
   *
   * Every one of them is downloaded by every phone on every sync while it sits
   * in the row, so this is the step that actually makes syncing cheap. Runs one
   * file at a time and stops at the first failure rather than leaving records
   * half-rewritten.
   *
   * Toate cele sapte feluri de document, nu doar primele trei. Un contract
   * atasat de pe telefon fara semnal ramane in randul lui pana il ridica cineva
   * de-aici; cat sta acolo, fiecare telefon il descarca intreg la fiecare
   * sincronizare. Referatele, documentele de fundamentare, contractele si
   * comenzile lipseau din maturat de cand au fost adaugate.
   */
  const migrateFilesToStorage = useCallback(async (
    onProgress?: (done: number, total: number, label: string) => void
  ) => {
    type Fel = 'device' | 'task' | 'invoice' | 'referat' | 'fundamentare' | 'contract' | 'comanda';
    const DOSAR: Record<Fel, string> = {
      device: 'devices', task: 'tasks', invoice: 'invoices',
      referat: 'referate', fundamentare: 'fundamentare', contract: 'contracts', comanda: 'comenzi',
    };
    const jobs: Array<{ kind: Fel; ownerId: string; id: string; name: string; dataUrl: string }> = [];

    devices.forEach(d => (d.files || []).forEach(f => {
      if (!f.path && f.url?.startsWith('data:')) {
        jobs.push({ kind: 'device', ownerId: d.id, id: f.id, name: f.name, dataUrl: f.url });
      }
    }));
    tasks.forEach(t => (t.attachments || []).forEach(a => {
      if (!a.path && a.url?.startsWith('data:')) {
        jobs.push({ kind: 'task', ownerId: t.id, id: a.id, name: a.name, dataUrl: a.url });
      }
    }));

    /** Aceeasi forma la toate: filePath cand e urcat, fileUrl cand a ramas pe loc. */
    const cuDosar = <T extends { id: string; filePath?: string; fileUrl?: string; fileName?: string }>(
      lista: T[], kind: Fel, implicit: string,
    ) => lista.forEach(x => {
      if (!x.filePath && x.fileUrl?.startsWith('data:')) {
        jobs.push({ kind, ownerId: x.id, id: x.id, name: x.fileName || implicit, dataUrl: x.fileUrl });
      }
    });
    cuDosar(invoices, 'invoice', 'factura.pdf');
    cuDosar(referate, 'referat', 'referat.pdf');
    cuDosar(foundationDocs, 'fundamentare', 'document.pdf');
    cuDosar(comenzi, 'comanda', 'comanda.pdf');

    /*
     * Contractul e tinut in randul fiecarui aparat pe care e trecut, deci
     * acelasi PDF apare de cate ori e aparatul. Se urca o data, dupa numarul
     * contractului, si calea se scrie apoi in toate copiile.
     */
    const contracteDeUrcat = new Map<string, { id: string; name: string; dataUrl: string }>();
    devices.forEach(d => (d.contracts || []).forEach(c => {
      if (!c.filePath && c.fileUrl?.startsWith('data:') && !contracteDeUrcat.has(c.contractNumber)) {
        contracteDeUrcat.set(c.contractNumber, {
          id: c.id || c.contractNumber,
          name: c.fileName || 'contract.pdf',
          dataUrl: c.fileUrl,
        });
      }
    }));
    contracteDeUrcat.forEach((c, numar) => {
      jobs.push({ kind: 'contract', ownerId: numar, id: c.id, name: c.name, dataUrl: c.dataUrl });
    });

    if (jobs.length === 0) return { moved: 0, total: 0, error: null as string | null };

    const paths = new Map<string, string>();
    let moved = 0;
    for (const job of jobs) {
      onProgress?.(moved, jobs.length, job.name);
      const { path, error } = await uploadDataUrl(buildPath(DOSAR[job.kind], job.ownerId, job.id, job.name), job.dataUrl);
      if (error || !path) return { moved, total: jobs.length, error };
      paths.set(`${job.kind}:${job.ownerId}:${job.id}`, path);
      moved++;
    }
    onProgress?.(moved, jobs.length, '');

    // Un aparat poate avea si documente proprii, si contracte de rescris. Se
    // trece o singura data prin lista si se salveaza o singura versiune a lui.
    const caleaContractului = (c: { contractNumber: string; id?: string }) =>
      paths.get(`contract:${c.contractNumber}:${c.id || c.contractNumber}`);
    const touchedDevices = devices
      .filter(d => (d.files || []).some(f => paths.has(`device:${d.id}:${f.id}`))
        || (d.contracts || []).some(c => caleaContractului(c)))
      .map(d => ({
        ...d,
        files: (d.files || []).map(f => {
          const path = paths.get(`device:${d.id}:${f.id}`);
          return path ? { ...f, path, url: undefined } : f;
        }),
        contracts: (d.contracts || []).map(c => {
          const filePath = caleaContractului(c);
          return filePath ? { ...c, filePath, fileUrl: undefined } : c;
        }),
      }));

    const touchedTasks = tasks
      .filter(t => (t.attachments || []).some(a => paths.has(`task:${t.id}:${a.id}`)))
      .map(t => ({
        ...t,
        attachments: (t.attachments || []).map(a => {
          const path = paths.get(`task:${t.id}:${a.id}`);
          return path ? { ...a, path, url: undefined } : a;
        }),
      }));

    const rescrise = <T extends { id: string; filePath?: string; fileUrl?: string }>(lista: T[], kind: Fel) =>
      lista.filter(x => paths.has(`${kind}:${x.id}:${x.id}`))
        .map(x => ({ ...x, filePath: paths.get(`${kind}:${x.id}:${x.id}`), fileUrl: undefined }));

    if (touchedDevices.length) await handleUpsertDevices(touchedDevices);
    if (touchedTasks.length) await handleUpsertTasks(touchedTasks);
    for (const inv of rescrise(invoices, 'invoice')) await handleUpsertInvoice(inv);
    for (const r of rescrise(referate, 'referat')) await handleUpsertReferat(r);
    for (const d of rescrise(foundationDocs, 'fundamentare')) await handleUpsertFoundationDoc(d);
    for (const c of rescrise(comenzi, 'comanda')) await handleUpsertComanda(c);

    return { moved, total: jobs.length, error: null as string | null };
  }, [devices, tasks, invoices, referate, foundationDocs, comenzi,
      handleUpsertDevices, handleUpsertTasks, handleUpsertInvoice,
      handleUpsertReferat, handleUpsertFoundationDoc, handleUpsertComanda]);

  const handleSelectDevice = useCallback((d: import('./types').MedicalDevice) => {
    navigate('DEVICE_DETAIL', d.id);
  }, [navigate]);

  const handleAddDevice = useCallback(() => navigate('ADD_DEVICE'), [navigate]);

  const handleDeleteTask = useCallback(async (id: string) => {
    if (!id) return;
    if (!canDelete) { const m = 'Doar un administrator poate sterge tichete.';
      setSyncMessage(m); notify(m, 'error'); return; }
    const safeId = String(id).trim();
    const target = tasks.find(t => t.id === safeId);
    logAudit('delete', 'task', safeId, target?.title || safeId, target?.deviceName);
    setTasks(prev => prev.filter(t => t.id !== safeId));

    setIsSyncing(true);
    try {
      await deleteTaskFromDB(safeId);
      await recordDeletion('task', safeId, target?.title || safeId, target);
      if (isSupabaseConfigured && supabase) {
        await supabase.from('tasks').delete().eq('id', safeId);
      }
    } catch (error) {
      console.error("[Tasks] Purge failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSupabaseConfigured, tasks, logAudit, canDelete]);

  // Login gate — everything below requires an authenticated user
  if (!isStandalone) {
    if (authState === 'checking') {
      return (
        <div className="theme-static fixed inset-0 bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      );
    }
    /*
     * Legatura din emailul de recuperare are intaietate fata de sesiune.
     *
     * Supabase preia jetonul din adresa la incarcare si deschide o sesiune, deci
     * cine apasa legatura ajunge autentificat — si, fara conditia asta, direct
     * in aplicatie, cu parola veche neschimbata si fara sa vada vreodata
     * formularul. Adica exact omul care si-a uitat parola ramanea fara ea.
     */
    if (authState === 'anon' || authState === 'locked' || vineDinEmailDeRecuperare()) {
      return <LoginScreen onLogin={handleLogin} lockedUser={authState === 'locked' ? lockedUser : null} />;
    }
    if (currentUser && !currentUser.approved) {
      return <PendingApproval user={currentUser} onSignOut={handleLogout} />;
    }
  }

  return (
    <div className="flex app-shell app-bg overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
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
                 {/* On a phone the menu button and three icons leave about
                     140px here, so the full label came out as "FISA DISP…".
                     The short form fits; the long one returns from sm up. */}
                 <h2 className="text-base sm:text-xl font-black text-slate-900 uppercase tracking-tight leading-none truncate">
                   <span className="sm:hidden">{VIEW_LABELS_SHORT[view] || VIEW_LABELS[view] || view.replace('_', ' ')}</span>
                   <span className="hidden sm:inline">{VIEW_LABELS[view] || view.replace('_', ' ')}</span>
                 </h2>
                 <p className="hidden sm:block text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] mt-2">Sistem de Management Echipamente</p>
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
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-black">Ctrl K</kbd>
              </button>
              {/* Mobile: compact search icon */}
              <button onClick={() => setShowPalette(true)} className="md:hidden p-3 bg-slate-50 border-2 border-slate-200 text-slate-600 rounded-xl" title="Cautare" aria-label="Cauta in aplicatie">
                <Search className="w-4 h-4" />
              </button>
              <div className="hidden sm:block h-8 w-px bg-slate-200" />
              <div className="flex items-center gap-3">
                <div className="hidden md:block text-right">
                  <p className="text-xs font-black text-slate-900 leading-none">{currentUser?.name}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{currentUser ? ROLE_LABELS[currentUser.role] : ''}</p>
                </div>
                <button
                  onClick={toggleTheme}
                  className="p-3 bg-slate-50 border-2 border-slate-200 text-slate-500 rounded-xl hover:text-blue-600 hover:border-blue-300 transition-colors"
                  title={theme === 'dark' ? 'Comuta pe mod zi' : 'Comuta pe mod noapte'}
                  aria-label={theme === 'dark' ? 'Comuta pe mod zi' : 'Comuta pe mod noapte'}
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button onClick={handleLogout} className="p-3 bg-slate-50 border-2 border-slate-200 text-slate-500 rounded-xl hover:text-red-600 hover:border-red-300 transition-colors" title="Delogare" aria-label="Delogare">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>
        )}

        {/*
          Nu pe orice ecran.
          "Dispozitiv nou" si "Scaneaza QR" sunt actiunile de teren: isi au rostul
          pe Panou, in Inventar, pe fisa unui aparat. Pe Configurare, in Financiar
          sau in mijlocul unui formular de adaugare n-au ce cauta — si pe telefon
          mananca din putinul de deasupra continutului.
        */}
        {!isStandalone && !ECRANE_FARA_ACTIUNI.has(view) && (
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
                 <LogoMark className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">Biomedic</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Se initializeaza registrul...</p>
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto animate-fade-in">
              <Suspense fallback={
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Se incarca modulul...</p>
                </div>
              }>
                {view === 'DASHBOARD' && <Dashboard devices={devices} tasks={tasks} onSelectDevice={id => { const d = devices.find(x => x.id === id); if (d) handleSelectDevice(d); }} />}
                {view === 'INVENTORY' && <DeviceList devices={devices} onSelectDevice={handleSelectDevice} onUpdateDevice={handleUpsertDevices} onBulkUpdate={handleUpsertDevices} onDelete={handleDeleteDevice} onAddDevice={handleAddDevice} canDelete={canDelete} />}
                {view === 'DEVICE_DETAIL' && selectedDevice && (
                  <DeviceDetail 
                    device={selectedDevice} 
                    allDevices={devices} 
                    tasks={tasks.filter(t => String(t.deviceId).trim() === String(selectedDevice.id).trim())} 
                    onBack={goBack} 
                    onUpdate={handleUpsertDevices} 
                    onDelete={handleDeleteDevice}
                    canDelete={canDelete}
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
                    referate={referate}
                    foundationDocs={foundationDocs}
                    comenzi={comenzi}
                    onUpsertInvoice={handleUpsertInvoice}
                    onDeleteInvoice={handleDeleteInvoice}
                    onUpsertReferat={handleUpsertReferat}
                    onDeleteReferat={handleDeleteReferat}
                    onUpsertFoundationDoc={handleUpsertFoundationDoc}
                    onDeleteFoundationDoc={handleDeleteFoundationDoc}
                    onUpsertComanda={handleUpsertComanda}
                    onDeleteComanda={handleDeleteComanda}
                    canDelete={canDelete}
                    contracte={contracte}
                    onSaveContract={handleSaveContract}
                  />
                )}
                {view === 'FINANCE' && !canFinance && (
                  <div className="py-32 flex flex-col items-center text-center">
                    <ShieldCheck className="w-16 h-16 text-slate-200 mb-4" />
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Acces restrictionat</p>
                    <p className="text-xs text-slate-500 mt-2">Rolul tau nu are acces la modulul Financiar.</p>
                  </div>
                )}
                {view === 'SETTINGS' && (
                  <Settings
                    devices={devices}
                    invoices={invoices}
                    tasks={tasks}
                    referate={referate}
                    foundationDocs={foundationDocs}
                    comenzi={comenzi}
                    onImport={handleUpsertDevices}
                    auditLog={auditLog}
                    currentUser={currentUser}
                    onMigrateFiles={migrateFilesToStorage}
                    deletions={deletions}
                    onRestore={handleRestoreDeletion}
                    canDelete={canDelete}
                  />
                )}
              </Suspense>
            </div>
          )}
        </div>
      </main>

      {isSidebarOpen && (
        <div className="fixed inset-0 scrim z-[90] lg:hidden transition-opacity duration-300" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Doi oameni pe acelasi rand: se alege, nu se suprascrie pe tacute. */}
      {conflict && (
        <Suspense fallback={null}>
          <ConflictDialog
            open
            ce={conflict.ce}
            nume={conflict.nume}
            diferente={conflict.diferente}
            candLui={conflict.candLui}
            onAlege={care => alegeConflict.current?.(care)}
          />
        </Suspense>
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

/** Shown to an account that exists but has not been given a role yet. */
const PendingApproval: React.FC<{ user: AppUser; onSignOut: () => void }> = ({ user, onSignOut }) => (
  <div className="theme-static fixed inset-0 bg-slate-950 flex items-center justify-center p-4 z-[900]">
    <div className="w-full max-w-sm text-center space-y-6 animate-slide-up">
      <div className="w-16 h-16 mx-auto bg-amber-500/15 border border-amber-500/25 rounded-3xl flex items-center justify-center">
        <ShieldCheck className="w-8 h-8 text-amber-400" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-white">Contul asteapta aprobarea</h1>
        <p className="text-sm text-white/50 font-medium leading-relaxed">
          Salut, {user.name}. Contul tau a fost creat, dar un administrator trebuie sa-ti acorde
          un rol inainte sa poti vedea datele. Revino dupa ce primesti confirmarea.
        </p>
        <p className="text-xs text-white/30 font-semibold pt-1">{user.email}</p>
      </div>
      <button onClick={onSignOut}
        className="w-full py-3.5 bg-white/5 border-2 border-white/10 hover:bg-white/10 text-white/70 rounded-2xl font-bold text-sm transition">
        Iesi din cont
      </button>
    </div>
  </div>
);

const NavItem = React.memo(({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-4 w-full px-4 py-3.5 text-sm font-bold rounded-xl transition-all duration-200 group ${active ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>
    <div className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</div>
    <span className="flex-1 text-left tracking-tight">{label}</span>
    {active && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />}
  </button>
));

const SYNC_LABELS: Record<string, { text: string; dot: string; tone: string }> = {
  cloud:           { text: 'Operational',            dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]', tone: 'text-emerald-600' },
  local:           { text: 'Doar local',             dot: 'bg-amber-500',  tone: 'text-amber-700' },
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
        <LogoTile className="p-2.5 rounded-xl shrink-0" />
        <div className="min-w-0">
          <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase leading-none">Biomedic</h1>
          {/* The close button takes this room on phones, and the subtitle
              wrapped to two lines rather than fitting beside it */}
          <p className="hidden lg:block text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-relaxed mt-1.5">Registru echipamente medicale</p>
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
        <div className="px-3 mb-4"><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">Operatiuni</p></div>
        <NavItem active={view === 'DASHBOARD'} onClick={() => { setView('DASHBOARD'); setSidebarOpen(false); }} icon={<LayoutDashboard className="w-4 h-4" />} label="Panou" />
        <NavItem active={view === 'INVENTORY'} onClick={() => { setView('INVENTORY'); setSidebarOpen(false); }} icon={<List className="w-4 h-4" />} label="Inventar" />
        <NavItem active={view === 'TASKS'} onClick={() => { setView('TASKS'); setSidebarOpen(false); }} icon={<CheckSquare className="w-4 h-4" />} label="Tichete Service" />
        <NavItem active={view === 'PLANNER'} onClick={() => { setView('PLANNER'); setSidebarOpen(false); }} icon={<CalendarRange className="w-4 h-4" />} label="Mentenanta" />
        {canFinance && <NavItem active={view === 'FINANCE'} onClick={() => { setView('FINANCE'); setSidebarOpen(false); }} icon={<Wallet className="w-4 h-4" />} label="Financiar" />}
        <div className="px-3 mt-8 mb-4"><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">Sistem</p></div>
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
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sincronizare Cloud</p>
                  <div className={`w-2 h-2 rounded-full ${isSyncingNow ? 'bg-blue-500 animate-pulse' : info.dot}`} />
                </div>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isSyncingNow ? 'bg-blue-50 text-blue-600' : isFailure ? 'bg-red-50 text-red-600' : syncStatus === 'cloud' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}>
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
                  className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
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
