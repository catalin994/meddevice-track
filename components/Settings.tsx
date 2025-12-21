import React, { useRef, useState, useEffect } from 'react';
import { MedicalDevice } from '../types';
import { Download, Upload, AlertTriangle, Database, Cloud, CheckCircle, Save, Link, LogOut, QrCode, Globe } from 'lucide-react';
import { isSupabaseConfigured, getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig } from '../services/supabase';

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
  
  // QR Settings
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    const currentConfig = getSupabaseConfig();
    setConfig(currentConfig);
    setInputUrl(currentConfig.url || '');
    // Don't auto-fill key if it's from env for security visual, but fine for local storage
    if (!currentConfig.isEnv) {
      setInputKey(currentConfig.key || '');
    }

    // Load Base URL
    const storedBaseUrl = localStorage.getItem('meditrack_base_url');
    setBaseUrl(storedBaseUrl || (window.location.origin + window.location.pathname));
  }, []);

  const handleSaveCloudConfig = () => {
    if (!inputUrl || !inputKey) {
      alert("Please provide both the Supabase URL and Anon Key.");
      return;
    }
    saveSupabaseConfig(inputUrl, inputKey);
  };

  const handleDisconnectCloud = () => {
    if (window.confirm("Are you sure you want to disconnect? You will switch back to offline mode.")) {
      clearSupabaseConfig();
    }
  };

  const handleSaveBaseUrl = () => {
      localStorage.setItem('meditrack_base_url', baseUrl);
      alert("QR Code Base URL updated successfully. Regenerate your QR codes by visiting the device page.");
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(devices, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `meditrack_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target?.result as string);
        if (Array.isArray(jsonData)) {
          const isValid = jsonData.every(d => d.id && d.name && d.status);
          if (isValid) {
            if (window.confirm(`Found ${jsonData.length} devices in backup. This will overwrite your current local data state. Continue?`)) {
              onImport(jsonData);
              alert('Data imported successfully!');
            }
          } else {
            alert('Invalid backup file format.');
          }
        }
      } catch (error) {
        alert('Error reading backup file.');
        console.error(error);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
      
      {/* Cloud Connection Card */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-3 rounded-lg ${isSupabaseConfigured ? 'bg-green-100' : 'bg-slate-100'}`}>
            {isSupabaseConfigured ? <Cloud className="w-6 h-6 text-green-600" /> : <Cloud className="w-6 h-6 text-slate-500" />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Cloud Connection</h2>
            <p className="text-sm text-slate-500">
              Connect to your Supabase database to sync data across devices.
            </p>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
          {config.isEnv ? (
             <div className="flex items-center gap-3 text-green-700 bg-green-50 p-4 rounded-lg border border-green-200">
               <CheckCircle className="w-5 h-5" />
               <span className="font-medium">Connected via Environment Variables</span>
             </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project URL</label>
                <input 
                  type="text" 
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-600 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">API Key (anon / public)</label>
                <div className="relative">
                  <input 
                    type={showKey ? "text" : "password"}
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="eyJh..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-600 font-mono pr-20"
                  />
                  <button 
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-2"
                  >
                    {showKey ? "HIDE" : "SHOW"}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                {!isSupabaseConfigured ? (
                  <button 
                    onClick={handleSaveCloudConfig}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
                  >
                    <Link className="w-4 h-4" /> Connect
                  </button>
                ) : (
                   <>
                    <button 
                      onClick={handleSaveCloudConfig}
                      className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Update Settings
                    </button>
                    <button 
                      onClick={handleDisconnectCloud}
                      className="px-4 py-2 bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-200 transition flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" /> Disconnect
                    </button>
                   </>
                )}
              </div>

              {!isSupabaseConfigured && (
                 <p className="text-xs text-slate-500 mt-2">
                   Don't have a project? <a href="https://supabase.com" target="_blank" className="text-blue-600 hover:underline">Create one for free</a>.
                 </p>
              )}
            </div>
          )}
        </div>
      </div>

       {/* QR Code Settings */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-violet-100">
            <QrCode className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">QR Code Configuration</h2>
            <p className="text-sm text-slate-500">
              Customize how QR codes are generated.
            </p>
          </div>
        </div>

        <div className="p-6 border border-slate-200 rounded-xl bg-slate-50">
           <div className="mb-4">
             <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                <Globe className="w-4 h-4" /> Application Public URL
             </label>
             <input 
                type="text" 
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://myapp.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-600 font-mono"
              />
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                <strong className="text-slate-700">Why change this?</strong> If you are running the app locally (e.g., localhost), your phone cannot access "localhost". 
                Change this to your computer's IP address (e.g., <code>http://192.168.1.5:3000</code>) or your public deployment URL so mobile devices can reach the app when scanning.
              </p>
           </div>
           <button 
              onClick={handleSaveBaseUrl}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save URL
           </button>
        </div>
      </div>

      {/* Manual Data Management */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-blue-100">
            <Database className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Backup & Restore</h2>
            <p className="text-sm text-slate-500">
              Manually export or import your data file (JSON).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border border-slate-200 rounded-xl bg-slate-50 hover:border-blue-200 transition">
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-600" /> Export Data
            </h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Download a backup of all devices, maintenance history, and contracts. 
            </p>
            <button 
              onClick={handleExport}
              className="w-full py-2.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100 hover:text-slate-900 transition flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Download Backup
            </button>
          </div>

          <div className="p-6 border border-slate-200 rounded-xl bg-slate-50 hover:border-blue-200 transition">
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Upload className="w-4 h-4 text-green-600" /> Import Data
            </h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Restore data from a JSON backup file.
            </p>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImport} 
              accept=".json" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" /> Select Backup File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;