
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { MedicalDevice, DeviceStatus, TaskPriority, TaskStatus, MedicalTask, HOSPITAL_DEPARTMENTS, DEVICE_CATEGORIES, DeviceFile, getUniqueDepartments, calculateNextMaintenanceDate, MaintenanceRecord, MaintenanceType } from '../types';
import { 
  Activity, Box, QrCode, Trash2, X, Edit2, Plus, BookOpen,
  Info, CheckSquare, Loader2, Check, ChevronDown, Clock, 
  ShieldAlert, Cpu, Wrench, CheckCircle2, Fingerprint, Save, Camera, RotateCcw, FileText, Upload, DownloadCloud, Eye, Building2, Tag, Layers, Download, Stethoscope, Calendar, Printer
} from 'lucide-react';
const LazyQRCode = React.lazy(() => import('qrcode.react').then(m => ({ default: m.QRCodeCanvas })));

interface DeviceDetailProps {
  device: MedicalDevice;
  tasks: MedicalTask[];
  allDevices?: MedicalDevice[]; // To get fleet-wide depts
  onUpdate: (updatedDevice: MedicalDevice) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  onAddTask: (task: MedicalTask) => void;
  isStandalone?: boolean;
}

const DeviceDetail: React.FC<DeviceDetailProps> = ({ device, tasks, allDevices = [], onUpdate, onDelete, onBack, onAddTask, isStandalone = false }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'maintenance' | 'docs' | 'tasks' | 'qr'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<'manual' | 'report'>('report');

  const [editForm, setEditForm] = useState({
    name: device.name,
    category: device.category,
    manufacturer: device.manufacturer,
    model: device.model,
    serialNumber: device.serialNumber,
    department: device.department,
    status: device.status,
    isCNCAN: !!device.isCNCAN,
    notes: device.notes || '',
    image: device.image || '',
    files: device.files || [],
    purchaseDate: device.purchaseDate,
    nextMaintenanceDate: device.nextMaintenanceDate
  });

  // Sync editForm with device prop when it changes (e.g. from background sync)
  // but only if not currently editing to avoid overwriting user's unsaved changes
  useEffect(() => {
    if (!isEditing) {
      setEditForm({
        name: device.name,
        category: device.category,
        manufacturer: device.manufacturer,
        model: device.model,
        serialNumber: device.serialNumber,
        department: device.department,
        status: device.status,
        isCNCAN: !!device.isCNCAN,
        notes: device.notes || '',
        image: device.image || '',
        files: device.files || [],
        purchaseDate: device.purchaseDate,
        nextMaintenanceDate: device.nextMaintenanceDate
      });
    }
  }, [device, isEditing]);

  const allAvailableDepartments = useMemo(() => {
    return getUniqueDepartments(allDevices);
  }, [allDevices]);

  const handleFinalPurge = useCallback(async () => {
    setIsPurging(true);
    try {
      await onDelete(device.id);
    } catch (err) {
      console.error("Purge failure", err);
      setIsPurging(false);
      setShowPurgeConfirm(false);
    }
  }, [device.id, onDelete]);

  const handleSaveEdit = useCallback(async () => {
    const updatedDevice = { ...device, ...editForm, department: editForm.department.trim() };
    if (updatedDevice.purchaseDate !== device.purchaseDate || updatedDevice.category !== device.category) {
      updatedDevice.nextMaintenanceDate = calculateNextMaintenanceDate(updatedDevice.purchaseDate, updatedDevice.category);
    }
    await onUpdate(updatedDevice);
    setIsEditing(false);
  }, [device, editForm, onUpdate]);

  const handleEditChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as any;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setEditForm(prev => ({ ...prev, [name]: val }));
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // 5MB limit to ensure compatibility with cloud sync (base64 increases size)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File too large (Max 5MB)");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const newFile: DeviceFile = {
          id: `FILE-${Date.now()}`,
          name: file.name,
          type: uploadType,
          url: base64,
          dateAdded: new Date().toISOString().split('T')[0]
        };

        const updatedFiles = [...(editForm.files || []), newFile];
        setEditForm(prev => ({ ...prev, files: updatedFiles }));
        
        // Always save files immediately as they are persistent assets
        // We merge with current editForm to preserve any other unsaved changes
        const updatedDevice = { ...device, ...editForm, files: updatedFiles };
        await onUpdate(updatedDevice);
        setLastSyncTime(new Date().toLocaleTimeString());
      };
      reader.onerror = () => {
        setUploadError("Failed to read file");
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("File upload failed", err);
      setUploadError("Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [device, editForm, onUpdate, uploadType]);

  const handleRemoveFile = useCallback(async (fileId: string) => {
    const updatedFiles = editForm.files.filter(f => f.id !== fileId);
    setEditForm(prev => ({ ...prev, files: updatedFiles }));
    // Always save changes immediately
    await onUpdate({ ...device, ...editForm, files: updatedFiles });
  }, [device, editForm, onUpdate]);

  const viewFile = useCallback((file: DeviceFile) => {
    try {
      let url = file.url;
      
      // For data URLs, we convert to Blob for more reliable opening in new tabs
      if (file.url.startsWith('data:')) {
        const parts = file.url.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1];
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        url = URL.createObjectURL(blob);
      }
      
      const win = window.open(url, '_blank');
      if (!win) {
        setUploadError("Popup blocked! Enable popups to view.");
      }
    } catch (err) {
      console.error("Failed to view file", err);
      // Fallback to iframe method
      const win = window.open();
      if (win) {
        win.document.write(`
          <html>
            <head><title>${file.name}</title></head>
            <body style="margin:0; padding:0; overflow:hidden;">
              <iframe src="${file.url}" frameborder="0" style="width:100%; height:100vh; border:none;" allowfullscreen></iframe>
            </body>
          </html>
        `);
        win.document.close();
      } else {
        setUploadError("Popup blocked! Enable popups to view.");
      }
    }
  }, []);

  const downloadFile = useCallback((file: DeviceFile) => {
    try {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download failed", err);
      setUploadError("Download failed");
    }
  }, []);

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-full relative animate-slide-up">
      {showPurgeConfirm && (
        <div className="fixed inset-0 z-[600] bg-slate-900/40 flex items-center justify-center p-4">
           <div className="hardware-card p-12 max-w-lg w-full text-center rounded-[3rem] shadow-2xl animate-slide-up">
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-8">
                 <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">Confirm Atomic Purge</h3>
              <p className="text-sm text-slate-500 font-medium mb-10 leading-relaxed">
                 You are about to permanently remove <span className="font-black text-slate-900">{device.name}</span> and all associated service history.
              </p>
              <div className="flex gap-4">
                 <button disabled={isPurging} onClick={() => setShowPurgeConfirm(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition">Discard Request</button>
                 <button disabled={isPurging} onClick={handleFinalPurge} className="flex-[2] py-5 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 shadow-xl shadow-red-500/20 transition flex items-center justify-center gap-3">
                    {isPurging ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    {isPurging ? "Purging..." : "Confirm Purge"}
                 </button>
              </div>
           </div>
        </div>
      )}

      <div className="p-8 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white/50 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600 opacity-20" />
        <div className="flex items-start gap-6">
          <div className="hidden md:flex flex-col items-center gap-2">
            <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)] ${device.status === DeviceStatus.ACTIVE ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-amber-500 shadow-amber-500/50'} animate-pulse`} />
            <div className="w-px h-12 bg-slate-100" />
          </div>
          <div>
            {!isStandalone && (
              <button onClick={onBack} className="tech-label mb-4 flex items-center gap-2 transition group hover:text-slate-900 cursor-pointer">
                <span className="group-hover:-translate-x-1 transition-transform font-bold">←</span> SYSTEM_INDEX / ASSETS
              </button>
            )}
            <div className="flex flex-wrap items-center gap-4">
               <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">{device.name}</h1>
               <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-lg tech-label text-[10px]">
                 <Cpu className="w-3 h-3" /> {device.serialNumber}
               </div>
            </div>
            <div className="mt-2 flex items-center gap-4">
              <span className="tech-label text-slate-400">MOD: <span className="text-slate-600">{device.model}</span></span>
              <span className="tech-label text-slate-400">CAT: <span className="text-slate-600">{device.category}</span></span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3 w-full lg:w-auto z-[100]">
           <div className="flex items-center gap-3 w-full lg:w-auto">
             {!isStandalone && (
               isEditing ? (
                 <>
                   <button onClick={handleSaveEdit} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl shadow-lg font-black text-xs uppercase tracking-widest active:scale-95 transition hover:bg-blue-700"><Save className="w-4 h-4" /> Commit Changes</button>
                   <button onClick={() => setIsEditing(false)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition hover:bg-slate-200">Abort</button>
                 </>
               ) : (
                 <>
                   <button onClick={() => setIsEditing(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-xl shadow-lg font-black text-xs uppercase tracking-widest active:scale-95 transition hover:bg-slate-800"><Edit2 className="w-4 h-4" /> Modify Asset</button>
                   <button onClick={() => setShowPurgeConfirm(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition active:scale-95"><Trash2 className="w-4 h-4" /> Purge</button>
                 </>
               )
             )}
           </div>
           {lastSyncTime && <span className="tech-label text-[10px] text-emerald-500">Last Sync: {lastSyncTime}</span>}
        </div>
      </div>

      <div className="flex border-b border-slate-100 px-8 bg-white overflow-x-auto no-scrollbar shadow-sm z-10">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity className="w-4 h-4" />} label="Technical Details" />
        <TabButton active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} icon={<Wrench className="w-4 h-4" />} label="Service Logs" />
        <TabButton active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} icon={<FileText className="w-4 h-4" />} label="Archives & Docs" />
        <TabButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={<CheckSquare className="w-4 h-4" />} label="Operations" />
        <TabButton active={activeTab === 'qr'} onClick={() => setActiveTab('qr')} icon={<QrCode className="w-4 h-4" />} label="Identity" />
      </div>

      <div className="p-8 overflow-y-auto flex-1 bg-slate-50/30 custom-scrollbar">
        {activeTab === 'overview' && (
           <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 max-w-7xl mx-auto">
              <div className="xl:col-span-8 space-y-8 animate-slide-up">
                <div className="hardware-card p-10 rounded-[2.5rem] space-y-8">
                   <div className="flex items-center gap-4 mb-2">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm"><Info className="w-6 h-6" /></div>
                      <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Master Asset Card</h3>
                   </div>
                   
                   {isEditing ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-1">
                           <label className="tech-label ml-1">Asset Nomenclature</label>
                           <input name="name" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={editForm.name} onChange={handleEditChange} />
                        </div>
                        <div className="space-y-1">
                           <label className="tech-label ml-1">Serial Number</label>
                           <input name="serialNumber" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={editForm.serialNumber} onChange={handleEditChange} />
                        </div>
                        <div className="space-y-1">
                           <label className="tech-label ml-1">Asset Category</label>
                           <div className="relative">
                              <select name="category" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none appearance-none focus:border-blue-500 transition-colors" value={editForm.category} onChange={handleEditChange}>
                                {DEVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <Layers className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                           </div>
                        </div>
                        <div className="space-y-1">
                           <label className="tech-label ml-1">Manufacturer</label>
                           <input name="manufacturer" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={editForm.manufacturer} onChange={handleEditChange} />
                        </div>
                        <div className="space-y-1">
                           <label className="tech-label ml-1">Model Line</label>
                           <input name="model" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={editForm.model} onChange={handleEditChange} />
                        </div>
                        <div className="space-y-1">
                           <label className="tech-label ml-1">Fleet Unit (Department)</label>
                           <div className="relative">
                              <select name="department" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none appearance-none focus:border-blue-500 transition-colors" value={editForm.department} onChange={handleEditChange}>
                                {allAvailableDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                              <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                           </div>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                           <label className="tech-label ml-1">Functional Status</label>
                           <select name="status" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={editForm.status} onChange={handleEditChange}>
                              {Object.values(DeviceStatus).map(s => <option key={s} value={s}>{s}</option>)}
                           </select>
                        </div>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                        <InfoRow label="Serial Number" value={device.serialNumber} badge />
                        <InfoRow label="Model Line" value={device.model} />
                        <InfoRow label="Clinical Unit" value={device.department} />
                        <InfoRow label="Asset Class" value={device.category} />
                        <InfoRow label="Manufacturer" value={device.manufacturer} />
                        <InfoRow label="Status" value={device.status} />
                        <InfoRow label="Next PM Date" value={device.nextMaintenanceDate || 'Not Scheduled'} badge />
                     </div>
                   )}
                   
                   <div className="pt-8 border-t border-slate-100">
                      <label className="tech-label block mb-3">Technical Field Notes</label>
                      {isEditing ? (
                        <textarea name="notes" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium min-h-[100px] outline-none focus:border-blue-500 transition-colors" value={editForm.notes} onChange={handleEditChange} />
                      ) : (
                        <p className="text-sm text-slate-600 font-medium leading-relaxed bg-slate-50/50 p-6 rounded-2xl border border-slate-100 italic">
                          {device.notes || 'No operational exceptions logged.'}
                        </p>
                      )}
                   </div>
                </div>
              </div>

              <div className="xl:col-span-4">
                <div className="hardware-card p-8 rounded-[2.5rem] overflow-hidden group">
                   <div className="aspect-square bg-white rounded-3xl border border-slate-100 flex items-center justify-center overflow-hidden relative shadow-inner">
                      {device.image ? <img src={device.image} alt="Visual" className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" /> : <Box className="w-16 h-16 text-slate-200 opacity-50" />}
                   </div>
                </div>
              </div>
           </div>
        )}

        {activeTab === 'docs' && (
          <div className="max-w-6xl mx-auto py-6 space-y-8 animate-slide-up">
             <div className="hardware-card p-10 rounded-[2.5rem] flex flex-col lg:flex-row justify-between items-center gap-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-600/20" />
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-xl">
                      <BookOpen className="w-8 h-8" />
                   </div>
                   <div>
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Technical Archives</h3>
                      <p className="tech-label mt-1">Centralized Asset Documentation & Manuals</p>
                   </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                   <div className="flex flex-col gap-1 w-full sm:w-auto">
                      <label className="tech-label ml-1 mb-1">Document Type</label>
                      <select 
                         className="bg-white border border-slate-200 rounded-xl px-4 py-3 tech-label outline-none cursor-pointer focus:border-blue-500 transition-all shadow-sm min-w-[180px]"
                         value={uploadType}
                         onChange={(e) => setUploadType(e.target.value as any)}
                      >
                         <option value="report">Service Report</option>
                         <option value="manual">Technical Manual</option>
                         <option value="other">Other Document</option>
                      </select>
                   </div>
                   <div className="flex flex-col gap-1 w-full sm:w-auto">
                      <label className="tech-label ml-1 mb-1 opacity-0">Action</label>
                      <button 
                         onClick={() => fileInputRef.current?.click()}
                         disabled={isUploading}
                         className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 text-white rounded-xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-blue-700 transition shadow-xl shadow-blue-600/20 active:scale-95 disabled:opacity-50"
                      >
                         {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                         {isUploading ? "Processing..." : "Register Archive"}
                      </button>
                   </div>
                   <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                </div>
             </div>

             {uploadError && (
               <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 animate-shake">
                 <ShieldAlert className="w-5 h-5 text-red-600" />
                 <span className="text-xs font-bold text-red-600 uppercase tracking-wider">{uploadError}</span>
               </div>
             )}

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Technical Manuals Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-6 bg-blue-600 rounded-full" />
                        <h4 className="tech-label text-slate-900">Technical Manuals</h4>
                     </div>
                     <span className="tech-label text-slate-400">{(editForm.files || []).filter(f => f.type === 'manual').length} Units</span>
                  </div>
                  
                  <div className="space-y-4">
                     {editForm.files.filter(f => f.type === 'manual').length > 0 ? (
                       editForm.files.filter(f => f.type === 'manual').map(file => (
                         <FileCard key={file.id} file={file} onView={() => viewFile(file)} onDownload={() => downloadFile(file)} onDelete={() => handleRemoveFile(file.id)} />
                       ))
                     ) : (
                       <div className="py-12 hardware-card rounded-[2rem] border-dashed border-slate-200 flex flex-col items-center justify-center opacity-50">
                          <BookOpen className="w-10 h-10 text-slate-300 mb-3" />
                          <p className="tech-label">No Manuals Found</p>
                       </div>
                     )}
                  </div>
                </div>

                {/* Service Reports Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                        <h4 className="tech-label text-slate-900">Service Reports</h4>
                     </div>
                     <span className="tech-label text-slate-400">{(editForm.files || []).filter(f => f.type === 'report').length} Units</span>
                  </div>
                  
                  <div className="space-y-4">
                     {editForm.files.filter(f => f.type === 'report').length > 0 ? (
                       editForm.files.filter(f => f.type === 'report').map(file => (
                         <FileCard key={file.id} file={file} color="emerald" onView={() => viewFile(file)} onDownload={() => downloadFile(file)} onDelete={() => handleRemoveFile(file.id)} />
                       ))
                     ) : (
                       <div className="py-12 hardware-card rounded-[2rem] border-dashed border-slate-200 flex flex-col items-center justify-center opacity-50">
                          <FileText className="w-10 h-10 text-slate-300 mb-3" />
                          <p className="tech-label">No Reports Found</p>
                       </div>
                     )}
                  </div>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="max-w-5xl mx-auto py-6 space-y-8 animate-fade-in">
             <div className="hardware-card p-10 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
                      <CheckSquare className="w-8 h-8" />
                   </div>
                   <div>
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Operation Tracker</h3>
                      <p className="tech-label mt-1">Active Maintenance & Deployment Tasks</p>
                   </div>
                </div>
                <button 
                   onClick={() => {
                     const newTask: MedicalTask = {
                       id: `TASK-${Date.now()}`,
                       title: `Maintenance for ${device.name}`,
                       description: '',
                       deviceId: device.id,
                       deviceName: device.name,
                       department: device.department,
                       priority: TaskPriority.MEDIUM,
                       status: TaskStatus.PENDING,
                       createdAt: new Date().toISOString().split('T')[0],
                     };
                     onAddTask(newTask);
                   }}
                   className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-blue-600 transition shadow-xl active:scale-95"
                >
                   <Plus className="w-5 h-5" /> Initialize Task
                </button>
             </div>

             <div className="grid grid-cols-1 gap-4">
                {tasks.length > 0 ? tasks.map(task => (
                  <div key={task.id} className="hardware-card p-6 rounded-[2rem] flex flex-col md:flex-row items-center gap-6 hover:shadow-xl transition-all group">
                     <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                        task.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 
                        task.status === 'in-progress' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                     }`}>
                        {task.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                     </div>
                     <div className="flex-1 text-center md:text-left">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-1">
                           <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                              task.status === 'completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                              task.status === 'in-progress' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                           }`}>
                              {task.status}
                           </span>
                           <span className="text-[10px] font-mono font-bold text-slate-400">ID: {task.id.slice(0,8)}</span>
                           <span className="text-[10px] font-mono font-bold text-slate-400">Due: {task.createdAt}</span>
                        </div>
                        <h4 className="text-base font-black text-slate-900 group-hover:text-blue-600 transition-colors">{task.title}</h4>
                        <p className="text-sm text-slate-500 mt-1 line-clamp-1 font-medium">{task.description || 'No description provided.'}</p>
                     </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border ${
                          task.status === TaskStatus.PENDING ? 'border-slate-200 text-slate-400 bg-white' : 
                          task.status === TaskStatus.IN_PROGRESS ? 'border-blue-200 text-blue-600 bg-blue-50/50' : 
                          'border-green-200 text-green-600 bg-green-50/50'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                  </div>
                )) : (
                  <div className="py-20 text-center bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center">
                     <CheckSquare className="w-16 h-16 text-slate-100 mb-4" />
                     <p className="tech-label">No active operations</p>
                  </div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="max-w-5xl mx-auto py-6 space-y-8 animate-slide-up">
             <div className="hardware-card p-10 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
                      <Wrench className="w-8 h-8" />
                   </div>
                   <div>
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Service History</h3>
                      <p className="tech-label mt-1">Technical Intervention Logs</p>
                   </div>
                </div>
                <button 
                   onClick={() => {
                     const newRecord: MaintenanceRecord = {
                       id: `MT-${Math.floor(Math.random() * 90000)}`,
                       date: new Date().toISOString().split('T')[0],
                       type: MaintenanceType.PREVENTIVE,
                       technician: 'Assigned Bio-Med',
                       description: 'Standard preventive maintenance and calibration check.',
                       completed: true
                     };
                     const updatedDevice = {
                       ...device,
                       maintenanceHistory: [newRecord, ...(device.maintenanceHistory || [])],
                       nextMaintenanceDate: calculateNextMaintenanceDate(newRecord.date, device.category)
                     };
                     onUpdate(updatedDevice);
                   }}
                   className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-blue-600 transition shadow-xl active:scale-95"
                >
                   <Plus className="w-5 h-5" /> Log Intervention
                </button>
             </div>

             <div className="space-y-6">
                {(device.maintenanceHistory || []).length > 0 ? device.maintenanceHistory.map(record => (
                  <div key={record.id} className="hardware-card p-8 rounded-[2.5rem] space-y-6 hover:shadow-xl transition-all group">
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-slate-50 text-slate-600 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                              <Calendar className="w-5 h-5" />
                           </div>
                           <div>
                              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{record.type}</h4>
                              <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">EXECUTED ON: {record.date} BY {record.technician}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           {record.completed && (
                             <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                                <CheckCircle2 className="w-5 h-5" />
                             </div>
                           )}
                        </div>
                     </div>
                     <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                        <p className="text-sm text-slate-600 font-medium leading-relaxed italic">"{record.description}"</p>
                     </div>
                  </div>
                )) : (
                  <div className="py-20 text-center bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center">
                     <Wrench className="w-16 h-16 text-slate-100 mb-4" />
                     <p className="tech-label">No service history recorded</p>
                  </div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'qr' && (
          <div className="max-w-xl mx-auto py-12 animate-slide-up">
             <div className="hardware-card p-12 rounded-[3rem] text-center space-y-10">
                <div className="space-y-2">
                   <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Asset Identity Matrix</h3>
                   <p className="tech-label">Unique QR Identification</p>
                </div>
                
                <div className="bg-white p-10 rounded-[2.5rem] shadow-inner border border-slate-100 inline-block mx-auto relative group">
                   <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem]" />
                   <React.Suspense fallback={<div className="w-60 h-60 animate-pulse bg-slate-100 rounded-2xl" />}>
                     <LazyQRCode
                        id="device-qr-code"
                        value={`${window.location.origin}?view=DEVICE_DETAIL&id=${device.id}&standalone=true`}
                        size={240}
                        level="H"
                        includeMargin={true}
                        imageSettings={{ src: "https://picsum.photos/seed/med/64/64", x: undefined, y: undefined, height: 40, width: 40, excavate: true }}
                     />
                   </React.Suspense>
                </div>

                <div className="space-y-6">
                   <div className="flex flex-col items-center gap-2">
                      <span className="tech-label">Asset Identifier</span>
                      <code className="px-6 py-2 bg-slate-900 text-white rounded-xl font-mono text-sm shadow-lg">{device.id}</code>
                   </div>
                   
                   <div className="flex gap-4 pt-4">
                      <button 
                        onClick={() => {
                          const canvas = document.getElementById('device-qr-code') as HTMLCanvasElement;
                          if (canvas) {
                            const url = canvas.toDataURL('image/png');
                            const link = document.createElement('a');
                            link.download = `QR-${device.serialNumber || device.id}.png`;
                            link.href = url;
                            link.click();
                          }
                        }}
                        className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-600 transition shadow-xl active:scale-95"
                      >
                        <Download className="w-5 h-5" /> Export Matrix
                      </button>
                      <button 
                        onClick={() => window.print()}
                        className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-200 transition active:scale-95"
                      >
                        <Printer className="w-5 h-5" /> Print Label
                      </button>
                   </div>
                </div>

                <div className="pt-8 border-t border-slate-100">
                   <p className="text-[10px] font-mono font-bold text-slate-400 leading-relaxed uppercase">
                      Scanning this matrix provides instant access to technical documentation, service history, and operational status.
                   </p>
                </div>
             </div>
          </div>
        )}
      </div>

      {isStandalone && (
        <div className="p-8 bg-slate-900 text-white flex flex-col items-center gap-4 text-center">
           <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg"><Stethoscope className="w-5 h-5 text-white" /></div>
              <h1 className="text-lg font-black tracking-tight text-white uppercase">MediTrack</h1>
           </div>
           <p className="text-xs text-slate-400 font-medium max-w-xs">
              This is a standalone asset view. To manage your entire clinical fleet, access the main application dashboard.
           </p>
           <a 
              href={window.location.origin}
              className="mt-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/10"
           >
              Open Full Application
           </a>
        </div>
      )}
    </div>
  );
};

const FileCard = React.memo(({ file, color = 'blue', onView, onDownload, onDelete }: any) => (
  <div className="hardware-card p-5 rounded-[1.5rem] hover:shadow-xl hover:shadow-slate-200/50 transition-all group relative overflow-hidden">
    <div className={`absolute top-0 left-0 w-1 h-full bg-${color}-600`} />
    <div className="flex items-center gap-4">
       <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600 shadow-sm`}>
          {file.type === 'manual' ? <BookOpen className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
       </div>
       <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
             <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-widest border bg-${color}-50 border-${color}-100 text-${color}-700`}>
                {file.type}
             </span>
             <span className="text-[10px] font-mono font-bold text-slate-400">{file.dateAdded}</span>
          </div>
          <h4 className="text-xs font-black text-slate-900 truncate pr-2 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{file.name}</h4>
       </div>
       <div className="flex items-center gap-0.5">
          <button onClick={onView} className="p-2 text-slate-400 hover:text-blue-600 transition active:scale-90" title="View"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={onDownload} className="p-2 text-slate-400 hover:text-green-600 transition active:scale-90" title="Download"><Download className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-600 transition active:scale-90" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
       </div>
    </div>
  </div>
));

const TabButton = React.memo(({ active, onClick, icon, label }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-8 py-6 text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${
      active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
    }`}
  >
    {icon}
    {label}
    {active && <div className="absolute bottom-0 left-8 right-8 h-1 bg-blue-600 rounded-full shadow-[0_-2px_10px_rgba(37,99,235,0.3)]" />}
  </button>
));

const InfoRow = React.memo(({ label, value, badge }: any) => (
  <div className="space-y-1.5 group">
    <span className="tech-label ml-1 group-hover:text-blue-600 transition-colors">{label}</span>
    <div className={`p-4 rounded-2xl font-bold text-sm transition-all ${
      badge ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-700 border border-slate-100'
    }`}>
      {value}
    </div>
  </div>
));

export default DeviceDetail;
