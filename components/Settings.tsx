
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { MedicalDevice } from '../types';
import { Download, Upload, AlertTriangle, Database, Cloud, CheckCircle, Save, LogOut, ShieldCheck, RefreshCw, Loader2, AlertCircle, Terminal, Copy, Check, Info, HardDrive, Wand2, Activity } from 'lucide-react';
import { isSupabaseConfigured, getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig, supabase, checkConnection } from '../services/supabase';
import { getStorageStats, saveDevicesToDB } from '../services/storageService';

interface SettingsProps {
  devices: MedicalDevice[];
  onImport: (devices: MedicalDevice[]) => void;
}

const Settings: React.FC<SettingsProps> = ({ devices, onImport }) => {
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

-- Enable RLS
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all public access" ON public.devices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public access" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
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
          alert(`Successfully recovered ${legacy.length} legacy devices.`);
        }
      } else {
        alert("No legacy LocalStorage data found to recover.");
      }
    } catch (err) {
      alert("Repair failed: " + (err as Error).message);
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
      setTestResult({ success: false, message: `Failure: ${e.message}` });
    } finally {
      setIsTesting(false);
    }
  }, []);

  const handleDisconnectCloud = useCallback(() => {
    if (window.confirm("Confirm disconnection? This will move the app to local-only mode.")) {
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
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Supabase Core</h2>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Global Data Backbone</p>
            </div>
          </div>
          <button onClick={handleRunIntegrityTest} disabled={isTesting || !isSupabaseConfigured} className="p-4 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-2xl transition flex items-center gap-3 border border-slate-100 disabled:opacity-30">
             {isTesting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
             <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Verify Node</span>
          </button>
        </div>

        {testResult && (
          <div className={`mb-8 p-6 rounded-3xl border animate-fade-in ${testResult.success ? 'bg-green-50 border-green-200 text-green-700' : testResult.errorType === 'table' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <div className="flex gap-4">
              {testResult.success ? <CheckCircle className="w-6 h-6 shrink-0" /> : <AlertTriangle className="w-6 h-6 shrink-0" />}
              <div>
                <p className="font-black text-xs uppercase tracking-widest mb-1">{testResult.success ? 'Connection Verified' : 'Connection Error'}</p>
                <p className="text-sm font-bold leading-relaxed">{testResult.message}</p>
                {testResult.errorType === 'table' && (
                  <p className="mt-3 text-[10px] font-black uppercase tracking-widest bg-amber-600/10 p-2 rounded-lg">Action Required: Execute SQL Fix Below</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Project Endpoint URL</label>
                <input type="text" value={inputUrl} onChange={(e) => setInputUrl(e.target.value)} placeholder="https://abc.supabase.co" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-mono" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Service Anon/Secret Key</label>
                <div className="relative">
                  <input type={showKey ? "text" : "password"} value={inputKey} onChange={(e) => setInputKey(e.target.value)} placeholder="eyJhbG..." className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-mono pr-24" />
                  <button onClick={() => setShowKey(!showKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{showKey ? "Hide" : "Show"}</button>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button onClick={() => saveSupabaseConfig(inputUrl, inputKey)} className="flex-1 py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl hover:bg-blue-700 transition active:scale-95">Link Cloud Instance</button>
              {isSupabaseConfigured && <button onClick={handleDisconnectCloud} className="px-8 py-5 bg-red-50 text-red-600 rounded-[1.5rem] font-black transition hover:bg-red-100" title="Disconnect Cloud"><LogOut className="w-6 h-6" /></button>}
            </div>
        </div>
      </div>

      {/* SQL SCHEMA FIX */}
      <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Terminal className="w-40 h-40 text-blue-400" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Database Schema Deployment</h2>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Execute this in Supabase SQL Editor</p>
            </div>
          </div>

          <div className="bg-black/50 rounded-2xl p-6 mb-6 shadow-inner relative group border border-white/5">
            <pre className="text-xs font-mono text-blue-100 break-all whitespace-pre-wrap leading-relaxed">
              {SQL_FIX}
            </pre>
            <button 
              onClick={handleCopySql}
              className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy SQL'}
            </button>
          </div>
        </div>
      </div>

      {/* RECOVERY HUB */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-900 p-8 rounded-[2.5rem] border border-blue-800 shadow-2xl relative overflow-hidden flex flex-col justify-between h-full">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Wand2 className="w-40 h-40 text-white" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500 text-white rounded-2xl shadow-lg">
                <RefreshCw className={`w-5 h-5 ${isRepairing ? 'animate-spin' : ''}`} />
              </div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Legacy Deep Scan</h2>
            </div>
            <p className="text-xs text-blue-100 mb-8 leading-relaxed font-medium">
              Forces a scan of legacy browser buffers to recover devices from older app versions or alternate data nodes.
            </p>
            <div className="space-y-4">
              <button onClick={handleRepairData} disabled={isRepairing} className="w-full py-4 bg-white text-blue-900 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-50 transition active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50">
                {isRepairing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                Run Recovery
              </button>
              <div className="flex items-center justify-between px-4 py-2 bg-blue-800/30 rounded-lg text-[9px] font-black text-blue-300 uppercase">
                <span>Legacy Records found</span>
                <span className="text-white">{lsCount ?? '0'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between h-full">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg">
                <Activity className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Sync Diagnostics</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                 <span className="text-[10px] font-black text-slate-400 uppercase">Local Storage Assets</span>
                 <span className="text-sm font-black text-slate-900">{dbCount ?? '...'}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                 <span className="text-[10px] font-black text-slate-400 uppercase">Active UI Fleet</span>
                 <span className="text-sm font-black text-blue-600">{devices.length}</span>
              </div>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-6 font-bold uppercase tracking-widest text-center">Diagnostics auto-refresh on activity</p>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Settings);
