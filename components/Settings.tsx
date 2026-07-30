
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { MedicalDevice, AuditEntry, AppUser, UserRole, ROLE_LABELS, hasPermission } from '../types';
import { Download, Upload, AlertTriangle, Database, Cloud, CheckCircle, Save, LogOut, ShieldCheck, RefreshCw, Loader2, AlertCircle, Terminal, Copy, Check, Info, HardDrive, Wand2, Activity, Users, Plus, Trash2, Clock, Pencil } from 'lucide-react';
import { isSupabaseConfigured, getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig, supabase, checkConnection, countCloudRows, upsertInChunks } from '../services/supabase';
import { getStorageStats, saveDevicesToDB } from '../services/storageService';
import { getUsers, addUser, removeUser, updateUser } from '../services/authService';

interface SettingsProps {
  devices: MedicalDevice[];
  onImport: (devices: MedicalDevice[]) => void;
  auditLog?: AuditEntry[];
  currentUser?: AppUser | null;
}

const Settings: React.FC<SettingsProps> = ({ devices, onImport, auditLog = [], currentUser = null }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState(getSupabaseConfig());
  const [inputUrl, setInputUrl] = useState(config.url || '');
  const [inputKey, setInputKey] = useState(config.key || '');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; errorType?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [dbCount, setDbCount] = useState<number | null>(null);
  const [lsCount, setLsCount] = useState<number | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);

  // Cloud vs local comparison — makes an incomplete upload visible instead of silent
  const [cloudCount, setCloudCount] = useState<number | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [isCountingCloud, setIsCountingCloud] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushProgress, setPushProgress] = useState(0);
  const [pushResult, setPushResult] = useState<{ ok: boolean; message: string } | null>(null);

  const refreshCloudCount = useCallback(async () => {
    if (!isSupabaseConfigured) { setCloudError('Cloud neconfigurat'); return; }
    setIsCountingCloud(true);
    setCloudError(null);
    const { count, error } = await countCloudRows('devices');
    if (error) { setCloudError(error.message || 'eroare necunoscuta'); setCloudCount(null); }
    else setCloudCount(count);
    setIsCountingCloud(false);
  }, []);

  useEffect(() => { refreshCloudCount(); }, [refreshCloudCount, devices.length]);

  const handlePushAll = useCallback(async () => {
    if (devices.length === 0) return;
    setIsPushing(true);
    setPushProgress(0);
    setPushResult(null);
    const { error, written } = await upsertInChunks('devices', devices, 100, (w) => setPushProgress(w));
    setIsPushing(false);
    if (error) {
      setPushResult({ ok: false, message: `Urcarea s-a oprit dupa ${written} echipamente: ${error.message || error}` });
    } else {
      setPushResult({ ok: true, message: `${written} echipamente au fost urcate in cloud. Deschide aplicatia pe celalalt telefon si apasa Re-sincronizare.` });
    }
    await refreshCloudCount();
  }, [devices, refreshCloudCount]);

  // User management (admin only)
  const canManageUsers = hasPermission(currentUser, 'manageUsers');
  const [users, setUsers] = useState<AppUser[]>(() => getUsers());
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('TEHNICIAN');
  const [newUserPin, setNewUserPin] = useState('');

  const handleAddUser = useCallback(() => {
    if (!newUserName.trim() || newUserPin.length < 4) {
      alert('Completeaza numele si un PIN de minim 4 cifre.');
      return;
    }
    addUser(newUserName, newUserRole, newUserPin);
    setUsers(getUsers());
    setNewUserName('');
    setNewUserPin('');
  }, [newUserName, newUserRole, newUserPin]);

  const handleRemoveUser = useCallback((id: string) => {
    if (id === currentUser?.id) { alert('Nu iti poti sterge propriul cont.'); return; }
    if (!window.confirm('Stergi acest utilizator?')) return;
    if (!removeUser(id)) alert('Nu poti sterge ultimul administrator.');
    setUsers(getUsers());
  }, [currentUser]);

  const handleResetPin = useCallback((user: AppUser) => {
    const pin = window.prompt(`PIN nou pentru ${user.name} (minim 4 cifre):`);
    if (pin && pin.length >= 4) {
      updateUser({ ...user, pin });
      setUsers(getUsers());
    }
  }, []);

  const SQL_FIX = `-- 1. OPEN SUPABASE DASHBOARD -> SQL EDITOR
-- 2. PASTE THIS SCRIPT AND CLICK 'RUN'
-- 3. THIS RESOLVES THE 'PGRST205' ERROR

CREATE TABLE IF NOT EXISTS public.devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Altele',
    manufacturer TEXT,
    model TEXT,
    serialNumber TEXT,
    department TEXT,
    purchaseDate TEXT,
    status TEXT DEFAULT 'Active',
    isCNCAN BOOLEAN DEFAULT FALSE,
    image TEXT,
    notes TEXT,
    maintenanceHistory JSONB DEFAULT '[]'::jsonb,
    contracts JSONB DEFAULT '[]'::jsonb,
    files JSONB DEFAULT '[]'::jsonb,
    components JSONB DEFAULT '[]'::jsonb,
    locationHistory JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    "deviceId" TEXT REFERENCES public.devices(id) ON DELETE SET NULL,
    "deviceName" TEXT,
    department TEXT,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'Pending',
    "createdAt" TEXT,
    "dueDate" TEXT,
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT,
    "userName" TEXT,
    action TEXT,
    entity TEXT,
    "entityId" TEXT,
    "entityName" TEXT,
    details TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Adds the tags column for older installs (safe to re-run)
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Adds incident attachments (photos/video/files) to tickets (safe to re-run)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    supplier TEXT,
    "issueDate" TEXT,
    "dueDate" TEXT,
    amount NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'RON',
    status TEXT DEFAULT 'Unpaid',
    "contractNumber" TEXT,
    "deviceIds" JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all public access" ON public.devices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public access" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public access" ON public.invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public access" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
`;

  useEffect(() => {
    const checkStorage = async () => {
      const stats = await getStorageStats();
      setDbCount(stats.count);
      try {
        const legacy = localStorage.getItem('meditrack_devices');
        setLsCount(legacy ? JSON.parse(legacy).length : 0);
      } catch (e) { setLsCount(0); }
    };
    checkStorage();
  }, [devices]);

  const handleRepairData = useCallback(async () => {
    setIsRepairing(true);
    try {
      const legacyRaw = localStorage.getItem('meditrack_devices');
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        if (Array.isArray(legacy) && legacy.length > 0) {
          await onImport(legacy);
          alert(`S-au recuperat cu succes ${legacy.length} dispozitive vechi.`);
        }
      } else {
        alert("Nu s-au gasit date vechi in LocalStorage de recuperat.");
      }
    } catch (err) {
      alert("Recuperarea a esuat: " + (err as Error).message);
    } finally {
      setIsRepairing(false);
    }
  }, [onImport]);

  const handleCopySql = useCallback(() => {
    navigator.clipboard.writeText(SQL_FIX);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleRunIntegrityTest = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const status = await checkConnection();
      setTestResult({ 
        success: status.success, 
        message: status.message,
        errorType: status.errorType 
      });
    } catch (e: any) {
      setTestResult({ success: false, message: `Eroare: ${e.message}` });
    } finally {
      setIsTesting(false);
    }
  }, []);

  const handleDisconnectCloud = useCallback(() => {
    if (window.confirm("Confirmi deconectarea? Aplicatia va trece in modul doar local.")) {
      clearSupabaseConfig();
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20 px-4">
      
      {/* CLOUD CONNECTION PANEL */}
      <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-5">
            <div className={`p-5 rounded-3xl ${isSupabaseConfigured ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
              <Cloud className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Supabase Core</h2>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Infrastructura globala de date</p>
            </div>
          </div>
          <button onClick={handleRunIntegrityTest} disabled={isTesting || !isSupabaseConfigured} className="p-4 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-2xl transition flex items-center gap-3 border border-slate-100 disabled:opacity-30">
             {isTesting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
             <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Verifica conexiunea</span>
          </button>
        </div>

        {testResult && (
          <div className={`mb-8 p-6 rounded-3xl border animate-fade-in ${testResult.success ? 'bg-green-50 border-green-200 text-green-700' : testResult.errorType === 'table' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <div className="flex gap-4">
              {testResult.success ? <CheckCircle className="w-6 h-6 shrink-0" /> : <AlertTriangle className="w-6 h-6 shrink-0" />}
              <div>
                <p className="font-black text-xs uppercase tracking-widest mb-1">{testResult.success ? 'Conexiune verificata' : 'Eroare de conexiune'}</p>
                <p className="text-sm font-bold leading-relaxed">{testResult.message}</p>
                {testResult.errorType === 'table' && (
                  <p className="mt-3 text-[10px] font-black uppercase tracking-widest bg-amber-600/10 p-2 rounded-lg">Actiune necesara: Executa scriptul SQL de mai jos</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">URL Endpoint Proiect</label>
                <input type="text" value={inputUrl} onChange={(e) => setInputUrl(e.target.value)} placeholder="https://abc.supabase.co" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-mono" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Cheie Anon/Secret</label>
                <div className="relative">
                  <input type={showKey ? "text" : "password"} value={inputKey} onChange={(e) => setInputKey(e.target.value)} placeholder="eyJhbG..." className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-mono pr-24" />
                  <button onClick={() => setShowKey(!showKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{showKey ? "Ascunde" : "Arata"}</button>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button onClick={() => saveSupabaseConfig(inputUrl, inputKey)} className="flex-1 py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl hover:bg-blue-700 transition active:scale-95">Conecteaza Instanta Cloud</button>
              {isSupabaseConfigured && <button onClick={handleDisconnectCloud} className="px-8 py-5 bg-red-50 text-red-600 rounded-[1.5rem] font-black transition hover:bg-red-100" title="Deconecteaza Cloud"><LogOut className="w-6 h-6" /></button>}
            </div>
        </div>
      </div>

      {/* SQL SCHEMA FIX */}
      <div className="bg-slate-900 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Terminal className="w-40 h-40 text-blue-400" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Instalare Schema Baza de Date</h2>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Executa acest script in Supabase SQL Editor</p>
            </div>
          </div>

          <div className="bg-black/50 rounded-2xl p-6 mb-6 shadow-inner relative group border border-white/5">
            <pre className="text-xs font-mono text-blue-100 break-all whitespace-pre-wrap leading-relaxed">
              {SQL_FIX}
            </pre>
            <button 
              onClick={handleCopySql}
              className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiat' : 'Copiaza SQL'}
            </button>
          </div>
        </div>
      </div>

      {/* USER MANAGEMENT — admin only */}
      {canManageUsers && (
        <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
          <div className="flex items-center gap-5 mb-8">
            <div className="p-5 bg-indigo-100 text-indigo-600 rounded-3xl">
              <Users className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Utilizatori & Roluri</h2>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Controlul accesului in aplicatie</p>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="p-2.5 bg-white text-indigo-600 rounded-xl border border-slate-200"><Users className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate">{u.name} {u.id === currentUser?.id && <span className="text-[9px] text-blue-600 font-black uppercase">(tu)</span>}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{ROLE_LABELS[u.role]}</p>
                </div>
                <button onClick={() => handleResetPin(u)} className="p-2.5 bg-white text-slate-400 hover:text-blue-600 rounded-xl border border-slate-200 transition" title="Schimba PIN">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleRemoveUser(u.id)} className="p-2.5 bg-white text-slate-400 hover:text-red-600 rounded-xl border border-slate-200 transition" title="Sterge utilizator">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adauga utilizator nou</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Nume complet"
                className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" />
              <select value={newUserRole} onChange={e => setNewUserRole(e.target.value as UserRole)}
                className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none">
                {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <input value={newUserPin} onChange={e => setNewUserPin(e.target.value.replace(/\D/g, ''))} placeholder="PIN (min. 4 cifre)" inputMode="numeric" maxLength={6}
                className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold font-mono outline-none focus:ring-4 focus:ring-indigo-500/10" />
            </div>
            <button onClick={handleAddUser} className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Creeaza cont
            </button>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
              Roluri: Administrator (tot) · Tehnician (fara Financiar) · Contabil (cu Financiar, fara stergere) · Vizualizare (doar citire)
            </p>
          </div>
        </div>
      )}

      {/* AUDIT LOG */}
      <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
        <div className="flex items-center gap-5 mb-8">
          <div className="p-5 bg-blue-100 text-blue-600 rounded-3xl">
            <Clock className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Jurnal Activitate</h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Cine a modificat ce si cand · ultimele {Math.min(auditLog.length, 50)} actiuni</p>
          </div>
        </div>
        {auditLog.length === 0 ? (
          <p className="py-10 text-center text-xs font-bold text-slate-300 uppercase tracking-widest">Nicio actiune inregistrata inca</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {auditLog.slice(0, 50).map(e => (
              <div key={e.id} className="flex items-center gap-3 p-3.5 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className={`shrink-0 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${e.action === 'delete' ? 'bg-red-50 text-red-500' : e.action === 'create' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                  {e.action === 'create' ? 'Creat' : e.action === 'delete' ? 'Sters' : 'Modif.'}
                </span>
                <span className="shrink-0 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-400">
                  {e.entity === 'device' ? 'Dispozitiv' : e.entity === 'task' ? 'Tichet' : 'Factura'}
                </span>
                <p className="flex-1 min-w-0 text-xs font-bold text-slate-700 truncate">{e.entityName}</p>
                <p className="shrink-0 text-[10px] font-black text-blue-600">{e.userName}</p>
                <p className="shrink-0 text-[9px] font-mono font-bold text-slate-400">
                  {new Date(e.timestamp).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RECOVERY HUB */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-900 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-blue-800 shadow-2xl relative overflow-hidden flex flex-col justify-between h-full">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Wand2 className="w-40 h-40 text-white" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500 text-white rounded-2xl shadow-lg">
                <RefreshCw className={`w-5 h-5 ${isRepairing ? 'animate-spin' : ''}`} />
              </div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Scanare Date Vechi</h2>
            </div>
            <p className="text-xs text-blue-100 mb-8 leading-relaxed font-medium">
              Forteaza o scanare a datelor vechi din browser pentru a recupera dispozitive din versiuni anterioare ale aplicatiei.
            </p>
            <div className="space-y-4">
              <button onClick={handleRepairData} disabled={isRepairing} className="w-full py-4 bg-white text-blue-900 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-50 transition active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50">
                {isRepairing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                Ruleaza Recuperarea
              </button>
              <div className="flex items-center justify-between px-4 py-2 bg-blue-800/30 rounded-lg text-[9px] font-black text-blue-300 uppercase">
                <span>Inregistrari vechi gasite</span>
                <span className="text-white">{lsCount ?? '0'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between h-full">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg">
                <Activity className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Diagnosticare Sincronizare</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                 <span className="text-[10px] font-black text-slate-400 uppercase">Echipamente in stocarea locala</span>
                 <span className="text-sm font-black text-slate-900">{dbCount ?? '...'}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                 <span className="text-[10px] font-black text-slate-400 uppercase">Flota activa in aplicatie</span>
                 <span className="text-sm font-black text-blue-600">{devices.length}</span>
              </div>
              <div className={`flex items-center justify-between p-4 rounded-2xl border ${cloudCount !== null && cloudCount < devices.length ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
                 <span className="text-[10px] font-black text-slate-400 uppercase">Echipamente in cloud</span>
                 <span className="flex items-center gap-2">
                   <span className={`text-sm font-black ${cloudCount !== null && cloudCount < devices.length ? 'text-amber-600' : 'text-emerald-600'}`}>
                     {isCountingCloud ? '...' : cloudError ? '—' : cloudCount ?? '?'}
                   </span>
                   <button onClick={refreshCloudCount} disabled={isCountingCloud} className="p-1.5 text-slate-400 hover:text-blue-600 transition" title="Verifica din nou">
                     <RefreshCw className={`w-3.5 h-3.5 ${isCountingCloud ? 'animate-spin' : ''}`} />
                   </button>
                 </span>
              </div>

              {cloudError && (
                <p className="text-[10px] font-bold text-red-600 px-1 leading-relaxed">Cloud inaccesibil: {cloudError}</p>
              )}

              {cloudCount !== null && cloudCount < devices.length && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                  <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                    In cloud lipsesc <strong>{devices.length - cloudCount}</strong> echipamente. Pe alt telefon vor aparea doar cele {cloudCount} existente in cloud.
                    Apasa mai jos pentru a urca toata flota.
                  </p>
                  <button onClick={handlePushAll} disabled={isPushing}
                    className="w-full py-3.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60">
                    {isPushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                    {isPushing ? `Se urca ${pushProgress}/${devices.length}...` : 'Urca toata flota in cloud'}
                  </button>
                  {isPushing && (
                    <div className="h-2 bg-white rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${devices.length ? (pushProgress / devices.length) * 100 : 0}%` }} />
                    </div>
                  )}
                </div>
              )}

              {pushResult && (
                <div className={`p-4 rounded-2xl border flex items-start gap-3 ${pushResult.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  {pushResult.ok ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />}
                  <p className={`text-[11px] font-bold leading-relaxed ${pushResult.ok ? 'text-emerald-700' : 'text-red-700'}`}>{pushResult.message}</p>
                </div>
              )}
            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-6 font-bold uppercase tracking-widest text-center">Compara ce ai local cu ce exista in cloud</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
