
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { MedicalDevice, AuditEntry, AppUser, UserRole, ROLE_LABELS, hasPermission } from '../types';
import { Download, Upload, AlertTriangle, Database, Cloud, CheckCircle, Save, LogOut, ShieldCheck, RefreshCw, Loader2, AlertCircle, Terminal, Copy, Check, Info, HardDrive, Wand2, Activity, Users, Plus, Trash2, Clock, Pencil } from 'lucide-react';
import { isSupabaseConfigured, getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig, supabase, checkConnection, countCloudRows, upsertInChunks, diagnoseCloud, CloudDiagnosis, fetchAllRows } from '../services/supabase';
import { getStorageStats, saveDevicesToDB } from '../services/storageService';
import { listProfiles, updateProfile } from '../services/authService';
import { SECURITY_SQL } from '../services/authSql';
import { buildUploadSet } from '../services/syncMerge';

declare const __BUILD_ID__: string;
const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

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
  const [diagnosis, setDiagnosis] = useState<CloudDiagnosis | null>(null);
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

  // Lists exactly which device IDs differ, so a count mismatch stops being a mystery
  const [diffResult, setDiffResult] = useState<{ localOnly: string[]; cloudOnly: string[] } | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const handleCompare = useCallback(async () => {
    setIsComparing(true);
    setDiffResult(null);
    const { data, error } = await fetchAllRows<{ id: string; name?: string }>('devices');
    if (error || !data) {
      setPushResult({ ok: false, message: `Nu s-a putut citi lista din cloud: ${error?.message || 'eroare'}` });
      setIsComparing(false);
      return;
    }
    const cloudIds = new Set(data.map(d => String(d.id).trim()));
    const localIds = new Set(devices.map(d => String(d.id).trim()));
    const nameOf = (id: string) => devices.find(d => d.id === id)?.name
      || data.find(d => String(d.id).trim() === id)?.name || id;
    setDiffResult({
      localOnly: [...localIds].filter(id => !cloudIds.has(id)).map(id => `${nameOf(id)} (${id})`),
      cloudOnly: [...cloudIds].filter(id => !localIds.has(id)).map(id => `${nameOf(id)} (${id})`),
    });
    setIsComparing(false);
  }, [devices]);

  const handlePushAll = useCallback(async () => {
    if (devices.length === 0) return;
    setIsPushing(true);
    setPushProgress(0);
    setPushResult(null);
    // Never blind-overwrite: read what the cloud has, merge, and send only what
    // is genuinely newer or missing — otherwise this button can wipe documents
    // scanned on another device.
    const { data: cloudRows, error: readErr } = await fetchAllRows<MedicalDevice>('devices');
    if (readErr) {
      setIsPushing(false);
      setPushResult({ ok: false, message: `Nu s-a putut citi cloud-ul inainte de urcare: ${readErr.message || readErr}` });
      return;
    }
    const toUpload = buildUploadSet(devices, cloudRows || []);
    if (toUpload.length === 0) {
      setIsPushing(false);
      setPushResult({ ok: true, message: 'Cloud-ul are deja tot ce exista pe acest dispozitiv — nimic de urcat.' });
      await refreshCloudCount();
      return;
    }
    const { error, written, skippedColumns, oversized } = await upsertInChunks('devices', toUpload, 100, (w) => setPushProgress(w));
    setIsPushing(false);
    if (error) {
      setPushResult({ ok: false, message: `Urcarea s-a oprit dupa ${written} echipamente: ${error.message || error}` });
    } else if (oversized.length > 0) {
      setPushResult({ ok: false, message: `${written} echipamente urcate, dar ${oversized.length} nu au incaput (documente atasate prea mari): ${oversized.slice(0, 3).join(', ')}${oversized.length > 3 ? '...' : ''}` });
    } else if (skippedColumns.length > 0) {
      setPushResult({ ok: true, message: `${written} echipamente au fost urcate. Atentie: campurile ${skippedColumns.join(', ')} nu exista in tabelul din cloud si au fost omise — ruleaza scriptul SQL de mai sus in Supabase, apoi urca din nou ca sa se salveze si ele.` });
    } else {
      setPushResult({ ok: true, message: `${written} echipamente au fost urcate in cloud. Deschide aplicatia pe celalalt telefon si apasa Re-sincronizare.` });
    }
    await refreshCloudCount();
  }, [devices, refreshCloudCount]);

  // User management (admin only)
  const canManageUsers = hasPermission(currentUser, 'manageUsers');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersError, setUsersError] = useState('');

  const refreshUsers = useCallback(async () => {
    const list = await listProfiles();
    setUsers(list);
  }, []);

  useEffect(() => { if (canManageUsers) refreshUsers(); }, [canManageUsers, refreshUsers]);

  const handleSetRole = useCallback(async (user: AppUser, role: UserRole) => {
    setUsersError('');
    const { error } = await updateProfile(user.id, { role, approved: true });
    if (error) setUsersError(error); else refreshUsers();
  }, [refreshUsers]);

  const handleToggleApproved = useCallback(async (user: AppUser) => {
    setUsersError('');
    const { error } = await updateProfile(user.id, { approved: !user.approved });
    if (error) setUsersError(error); else refreshUsers();
  }, [refreshUsers]);


  /** Clears every browser cache and reloads — the reliable way to escape a
   *  stale bundle on phones, where a normal refresh often isn't enough. */
  const handleHardReload = useCallback(async () => {
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch { /* best effort */ }
    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now().toString());
    window.location.replace(url.toString());
  }, []);


  const SQL_FIX = `-- MEDITRACK — SCHEMA + MIGRARE (se poate rula de mai multe ori, in siguranta)
-- 1. Deschide Supabase Dashboard -> SQL Editor
-- 2. Lipeste tot acest script si apasa RUN
--
-- IMPORTANT: in PostgreSQL, un nume de coloana scris fara ghilimele devine
-- minuscule (serialNumber -> serialnumber). Aplicatia trimite serialNumber,
-- deci fara ghilimele fiecare salvare de echipament era respinsa.
-- Blocul de migrare de mai jos redenumeste coloanele vechi, pastrand datele.

-- ── 1. TABELE ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Altele',
    manufacturer TEXT,
    model TEXT,
    "serialNumber" TEXT,
    department TEXT,
    "purchaseDate" TEXT,
    "warrantyExpiration" TEXT,
    "nextMaintenanceDate" TEXT,
    status TEXT DEFAULT 'Active',
    "isCNCAN" BOOLEAN DEFAULT FALSE,
    image TEXT,
    notes TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    "maintenanceHistory" JSONB DEFAULT '[]'::jsonb,
    contracts JSONB DEFAULT '[]'::jsonb,
    files JSONB DEFAULT '[]'::jsonb,
    components JSONB DEFAULT '[]'::jsonb,
    "locationHistory" JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    "deviceId" TEXT,
    "deviceName" TEXT,
    department TEXT,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'Pending',
    "createdAt" TEXT,
    "dueDate" TEXT,
    notes TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

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

CREATE TABLE IF NOT EXISTS public.deletions (
    id TEXT PRIMARY KEY,
    entity TEXT,
    "entityId" TEXT,
    "deletedAt" TEXT,
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

-- ── 2. MIGRARE: redenumeste coloanele minuscule create anterior ──────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('devices','serialnumber','serialNumber'),
      ('devices','purchasedate','purchaseDate'),
      ('devices','warrantyexpiration','warrantyExpiration'),
      ('devices','nextmaintenancedate','nextMaintenanceDate'),
      ('devices','iscncan','isCNCAN'),
      ('devices','maintenancehistory','maintenanceHistory'),
      ('devices','locationhistory','locationHistory'),
      ('tasks','deviceid','deviceId'),
      ('tasks','devicename','deviceName'),
      ('tasks','createdat','createdAt'),
      ('tasks','duedate','dueDate'),
      ('invoices','invoicenumber','invoiceNumber'),
      ('invoices','issuedate','issueDate'),
      ('invoices','duedate','dueDate'),
      ('invoices','contractnumber','contractNumber'),
      ('invoices','deviceids','deviceIds'),
      ('invoices','fileurl','fileUrl'),
      ('invoices','filename','fileName'),
      ('audit_logs','username','userName'),
      ('audit_logs','entityid','entityId'),
      ('audit_logs','entityname','entityName')
    ) AS t(tbl, old_col, new_col)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name=r.tbl AND column_name=r.old_col)
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name=r.tbl AND column_name=r.new_col) THEN
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I', r.tbl, r.old_col, r.new_col);
      RAISE NOTICE 'Redenumit %.% -> %', r.tbl, r.old_col, r.new_col;
    END IF;
  END LOOP;
END $$;

-- ── 3. COMPLETEAZA coloanele lipsa (pentru instalari partiale) ───────────────
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "purchaseDate" TEXT;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "warrantyExpiration" TEXT;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "nextMaintenanceDate" TEXT;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "isCNCAN" BOOLEAN DEFAULT FALSE;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "maintenanceHistory" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "locationHistory" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS contracts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS components JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.tasks    ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tasks    ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE public.tasks    ADD COLUMN IF NOT EXISTS "deviceName" TEXT;

-- ── 4. ACCES (idempotent — se poate rula din nou fara eroare) ────────────────
ALTER TABLE public.devices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletions  ENABLE ROW LEVEL SECURITY;

-- Politicile de acces sunt create de scriptul "Conturi si acces" de mai jos.
-- Acest script nu mai acorda acces public: pana rulezi si celalalt script,
-- tabelele raman inchise.

-- ── 5. Reincarca schema pentru API ──────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
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

  const [copiedSec, setCopiedSec] = useState(false);
  const handleCopySecuritySql = useCallback(() => {
    navigator.clipboard.writeText(SECURITY_SQL);
    setCopiedSec(true);
    setTimeout(() => setCopiedSec(false), 2000);
  }, []);

  const handleCopySql = useCallback(() => {
    navigator.clipboard.writeText(SQL_FIX);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleRunIntegrityTest = useCallback(async () => {
    setIsTesting(true);
    setDiagnosis(null);
    try {
      setDiagnosis(await diagnoseCloud());
    } catch (e: any) {
      setDiagnosis({ ok: false, stage: 'blocked', title: 'Verificare eșuată',
        detail: e?.message || String(e), hint: 'Reincearca sau verifica conexiunea la internet.' });
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

        {diagnosis && (
          <div className={`mb-8 p-5 sm:p-6 rounded-3xl border animate-fade-in ${
            diagnosis.ok ? 'bg-green-50 border-green-200 text-green-700'
            : diagnosis.stage === 'schema' ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-red-50 border-red-200 text-red-700'}`}>
            <div className="flex gap-4">
              {diagnosis.ok ? <CheckCircle className="w-6 h-6 shrink-0" /> : <AlertTriangle className="w-6 h-6 shrink-0" />}
              <div className="min-w-0 space-y-2">
                <p className="font-black text-xs uppercase tracking-widest">{diagnosis.title}</p>
                <p className="text-sm font-bold leading-relaxed break-words">{diagnosis.detail}</p>
                {diagnosis.hint && (
                  <p className="text-[11px] font-medium leading-relaxed bg-black/5 p-3 rounded-xl">{diagnosis.hint}</p>
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

          <div className="flex items-center gap-4 mb-6 pt-4 border-t border-white/10">
            <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Conturi si acces</h2>
              <p className="text-[11px] text-emerald-300 font-bold">Ruleaza al doilea, dupa scriptul de schema</p>
            </div>
          </div>

          <div className="p-4 mb-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl">
            <p className="text-[13px] text-amber-200 font-semibold leading-relaxed">
              Pana rulezi acest script, tabelele nu au nicio politica de acces, deci sincronizarea
              nu functioneaza. Dupa ce il rulezi, primul cont inregistrat devine automat
              Administrator aprobat — inregistreaza-te tu primul.
            </p>
          </div>

          <div className="bg-black/50 rounded-2xl p-6 shadow-inner relative border border-white/5 max-h-[420px] overflow-y-auto custom-scrollbar">
            <pre className="text-xs font-mono text-emerald-100 break-all whitespace-pre-wrap leading-relaxed">
              {SECURITY_SQL}
            </pre>
            <button
              onClick={handleCopySecuritySql}
              className="sticky top-0 float-right -mt-2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-2 text-[11px] font-bold"
            >
              {copiedSec ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedSec ? 'Copiat' : 'Copiaza SQL'}
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

          {usersError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl">
              <p className="text-xs font-bold text-red-600">{usersError}</p>
            </div>
          )}

          <div className="space-y-3 mb-8">
            {users.length === 0 && (
              <p className="text-sm font-semibold text-slate-400 py-6 text-center">
                Niciun cont inca. Utilizatorii se inregistreaza singuri din ecranul de autentificare.
              </p>
            )}
            {users.map(u => (
              <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className={`p-2.5 rounded-xl border shrink-0 self-start ${u.approved ? 'bg-white text-indigo-600 border-slate-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-slate-900 truncate">
                    {u.name}
                    {u.id === currentUser?.id && <span className="ml-2 text-[11px] text-blue-600 font-bold">(tu)</span>}
                  </p>
                  <p className="text-xs font-semibold text-slate-500 truncate">{u.email}</p>
                  {!u.approved && (
                    <p className="text-[11px] font-bold text-amber-600 mt-0.5">Asteapta aprobare</p>
                  )}
                </div>
                <select
                  value={u.role}
                  onChange={e => handleSetRole(u, e.target.value as UserRole)}
                  disabled={u.id === currentUser?.id}
                  title={u.id === currentUser?.id ? 'Nu iti poti schimba propriul rol' : 'Schimba rolul'}
                  className="px-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 outline-none disabled:opacity-50"
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                <button
                  onClick={() => handleToggleApproved(u)}
                  disabled={u.id === currentUser?.id}
                  className={`px-4 py-2.5 rounded-xl text-[13px] font-bold transition active:scale-95 disabled:opacity-50 whitespace-nowrap ${
                    u.approved
                      ? 'bg-white text-slate-500 border-2 border-slate-200 hover:text-red-600 hover:border-red-200'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {u.approved ? 'Suspenda' : 'Aproba'}
                </button>
              </div>
            ))}
          </div>

          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
            <p className="text-[13px] font-bold text-slate-500">Cum se adauga un utilizator</p>
            <p className="text-sm font-medium text-slate-600 leading-relaxed">
              Persoana isi creeaza singura cont din ecranul de autentificare, cu emailul si o parola
              proprie. Contul apare aici imediat, marcat <span className="font-bold text-amber-600">Asteapta aprobare</span>,
              si nu vede niciun fel de date pana cand nu ii alegi un rol si apesi <span className="font-bold">Aproba</span>.
            </p>
            <p className="text-[13px] font-semibold text-slate-500 leading-relaxed pt-1">
              Roluri: <span className="text-slate-700">Administrator</span> (tot, inclusiv stergeri) ·
              <span className="text-slate-700"> Tehnician</span> (fara Financiar) ·
              <span className="text-slate-700"> Contabil</span> (cu Financiar) ·
              <span className="text-slate-700"> Vizualizare</span> (doar citire)
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
                    {isPushing ? `Se urca ${pushProgress}...` : 'Urca toata flota in cloud'}
                  </button>
                  {isPushing && (
                    <div className="h-2 bg-white rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${devices.length ? (pushProgress / devices.length) * 100 : 0}%` }} />
                    </div>
                  )}
                </div>
              )}

              <button onClick={handleCompare} disabled={isComparing}
                className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60">
                {isComparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                {isComparing ? 'Se compara...' : 'Compara local cu cloud'}
              </button>

              {diffResult && (
                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                  {diffResult.localOnly.length === 0 && diffResult.cloudOnly.length === 0 ? (
                    <p className="text-[11px] font-bold text-emerald-700">Identice — fiecare echipament local exista si in cloud.</p>
                  ) : (
                    <>
                      {diffResult.localOnly.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">
                            Doar pe acest dispozitiv ({diffResult.localOnly.length})
                          </p>
                          <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                            {diffResult.localOnly.slice(0, 20).map(x => (
                              <li key={x} className="text-[10px] font-mono text-slate-600 truncate">{x}</li>
                            ))}
                          </ul>
                          <p className="text-[9px] text-slate-400 font-bold mt-1">Apasa "Urca toata flota" ca sa ajunga si in cloud.</p>
                        </div>
                      )}
                      {diffResult.cloudOnly.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">
                            Doar in cloud ({diffResult.cloudOnly.length})
                          </p>
                          <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                            {diffResult.cloudOnly.slice(0, 20).map(x => (
                              <li key={x} className="text-[10px] font-mono text-slate-600 truncate">{x}</li>
                            ))}
                          </ul>
                          <p className="text-[9px] text-slate-400 font-bold mt-1">Apasa "Re-sincronizare" ca sa le aduci aici.</p>
                        </div>
                      )}
                    </>
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
          <div className="mt-6 pt-4 border-t border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Versiune aplicatie</span>
              <span className="text-[10px] font-mono font-bold text-slate-600">{BUILD_ID}</span>
            </div>
            <button onClick={handleHardReload}
              className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Forteaza reincarcarea aplicatiei
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
