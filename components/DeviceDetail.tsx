
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { MedicalDevice, DeviceStatus, TaskPriority, TaskStatus, MedicalTask, HOSPITAL_DEPARTMENTS, DEVICE_CATEGORIES, DeviceFile, getUniqueDepartments, calculateNextMaintenanceDate, MaintenanceRecord, MaintenanceType, Invoice, AuditEntry, DEVICE_STATUS_RO, TASK_STATUS_RO, MAINTENANCE_TYPE_RO } from '../types';
import { valabilitatePropusa } from '../services/termene';
import Portal from './Portal';
import { saveFileAs } from '../services/fileService';
import { buildPath, uploadDataUrl, uploadFile, removeFile, resolveSource } from '../services/fileStorage';
import { undeMaiEste, maiEFolosit, leagaFisierul } from '../services/fisierePartajate';
import { getAppBaseUrl, getDeviceUrl } from '../services/appUrl';
import { LogoTile } from './Logo';
import DepartmentPicker from './DepartmentPicker';
import ConfirmDialog from './ConfirmDialog';
import {
  Activity, Box, QrCode, Trash2, X, Edit2, Plus, BookOpen,
  Info, CheckSquare, Loader2, Check, ChevronDown, Clock,
  ShieldAlert, Cpu, Wrench, CheckCircle2, Fingerprint, Save, ArrowLeft, Camera, RotateCcw, FileText, Upload, DownloadCloud, Eye, Building2, Tag, Layers, Download, Calendar, Printer, Wallet, ShieldCheck, Receipt
} from 'lucide-react';
const LazyQRCode = React.lazy(() => import('qrcode.react').then(m => ({ default: m.QRCodeCanvas })));
const CameraDocCapture = React.lazy(() => import('./CameraDocCapture'));
const FileViewer = React.lazy(() => import('./FileViewer'));

interface DeviceDetailProps {
  device: MedicalDevice;
  tasks: MedicalTask[];
  allDevices?: MedicalDevice[]; // To get fleet-wide depts
  onUpdate: (updatedDevice: MedicalDevice | MedicalDevice[]) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  onAddTask: (task: MedicalTask) => void;
  isStandalone?: boolean;
  invoices?: Invoice[];
  auditEntries?: AuditEntry[];
  canDelete?: boolean;
}

const DeviceDetail: React.FC<DeviceDetailProps> = ({ device, tasks, allDevices = [], onUpdate, onDelete, onBack, onAddTask, isStandalone = false, invoices = [], auditEntries = [], canDelete = true }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'maintenance' | 'docs' | 'tasks' | 'qr' | 'audit'>('overview');
  const [tagInput, setTagInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [pendingFileDelete, setPendingFileDelete] = useState<DeviceFile | null>(null);
  const [isRemovingFile, setIsRemovingFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<DeviceFile['type']>('report');
  const [showDocCapture, setShowDocCapture] = useState(false);
  const [viewingFile, setViewingFile] = useState<DeviceFile | null>(null);
  /** Fisierul pentru care se aleg celelalte aparate, si alegerea de acum. */
  const [deLegat, setDeLegat] = useState<DeviceFile | null>(null);
  const [aleseIds, setAleseIds] = useState<string[]>([]);
  const [cautaAparat, setCautaAparat] = useState('');
  const [seLeaga, setSeLeaga] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    name: device.name,
    category: device.category,
    manufacturer: device.manufacturer,
    model: device.model,
    serialNumber: device.serialNumber,
    department: device.department,
    status: device.status,
    isCNCAN: !!device.isCNCAN,
    cncanExpiry: device.cncanExpiry || '',
    warrantyExpiration: device.warrantyExpiration || '',
    metrologyRequired: !!device.metrologyRequired,
    metrologyCertificate: device.metrologyCertificate || '',
    metrologyDate: device.metrologyDate || '',
    metrologyExpiry: device.metrologyExpiry || '',
    metrologyLab: device.metrologyLab || '',
    notes: device.notes || '',
    image: device.image || '',
    files: device.files || [],
    purchaseDate: device.purchaseDate,
    nextMaintenanceDate: device.nextMaintenanceDate,
    tags: device.tags || []
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
        cncanExpiry: device.cncanExpiry || '',
        warrantyExpiration: device.warrantyExpiration || '',
        metrologyRequired: !!device.metrologyRequired,
        metrologyCertificate: device.metrologyCertificate || '',
        metrologyDate: device.metrologyDate || '',
        metrologyExpiry: device.metrologyExpiry || '',
        metrologyLab: device.metrologyLab || '',
        notes: device.notes || '',
        image: device.image || '',
        files: device.files || [],
        purchaseDate: device.purchaseDate,
        nextMaintenanceDate: device.nextMaintenanceDate,
        tags: device.tags || []
      });
    }
  }, [device, isEditing]);

  const allAvailableDepartments = useMemo(() => {
    return getUniqueDepartments(allDevices);
  }, [allDevices]);

  const deviceCountByDepartment = useMemo(() => {
    const counts: Record<string, number> = {};
    (allDevices || []).forEach(d => {
      const key = (d.department || '').trim();
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
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

  /**
   * Deschide alegerea aparatelor pentru un document.
   *
   * Un fisier care sta doar in randul aparatului (fara cale in stocare) se urca
   * intai o data — altfel legarea l-ar copia in fiecare rand, adica exact
   * risipa pe care o evitam.
   */
  const deschideLegarea = useCallback(async (fisier: DeviceFile) => {
    let f = fisier;
    if (!f.path && f.url?.startsWith('data:')) {
      setSeLeaga(true);
      const urcat = await uploadDataUrl(buildPath('devices', device.id, f.id, f.name), f.url);
      setSeLeaga(false);
      if (!urcat.path) {
        setUploadError('Documentul trebuie urcat in cloud inainte de a fi pus si pe alte aparate. Incearca din nou cand ai semnal.');
        return;
      }
      f = { ...f, path: urcat.path, url: undefined };
      const files = (editForm.files || []).map(x => x.id === f.id ? f : x);
      setEditForm(prev => ({ ...prev, files }));
      await onUpdate({ ...device, ...editForm, files });
    }
    setDeLegat(f);
    setAleseIds(undeMaiEste(f, allDevices, device.id).map(d => d.id));
    setCautaAparat('');
  }, [device, editForm, onUpdate, allDevices]);

  const salveazaLegarea = useCallback(async () => {
    if (!deLegat) return;
    setSeLeaga(true);
    const schimbate = leagaFisierul(deLegat, allDevices, device.id, aleseIds);
    if (schimbate.length) await onUpdate(schimbate);
    setSeLeaga(false);
    setDeLegat(null);
    setSaveNotice(schimbate.length
      ? `Documentul se vede acum pe ${aleseIds.length + 1} aparate`
      : 'Nimic de schimbat');
    setTimeout(() => setSaveNotice(null), 4000);
  }, [deLegat, allDevices, device.id, aleseIds, onUpdate]);

  const handleEditChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as any;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setEditForm(prev => ({ ...prev, [name]: val }));
  }, []);

  // Save a camera-scanned multi-page PDF into this device's files
  const handleScannedDoc = useCallback(async (pdfDataUrl: string, pageCount: number) => {
    const id = `FILE-${Date.now()}`;
    const name = `Scan_${device.serialNumber || device.id}_${new Date().toISOString().split('T')[0]}${pageCount > 1 ? `_${pageCount}pag` : ''}.pdf`;

    setIsUploading(true);
    const { path, error } = await uploadDataUrl(buildPath('devices', device.id, id, name), pdfDataUrl);
    setIsUploading(false);

    // Falling back to the inline copy keeps a scan that would otherwise be lost
    // when the phone drops signal mid-upload. Settings can move it later.
    if (error) setUploadError(`Documentul a ramas doar pe telefon: ${error}`);

    const newFile: DeviceFile = {
      id,
      name,
      type: uploadType,
      ...(path ? { path } : { url: pdfDataUrl }),
      // Marimea se retinea doar la incarcarea din fisier, nu si la scanare —
      // adica tocmai la documentele mari. Fara ea, socoteala spatiului le sare.
      size: Math.round((pdfDataUrl.length - (pdfDataUrl.indexOf(',') + 1)) * 0.75),
      dateAdded: new Date().toISOString().split('T')[0]
    };
    const updatedFiles = [...(editForm.files || []), newFile];
    setEditForm(prev => ({ ...prev, files: updatedFiles }));
    await onUpdate({ ...device, ...editForm, files: updatedFiles });
    setLastSyncTime(new Date().toLocaleTimeString());
  }, [device, editForm, onUpdate, uploadType]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // The old 5MB cap existed because the file was base64-encoded into the
    // device row. It now goes to Storage, so only Storage's own limit applies.
    if (file.size > 50 * 1024 * 1024) {
      setUploadError("Fisier prea mare (max 50MB)");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const id = `FILE-${Date.now()}`;
      const { path, error } = await uploadFile(buildPath('devices', device.id, id, file.name), file);
      if (error) {
        setUploadError(`Incarcarea in cloud a esuat: ${error}`);
        return;
      }

      const newFile: DeviceFile = {
        id,
        name: file.name,
        type: uploadType,
        path,
        size: file.size,
        dateAdded: new Date().toISOString().split('T')[0]
      };

      const updatedFiles = [...(editForm.files || []), newFile];
      setEditForm(prev => ({ ...prev, files: updatedFiles }));
      await onUpdate({ ...device, ...editForm, files: updatedFiles });
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("File upload failed", err);
      setUploadError("Incarcarea a esuat");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [device, editForm, onUpdate, uploadType]);

  // Removing a document deletes it from cloud storage too — there is no copy
  // left to restore from, so this one has to be asked before, not regretted
  // after. A scanned service report is often the only record of the visit.
  const handleRemoveFile = useCallback(async (fileId: string) => {
    const target = editForm.files.find(f => f.id === fileId);
    setIsRemovingFile(true);
    try {
      // Acelasi raport poate fi legat de mai multe aparate. Sters din stocare
      // cat timp altcineva il mai arata, celelalte ar ramane cu o trimitere
      // spre un fisier care nu mai exista — si s-ar afla abia la deschidere.
      if (target?.path && !maiEFolosit(target, allDevices, device.id, fileId)) {
        await removeFile(target.path);
      }
      const updatedFiles = editForm.files.filter(f => f.id !== fileId);
      setEditForm(prev => ({ ...prev, files: updatedFiles }));
      // Always save changes immediately
      await onUpdate({ ...device, ...editForm, files: updatedFiles });
    } finally {
      setIsRemovingFile(false);
      setPendingFileDelete(null);
    }
  }, [device, editForm, onUpdate]);

  // Opens the built-in viewer instead of a new browser tab, so the user can
  // close it and land straight back in the app (and popup blockers can't interfere).
  const viewFile = useCallback((file: DeviceFile) => {
    setViewingFile(file);
  }, []);

  const downloadFile = useCallback(async (file: DeviceFile) => {
    setSaveNotice(null);
    const source = await resolveSource(file);
    if (source.error) { setUploadError(source.error); return; }
    const outcome = await saveFileAs(file.name, source.blob || source.dataUrl!);
    if (outcome === 'failed') {
      setUploadError('Descarcarea a esuat');
    } else if (outcome !== 'cancelled') {
      setSaveNotice(outcome === 'saved' ? `"${file.name}" a fost salvat.` : `"${file.name}" a fost descarcat.`);
      setTimeout(() => setSaveNotice(null), 4000);
    }
  }, []);

  return (
    <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-xl sm:shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-full relative animate-fade-in">
      <ConfirmDialog
        open={showPurgeConfirm}
        busy={isPurging}
        title="Confirmare stergere"
        icon={<Trash2 className="w-8 h-8 sm:w-10 sm:h-10" />}
        body={<>
          Se sterge definitiv <span className="font-black text-slate-900">{device.name}</span> si
          tot istoricul de service asociat.
        </>}
        onCancel={() => setShowPurgeConfirm(false)}
        onConfirm={handleFinalPurge}
      />

      <ConfirmDialog
        open={!!pendingFileDelete}
        busy={isRemovingFile}
        title="Stergi documentul?"
        icon={<Trash2 className="w-8 h-8 sm:w-10 sm:h-10" />}
        body={<>
          <span className="font-black text-slate-900">{pendingFileDelete?.name}</span>
          {pendingFileDelete && undeMaiEste(pendingFileDelete, allDevices, device.id).length > 0
            ? <> se scoate doar de pe acest aparat. Ramane pe celelalte{' '}
                {undeMaiEste(pendingFileDelete, allDevices, device.id).length}, si nu se sterge din cloud.</>
            : <> se sterge si din cloud. Nu mai exista nicio copie de unde sa fie recuperat.</>}
        </>}
        confirmLabel="Sterge documentul"
        onCancel={() => setPendingFileDelete(null)}
        onConfirm={() => { if (pendingFileDelete) handleRemoveFile(pendingFileDelete.id); }}
      />

      {/*
        Un raport de service acopera de multe ori mai multe aparate deodata.
        Aici se aleg, si documentul se leaga de fiecare — tinut o singura data
        in stocare, nu copiat de cinci ori.
      */}
      {deLegat && (
        <div className="fixed inset-0 z-[640] scrim flex items-center justify-center p-0 sm:p-6">
          <div className="bg-white w-full max-w-xl h-[100dvh] sm:h-auto sm:max-h-[88dvh] flex flex-col rounded-none sm:rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Si pe alte aparate</h3>
              <p className="text-[12px] font-semibold text-slate-500 mt-1 leading-relaxed">
                <span className="font-black text-slate-700">{deLegat.name}</span> se va vedea pe fiecare
                aparat bifat. Documentul se tine o singura data — bifarea nu ocupa loc in plus.
              </p>
            </div>
            <div className="px-6 py-3 shrink-0">
              <input value={cautaAparat} onChange={e => setCautaAparat(e.target.value)}
                placeholder="Cauta dupa denumire, serie sau sectie..."
                aria-label="Cauta aparatul"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-xl text-sm font-semibold outline-none" />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 pb-4 space-y-2">
              {allDevices
                .filter(d => d.id !== device.id)
                .filter(d => {
                  const q = cautaAparat.toLowerCase().trim();
                  return !q || `${d.name} ${d.serialNumber} ${d.department} ${d.model}`.toLowerCase().includes(q);
                })
                .slice(0, 200)
                .map(d => {
                  const bifat = aleseIds.includes(d.id);
                  return (
                    <button key={d.id} type="button"
                      onClick={() => setAleseIds(prev => bifat ? prev.filter(x => x !== d.id) : [...prev, d.id])}
                      className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition flex items-center gap-3 ${
                        bifat ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                      }`}>
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                        bifat ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                      }`}>{bifat && <Check className="w-3.5 h-3.5" />}</span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-bold text-slate-900 truncate">{d.name}</span>
                        <span className="block text-[11px] font-bold text-slate-500 truncate">
                          {[d.serialNumber, d.department].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                {aleseIds.length} bifate
              </span>
              <div className="flex gap-2">
                <button onClick={() => setDeLegat(null)}
                  className="px-5 py-3 text-slate-500 font-black text-[11px] uppercase tracking-widest">Renunta</button>
                <button onClick={salveazaLegarea} disabled={seLeaga}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2">
                  {seLeaga && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salveaza
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-8 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 sm:gap-6 bg-white/50 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600 opacity-20" />
        <div className="flex items-start gap-4 sm:gap-6 min-w-0">
          <div className="hidden md:flex flex-col items-center gap-2">
            <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)] ${device.status === DeviceStatus.ACTIVE ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-amber-500 shadow-amber-500/50'} animate-pulse`} />
            <div className="w-px h-12 bg-slate-100" />
          </div>
          <div className="min-w-0 flex-1">
            {!isStandalone && (
              <button
                onClick={onBack}
                className="mb-3 sm:mb-4 inline-flex items-center gap-2 pl-3 pr-4 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[11px] uppercase tracking-widest transition active:scale-95 hover:bg-slate-900 hover:text-white group"
              >
                <ArrowLeft className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
                Inapoi la inventar
              </button>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
               <h1 className="text-lg sm:text-4xl font-black text-slate-900 tracking-tight sm:tracking-tighter uppercase leading-tight break-words min-w-0">{device.name}</h1>
               {/* On phones the status lives here, since the dot column is hidden */}
               <span className={`md:hidden px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                 device.status === DeviceStatus.ACTIVE ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-amber-50 border-amber-100 text-amber-700'
               }`}>{DEVICE_STATUS_RO[device.status] || device.status}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
               <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-900 text-white rounded-lg tech-label text-[10px] max-w-full">
                 <Cpu className="w-3 h-3 shrink-0" /> <span className="truncate">{device.serialNumber}</span>
               </div>
            </div>
            <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-1">
              <span className="tech-label text-slate-500 truncate">MOD: <span className="text-slate-600">{device.model}</span></span>
              <span className="tech-label text-slate-500 truncate">CAT: <span className="text-slate-600">{device.category}</span></span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-stretch lg:items-end gap-3 w-full lg:w-auto z-[100]">
           <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto">
             {!isStandalone && (
               isEditing ? (
                 <>
                   <button onClick={handleSaveEdit} className="flex-1 lg:flex-none min-w-0 flex items-center justify-center gap-2 px-3 sm:px-8 py-3.5 bg-blue-600 text-white rounded-xl shadow-lg font-black text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest active:scale-95 transition hover:bg-blue-700"><Save className="w-4 h-4 shrink-0" /> Salveaza</button>
                   <button onClick={() => setIsEditing(false)} className="flex-1 lg:flex-none min-w-0 flex items-center justify-center gap-2 px-3 sm:px-8 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest active:scale-95 transition hover:bg-slate-200">Anuleaza</button>
                 </>
               ) : (
                 <>
                   <button onClick={() => setIsEditing(true)} className="flex-1 lg:flex-none min-w-0 flex items-center justify-center gap-2 px-3 sm:px-8 py-3.5 bg-slate-900 text-white rounded-xl shadow-lg font-black text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest active:scale-95 transition hover:bg-slate-800"><Edit2 className="w-4 h-4 shrink-0" /> Editeaza</button>
                   {canDelete && (
                     <button onClick={() => setShowPurgeConfirm(true)} className="flex-1 lg:flex-none min-w-0 flex items-center justify-center gap-2 px-3 sm:px-8 py-3.5 bg-red-50 text-red-700 border border-red-100 rounded-xl font-black text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest hover:bg-red-600 hover:text-white transition active:scale-95"><Trash2 className="w-4 h-4 shrink-0" /> Sterge</button>
                   )}
                 </>
               )
             )}
           </div>
           {lastSyncTime && <span className="tech-label text-[10px] text-emerald-500">Ultima sincronizare: {lastSyncTime}</span>}
        </div>
      </div>

      {/* Phones get a 3x2 grid so every tab is reachable without horizontal scrolling */}
      <div className="grid grid-cols-3 sm:flex border-b border-slate-100 px-1 sm:px-8 bg-white sm:overflow-x-auto no-scrollbar shadow-sm z-10">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity className="w-4 h-4" />} label="Detalii Tehnice" shortLabel="Detalii" />
        <TabButton active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} icon={<Wrench className="w-4 h-4" />} label="Istoric Service" shortLabel="Service" />
        <TabButton active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} icon={<FileText className="w-4 h-4" />} label="Arhiva & Documente" shortLabel="Documente" />
        <TabButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={<CheckSquare className="w-4 h-4" />} label="Operatiuni" shortLabel="Sarcini" />
        <TabButton active={activeTab === 'qr'} onClick={() => setActiveTab('qr')} icon={<QrCode className="w-4 h-4" />} label="Identitate" shortLabel="Cod QR" />
        <TabButton active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={<Clock className="w-4 h-4" />} label="Istoric" shortLabel="Istoric" />
      </div>

      <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-50/30 custom-scrollbar">
        {activeTab === 'overview' && (
           <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-8 max-w-7xl mx-auto">
              <div className="xl:col-span-8 space-y-5 sm:space-y-8 animate-slide-up">
                <div className="hardware-card p-4 sm:p-10 rounded-3xl sm:rounded-[2.5rem] space-y-6 sm:space-y-8">
                   <div className="flex items-center gap-3 sm:gap-4 mb-2">
                      <div className="p-2.5 sm:p-3 bg-blue-50 text-blue-600 rounded-xl sm:rounded-2xl shadow-sm shrink-0"><Info className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                      <h3 className="text-base sm:text-xl font-black uppercase tracking-tight text-slate-900">Fisa Dispozitivului</h3>
                   </div>
                   
                   {isEditing ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-1">
                           <label className="tech-label ml-1">Denumire dispozitiv</label>
                           <input name="name" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={editForm.name} onChange={handleEditChange} />
                        </div>
                        <div className="space-y-1">
                           <label className="tech-label ml-1">Numar serie</label>
                           <input name="serialNumber" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={editForm.serialNumber} onChange={handleEditChange} />
                        </div>
                        <div className="space-y-1">
                           <label className="tech-label ml-1">Categorie</label>
                           <div className="relative">
                              <select name="category" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none appearance-none focus:border-blue-500 transition-colors" value={editForm.category} onChange={handleEditChange}>
                                {DEVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <Layers className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                           </div>
                        </div>
                        <div className="space-y-1">
                           <label className="tech-label ml-1">Producator</label>
                           <input name="manufacturer" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={editForm.manufacturer} onChange={handleEditChange} />
                        </div>
                        <div className="space-y-1">
                           <label className="tech-label ml-1">Model</label>
                           <input name="model" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={editForm.model} onChange={handleEditChange} />
                        </div>
                        <DepartmentPicker
                           value={editForm.department}
                           onChange={(v) => setEditForm(prev => ({ ...prev, department: v }))}
                           options={allAvailableDepartments}
                           counts={deviceCountByDepartment}
                           label="Departament"
                        />
                        <div className="space-y-1 md:col-span-2">
                           <label className="tech-label ml-1">Status</label>
                           <select name="status" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={editForm.status} onChange={handleEditChange}>
                              {Object.values(DeviceStatus).map(s => <option key={s} value={s}>{DEVICE_STATUS_RO[s]}</option>)}
                           </select>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                           <label className="tech-label ml-1">Etichete (Tags)</label>
                           <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                              {editForm.tags.map(tag => (
                                <span key={tag} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest">
                                  {tag}
                                  <button type="button" onClick={() => setEditForm(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }))} className="hover:text-red-200 transition"><X className="w-3 h-3" /></button>
                                </span>
                              ))}
                              <input
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => {
                                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                                    e.preventDefault();
                                    const t = tagInput.trim().toLowerCase();
                                    if (!editForm.tags.includes(t)) setEditForm(p => ({ ...p, tags: [...p.tags, t] }));
                                    setTagInput('');
                                  }
                                }}
                                placeholder={editForm.tags.length === 0 ? 'ex. critic, garantie, backup... (Enter pentru adaugare)' : '+ adauga'}
                                className="flex-1 min-w-[140px] bg-transparent text-xs font-bold outline-none placeholder:text-slate-500"
                              />
                           </div>
                        </div>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 xl:gap-x-12 gap-y-4 sm:gap-y-6">
                        <InfoRow label="Numar serie" value={device.serialNumber} badge />
                        <InfoRow label="Model" value={device.model} />
                        <InfoRow label="Departament" value={device.department} />
                        <InfoRow label="Categorie" value={device.category} />
                        <InfoRow label="Producator" value={device.manufacturer} />
                        <InfoRow label="Status" value={DEVICE_STATUS_RO[device.status] || device.status} />
                        <InfoRow label="Urmatoarea mentenanta" value={device.nextMaintenanceDate || 'Neprogramata'} badge />
                        {(device.tags || []).length > 0 && (
                          <div className="md:col-span-2 space-y-2">
                            <span className="tech-label">Etichete</span>
                            <div className="flex flex-wrap gap-2">
                              {(device.tags || []).map(tag => (
                                <span key={tag} className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                  <Tag className="w-3 h-3" />{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                     </div>
                   )}
                   
                   {/*
                     Termenele care nu se negociaza. Buletinul metrologic expirat
                     scoate aparatul din uz oricat de bine ar functiona, iar
                     garantia expirata inseamna o reparatie platita degeaba.
                     Stateau pana acum nicaieri, sau intr-o nota scrisa de mana.
                   */}
                   <div className="pt-6 sm:pt-8 border-t border-slate-100 space-y-4">
                      <label className="tech-label block">Termene si conformitate</label>
                      {isEditing ? (
                        <div className="space-y-5">
                          <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                            <label className="flex items-start gap-3 cursor-pointer">
                              <input type="checkbox" name="metrologyRequired" checked={editForm.metrologyRequired}
                                onChange={handleEditChange} className="mt-0.5 w-5 h-5 accent-blue-600 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[13px] font-black text-slate-900">Supus controlului metrologic legal</p>
                                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                                  Aparatul masoara, deci are buletin de verificare periodica.
                                </p>
                              </div>
                            </label>
                            {editForm.metrologyRequired && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <label className="tech-label ml-1">Nr. buletin</label>
                                  <input name="metrologyCertificate" value={editForm.metrologyCertificate}
                                    onChange={handleEditChange} placeholder="ex. 1234/2026"
                                    aria-label="Numarul buletinului metrologic" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="tech-label ml-1">Laborator</label>
                                  <input name="metrologyLab" value={editForm.metrologyLab}
                                    onChange={handleEditChange} placeholder="ex. BRML Brasov"
                                    aria-label="Laboratorul de metrologie" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="tech-label ml-1">Data verificarii</label>
                                  <input type="date" name="metrologyDate" value={editForm.metrologyDate}
                                    onChange={e => {
                                      const d = e.target.value;
                                      // Valabilitatea se propune la un an, cat e de obicei;
                                      // ramane de schimbat cand laboratorul scrie altceva.
                                      setEditForm(p => ({ ...p, metrologyDate: d,
                                        metrologyExpiry: p.metrologyExpiry || valabilitatePropusa(d) }));
                                    }}
                                    aria-label="Data verificarii metrologice" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="tech-label ml-1">Valabil pana la</label>
                                  <input type="date" name="metrologyExpiry" value={editForm.metrologyExpiry}
                                    onChange={handleEditChange}
                                    aria-label="Buletinul metrologic e valabil pana la" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="tech-label ml-1">Garantia expira</label>
                              <input type="date" name="warrantyExpiration" value={editForm.warrantyExpiration}
                                onChange={handleEditChange} aria-label="Data expirarii garantiei" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="tech-label ml-1">Autorizatia CNCAN expira</label>
                              <input type="date" name="cncanExpiry" value={editForm.cncanExpiry}
                                onChange={handleEditChange} disabled={!editForm.isCNCAN}
                                title={editForm.isCNCAN ? '' : 'Se completeaza doar la aparatele sub incidenta CNCAN'}
                                aria-label="Data expirarii autorizatiei CNCAN"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors disabled:opacity-40" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <TermenRow eticheta="Buletin metrologic"
                            data={device.metrologyRequired ? device.metrologyExpiry : undefined}
                            gol={device.metrologyRequired ? 'Netrecut — aparatul e supus controlului metrologic' : 'Nu e supus controlului metrologic'}
                            greuCandLipseste={!!device.metrologyRequired}
                            detaliu={[device.metrologyCertificate, device.metrologyLab].filter(Boolean).join(' · ')} />
                          <TermenRow eticheta="Garantie" data={device.warrantyExpiration} gol="Netrecuta" />
                          {device.isCNCAN && (
                            <TermenRow eticheta="Autorizatie CNCAN" data={device.cncanExpiry} gol="Netrecuta" greuCandLipseste />
                          )}
                          <TermenRow eticheta="Urmatoarea mentenanta" data={device.nextMaintenanceDate} gol="Neprogramata" />
                        </div>
                      )}
                   </div>

                   <div className="pt-6 sm:pt-8 border-t border-slate-100">
                      <label className="tech-label block mb-3">Note tehnice</label>
                      {isEditing ? (
                        <textarea name="notes" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium min-h-[100px] outline-none focus:border-blue-500 transition-colors" value={editForm.notes} onChange={handleEditChange} />
                      ) : (
                        <p className="text-sm text-slate-600 font-medium leading-relaxed bg-slate-50/50 p-4 sm:p-6 rounded-2xl border border-slate-100 italic">
                          {device.notes || 'Nicio observatie inregistrata.'}
                        </p>
                      )}
                   </div>
                </div>
              </div>

              <div className="xl:col-span-4 space-y-5 sm:space-y-8">
                {/* A full-width square eats a whole phone screen — keep it short on mobile */}
                <div className="hardware-card p-4 sm:p-8 rounded-3xl sm:rounded-[2.5rem] overflow-hidden group">
                   <div className="h-44 sm:h-auto sm:aspect-square bg-white rounded-2xl sm:rounded-3xl border border-slate-100 flex items-center justify-center overflow-hidden relative shadow-inner">
                      {device.image ? <img src={device.image} alt="Visual" className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" /> : <Box className="w-12 h-12 sm:w-16 sm:h-16 text-slate-200 opacity-50" />}
                   </div>
                </div>

                {/* Cost of ownership */}
                <DeviceCostCard device={device} invoices={invoices} />
              </div>
           </div>
        )}

        {activeTab === 'docs' && (
          <div className="max-w-6xl mx-auto py-2 sm:py-6 space-y-5 sm:space-y-8 animate-slide-up">
             <div className="hardware-card p-4 sm:p-10 rounded-3xl sm:rounded-[2.5rem] flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-5 sm:gap-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-600/20" />
                <div className="flex items-center gap-4 sm:gap-6">
                   <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-xl">
                      <BookOpen className="w-6 h-6 sm:w-8 sm:h-8" />
                   </div>
                   <div>
                      <h3 className="text-lg sm:text-2xl font-black text-slate-900 uppercase tracking-tight">Arhiva Tehnica</h3>
                      <p className="tech-label mt-1">Documentatie si manuale centralizate</p>
                   </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full lg:w-auto">
                   <div className="flex flex-col gap-1 w-full sm:w-auto">
                      <label className="tech-label ml-1 mb-1">Tip Document</label>
                      <select 
                         className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 tech-label outline-none cursor-pointer focus:border-blue-500 transition-all shadow-sm sm:min-w-[180px]"
                         value={uploadType}
                         onChange={(e) => setUploadType(e.target.value as any)}
                      >
                         <option value="report">Raport Service</option>
                         <option value="manual">Manual Tehnic</option>
                         <option value="service">Document Service</option>
                         <option value="achizitie">Document Achizitie</option>
                         <option value="other">Alt Document</option>
                      </select>
                   </div>
                   <div className="flex flex-col gap-1 w-full sm:w-auto">
                      <label className="tech-label ml-1 mb-1 opacity-0">Actiune</label>
                      <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2">
                        <button
                           onClick={() => fileInputRef.current?.click()}
                           disabled={isUploading}
                           className="w-full sm:w-auto px-4 sm:px-8 py-3.5 bg-blue-600 text-white rounded-xl font-black text-[10px] sm:text-[11px] uppercase tracking-widest sm:tracking-[0.2em] flex items-center justify-center gap-2 sm:gap-3 hover:bg-blue-700 transition shadow-xl shadow-blue-600/20 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                        >
                           {isUploading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Upload className="w-4 h-4 shrink-0" />}
                           <span className="truncate">{isUploading ? "Se proceseaza" : "Incarca"}</span>
                           <span className="hidden sm:inline">{isUploading ? "..." : "Document"}</span>
                        </button>
                        <button
                           onClick={() => setShowDocCapture(true)}
                           disabled={isUploading}
                           className="w-full sm:w-auto px-4 sm:px-8 py-3.5 bg-slate-900 text-white rounded-xl font-black text-[10px] sm:text-[11px] uppercase tracking-widest sm:tracking-[0.2em] flex items-center justify-center gap-2 sm:gap-3 hover:bg-emerald-600 transition shadow-xl active:scale-95 disabled:opacity-50 whitespace-nowrap"
                           title="Scaneaza documentul cu camera — paginile se combina intr-un PDF"
                        >
                           <Camera className="w-4 h-4 shrink-0" />
                           Scaneaza
                        </button>
                      </div>
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

             {saveNotice && (
               <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 animate-fade-in">
                 <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                 <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">{saveNotice}</span>
               </div>
             )}

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-12">
                {/* Technical Manuals Section */}
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-center justify-between px-2">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-6 bg-blue-600 rounded-full" />
                        <h4 className="tech-label text-slate-900">Manuale Tehnice</h4>
                     </div>
                     <span className="tech-label text-slate-500">{(editForm.files || []).filter(f => f.type === 'manual').length} fisiere</span>
                  </div>
                  
                  <div className="space-y-3 sm:space-y-4">
                     {editForm.files.filter(f => f.type === 'manual').length > 0 ? (
                       editForm.files.filter(f => f.type === 'manual').map(file => (
                         <FileCard key={file.id} file={file} onView={() => viewFile(file)} onDownload={() => downloadFile(file)} onDelete={() => setPendingFileDelete(file)} onLink={() => deschideLegarea(file)} alteAparate={undeMaiEste(file, allDevices, device.id)} />
                       ))
                     ) : (
                       <div className="py-8 sm:py-12 hardware-card rounded-3xl sm:rounded-[2rem] border-dashed border-slate-200 flex flex-col items-center justify-center opacity-50">
                          <BookOpen className="w-10 h-10 text-slate-500 mb-3" />
                          <p className="tech-label">Niciun manual</p>
                       </div>
                     )}
                  </div>
                </div>

                {/* Service Reports Section */}
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-center justify-between px-2">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                        <h4 className="tech-label text-slate-900">Rapoarte Service</h4>
                     </div>
                     <span className="tech-label text-slate-500">{(editForm.files || []).filter(f => f.type === 'report').length} fisiere</span>
                  </div>
                  
                  <div className="space-y-3 sm:space-y-4">
                     {editForm.files.filter(f => f.type === 'report').length > 0 ? (
                       editForm.files.filter(f => f.type === 'report').map(file => (
                         <FileCard key={file.id} file={file} color="emerald" onView={() => viewFile(file)} onDownload={() => downloadFile(file)} onDelete={() => setPendingFileDelete(file)} onLink={() => deschideLegarea(file)} alteAparate={undeMaiEste(file, allDevices, device.id)} />
                       ))
                     ) : (
                       <div className="py-8 sm:py-12 hardware-card rounded-3xl sm:rounded-[2rem] border-dashed border-slate-200 flex flex-col items-center justify-center opacity-50">
                          <FileText className="w-10 h-10 text-slate-500 mb-3" />
                          <p className="tech-label">Niciun raport</p>
                       </div>
                     )}
                  </div>
                </div>

                {/* Service Documents Section */}
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-center justify-between px-2">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-6 bg-amber-500 rounded-full" />
                        <h4 className="tech-label text-slate-900">Documente Service</h4>
                     </div>
                     <span className="tech-label text-slate-500">{(editForm.files || []).filter(f => f.type === 'service').length} fisiere</span>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                     {editForm.files.filter(f => f.type === 'service').length > 0 ? (
                       editForm.files.filter(f => f.type === 'service').map(file => (
                         <FileCard key={file.id} file={file} onView={() => viewFile(file)} onDownload={() => downloadFile(file)} onDelete={() => setPendingFileDelete(file)} onLink={() => deschideLegarea(file)} alteAparate={undeMaiEste(file, allDevices, device.id)} />
                       ))
                     ) : (
                       <div className="py-8 sm:py-12 hardware-card rounded-3xl sm:rounded-[2rem] border-dashed border-slate-200 flex flex-col items-center justify-center opacity-50">
                          <Wrench className="w-10 h-10 text-slate-500 mb-3" />
                          <p className="tech-label">Niciun document de service</p>
                       </div>
                     )}
                  </div>
                </div>

                {/* Acquisition Documents Section */}
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-center justify-between px-2">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-6 bg-indigo-500 rounded-full" />
                        <h4 className="tech-label text-slate-900">Documente Achizitie</h4>
                     </div>
                     <span className="tech-label text-slate-500">{(editForm.files || []).filter(f => f.type === 'achizitie').length} fisiere</span>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                     {editForm.files.filter(f => f.type === 'achizitie').length > 0 ? (
                       editForm.files.filter(f => f.type === 'achizitie').map(file => (
                         <FileCard key={file.id} file={file} onView={() => viewFile(file)} onDownload={() => downloadFile(file)} onDelete={() => setPendingFileDelete(file)} onLink={() => deschideLegarea(file)} alteAparate={undeMaiEste(file, allDevices, device.id)} />
                       ))
                     ) : (
                       <div className="py-8 sm:py-12 hardware-card rounded-3xl sm:rounded-[2rem] border-dashed border-slate-200 flex flex-col items-center justify-center opacity-50">
                          <Box className="w-10 h-10 text-slate-500 mb-3" />
                          <p className="tech-label">Niciun document de achizitie</p>
                       </div>
                     )}
                  </div>
                </div>

                {/* Other documents (image/other) — only shown when present */}
                {editForm.files.filter(f => f.type === 'image' || f.type === 'other').length > 0 && (
                  <div className="space-y-6 lg:col-span-2">
                    <div className="flex items-center justify-between px-2">
                       <div className="flex items-center gap-3">
                          <div className="w-2 h-6 bg-slate-400 rounded-full" />
                          <h4 className="tech-label text-slate-900">Alte Documente</h4>
                       </div>
                       <span className="tech-label text-slate-500">{editForm.files.filter(f => f.type === 'image' || f.type === 'other').length} fisiere</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                       {editForm.files.filter(f => f.type === 'image' || f.type === 'other').map(file => (
                         <FileCard key={file.id} file={file} onView={() => viewFile(file)} onDownload={() => downloadFile(file)} onDelete={() => setPendingFileDelete(file)} onLink={() => deschideLegarea(file)} alteAparate={undeMaiEste(file, allDevices, device.id)} />
                       ))}
                    </div>
                  </div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="max-w-5xl mx-auto py-2 sm:py-6 space-y-5 sm:space-y-8 animate-fade-in">
             <div className="hardware-card p-4 sm:p-10 rounded-3xl sm:rounded-[2.5rem] flex flex-col md:flex-row justify-between items-stretch md:items-center gap-5 sm:gap-8">
                <div className="flex items-center gap-4 sm:gap-6">
                   <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
                      <CheckSquare className="w-6 h-6 sm:w-8 sm:h-8" />
                   </div>
                   <div className="min-w-0">
                      <h3 className="text-lg sm:text-2xl font-black text-slate-900 uppercase tracking-tight">Urmarire Operatiuni</h3>
                      <p className="tech-label mt-1">Sarcini active de mentenanta si operare</p>
                   </div>
                </div>
                <button 
                   onClick={() => {
                     const newTask: MedicalTask = {
                       id: `TASK-${Date.now()}`,
                       title: `Mentenanta pentru ${device.name}`,
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
                   className="w-full md:w-auto shrink-0 px-6 sm:px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-600 transition shadow-xl active:scale-95"
                >
                   <Plus className="w-5 h-5" /> Adauga Sarcina
                </button>
             </div>

             <div className="grid grid-cols-1 gap-4">
                {tasks.length > 0 ? tasks.map(task => (
                  <div key={task.id} className="hardware-card p-4 sm:p-6 rounded-3xl sm:rounded-[2rem] flex flex-col md:flex-row items-start md:items-center gap-4 sm:gap-6 hover:shadow-xl transition-all group">
                     <div className={`w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center shadow-sm ${
                        task.status === TaskStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600' : 
                        task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                     }`}>
                        {task.status === TaskStatus.COMPLETED ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                     </div>
                     <div className="flex-1 min-w-0 text-left">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                           <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                              task.status === TaskStatus.COMPLETED ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                              task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                           }`}>
                              {TASK_STATUS_RO[task.status] || task.status}
                           </span>
                           <span className="text-[10px] font-mono font-bold text-slate-500">ID: {task.id.slice(0,8)}</span>
                           <span className="text-[10px] font-mono font-bold text-slate-500">Termen: {task.createdAt}</span>
                        </div>
                        <h4 className="text-base font-black text-slate-900 group-hover:text-blue-600 transition-colors">{task.title}</h4>
                        <p className="text-sm text-slate-500 mt-1 line-clamp-1 font-medium">{task.description || 'Fara descriere.'}</p>
                     </div>
                      <div className="hidden md:flex items-center gap-4">
                        <span className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border ${
                          task.status === TaskStatus.PENDING ? 'border-slate-200 text-slate-500 bg-white' : 
                          task.status === TaskStatus.IN_PROGRESS ? 'border-blue-200 text-blue-600 bg-blue-50/50' : 
                          'border-green-200 text-green-600 bg-green-50/50'
                        }`}>
                          {TASK_STATUS_RO[task.status] || task.status}
                        </span>
                      </div>
                  </div>
                )) : (
                  <div className="py-12 sm:py-20 text-center bg-slate-50/50 rounded-3xl sm:rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center">
                     <CheckSquare className="w-12 h-12 sm:w-16 sm:h-16 text-slate-100 mb-4" />
                     <p className="tech-label">Nicio operatiune activa</p>
                  </div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="max-w-5xl mx-auto py-2 sm:py-6 space-y-5 sm:space-y-8 animate-slide-up">
             <div className="hardware-card p-4 sm:p-10 rounded-3xl sm:rounded-[2.5rem] flex flex-col md:flex-row justify-between items-stretch md:items-center gap-5 sm:gap-8">
                <div className="flex items-center gap-4 sm:gap-6">
                   <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
                      <Wrench className="w-6 h-6 sm:w-8 sm:h-8" />
                   </div>
                   <div className="min-w-0">
                      <h3 className="text-lg sm:text-2xl font-black text-slate-900 uppercase tracking-tight">Istoric Service</h3>
                      <p className="tech-label mt-1">Jurnal interventii tehnice</p>
                   </div>
                </div>
                <button 
                   onClick={() => {
                     const newRecord: MaintenanceRecord = {
                       id: `MT-${Math.floor(Math.random() * 90000)}`,
                       date: new Date().toISOString().split('T')[0],
                       type: MaintenanceType.PREVENTIVE,
                       technician: 'Tehnician desemnat',
                       description: 'Mentenanta preventiva standard si verificare calibrare.',
                       completed: true
                     };
                     const updatedDevice = {
                       ...device,
                       maintenanceHistory: [newRecord, ...(device.maintenanceHistory || [])],
                       nextMaintenanceDate: calculateNextMaintenanceDate(newRecord.date, device.category)
                     };
                     onUpdate(updatedDevice);
                   }}
                   className="w-full md:w-auto shrink-0 px-6 sm:px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-600 transition shadow-xl active:scale-95"
                >
                   <Plus className="w-5 h-5" /> Adauga Interventie
                </button>
             </div>

             <div className="space-y-4 sm:space-y-6">
                {(device.maintenanceHistory || []).length > 0 ? device.maintenanceHistory.map(record => (
                  <div key={record.id} className="hardware-card p-4 sm:p-8 rounded-3xl sm:rounded-[2.5rem] space-y-4 sm:space-y-6 hover:shadow-xl transition-all group">
                     <div className="flex flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                           <div className="p-2.5 sm:p-3 shrink-0 bg-slate-50 text-slate-600 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                              <Calendar className="w-5 h-5" />
                           </div>
                           <div className="min-w-0">
                              <h4 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">{MAINTENANCE_TYPE_RO[record.type] || record.type}</h4>
                              <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">EFECTUAT LA: {record.date} DE {record.technician}</p>
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
                     <div className="bg-slate-50/50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                        <p className="text-sm text-slate-600 font-medium leading-relaxed italic">"{record.description}"</p>
                     </div>
                  </div>
                )) : (
                  <div className="py-12 sm:py-20 text-center bg-slate-50/50 rounded-3xl sm:rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center">
                     <Wrench className="w-12 h-12 sm:w-16 sm:h-16 text-slate-100 mb-4" />
                     <p className="tech-label">Niciun istoric de service inregistrat</p>
                  </div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'qr' && (
          <div className="max-w-xl mx-auto py-2 sm:py-12 animate-slide-up">
             <div className="hardware-card p-4 sm:p-12 rounded-3xl sm:rounded-[3rem] text-center space-y-6 sm:space-y-10">
                <div className="space-y-2">
                   <h3 className="text-lg sm:text-2xl font-black text-slate-900 uppercase tracking-tight">Identitate Dispozitiv</h3>
                   <p className="tech-label">Identificare unica QR</p>
                </div>
                
                <div className="bg-white p-3 sm:p-10 rounded-3xl sm:rounded-[2.5rem] shadow-inner border border-slate-100 inline-block mx-auto relative group max-w-full [&_canvas]:max-w-full [&_canvas]:h-auto">
                   <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl sm:rounded-[2.5rem]" />
                   <React.Suspense fallback={<div className="w-60 h-60 max-w-full animate-pulse bg-slate-100 rounded-2xl" />}>
                     <LazyQRCode
                        id="device-qr-code"
                        value={getDeviceUrl(device.id)}
                        size={240}
                        level="H"
                        includeMargin={true}
                        imageSettings={{ src: "https://picsum.photos/seed/med/64/64", x: undefined, y: undefined, height: 40, width: 40, excavate: true }}
                     />
                   </React.Suspense>
                </div>

                <div className="space-y-5 sm:space-y-6">
                   <div className="flex flex-col items-center gap-2">
                      <span className="tech-label">Identificator dispozitiv</span>
                      <code className="px-4 sm:px-6 py-2 bg-slate-900 text-white rounded-xl font-mono text-xs sm:text-sm shadow-lg max-w-full break-all">{device.id}</code>
                   </div>
                   
                   <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
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
                        className="flex-1 py-4 sm:py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-600 transition shadow-xl active:scale-95"
                      >
                        <Download className="w-5 h-5" /> Descarca QR
                      </button>
                      <button 
                        onClick={() => window.print()}
                        className="flex-1 py-4 sm:py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-200 transition active:scale-95"
                      >
                        <Printer className="w-5 h-5" /> Printeaza Eticheta
                      </button>
                   </div>
                </div>

                <div className="pt-6 sm:pt-8 border-t border-slate-100">
                   <p className="text-[10px] font-mono font-bold text-slate-500 leading-relaxed uppercase">
                      Scanarea acestui cod ofera acces instant la documentatia tehnica, istoricul de service si statusul operational.
                   </p>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="max-w-4xl mx-auto py-2 sm:py-6 animate-slide-up">
            <div className="hardware-card p-4 sm:p-10 rounded-3xl sm:rounded-[2.5rem]">
              <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div className="p-2.5 sm:p-3 shrink-0 bg-blue-50 text-blue-600 rounded-xl sm:rounded-2xl shadow-sm"><Clock className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-xl font-black uppercase tracking-tight text-slate-900">Istoric Modificari</h3>
                  <p className="tech-label mt-1">Cine a modificat acest dispozitiv si cand</p>
                </div>
              </div>
              {(() => {
                const deviceAudit = auditEntries.filter(e => e.entity === 'device' && e.entityId === device.id);
                if (deviceAudit.length === 0) {
                  return <p className="py-12 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Nicio modificare inregistrata pentru acest dispozitiv</p>;
                }
                return (
                  <div className="space-y-3">
                    {deviceAudit.slice(0, 50).map(e => (
                      <div key={e.id} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-slate-50/70 rounded-2xl border border-slate-100">
                        <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${e.action === 'delete' ? 'bg-red-50 text-red-500' : e.action === 'create' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                          {e.action === 'delete' ? <Trash2 className="w-4 h-4" /> : e.action === 'create' ? <Plus className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900">
                            {e.action === 'create' ? 'Creat' : e.action === 'delete' ? 'Sters' : 'Modificat'} de <span className="text-blue-600">{e.userName}</span>
                          </p>
                          {e.details && <p className="text-[11px] font-medium text-slate-500 mt-0.5 break-words">{e.details}</p>}
                          {/* On phones the timestamp sits under the text instead of squeezing it */}
                          <p className="sm:hidden text-[10px] font-mono font-bold text-slate-500 mt-1">
                            {new Date(e.timestamp).toLocaleString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <p className="hidden sm:block text-[10px] font-mono font-bold text-slate-500 shrink-0">
                          {new Date(e.timestamp).toLocaleString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {showDocCapture && (
        <React.Suspense fallback={null}>
          <CameraDocCapture
            title={`Scaneaza — ${device.name}`}
            onCapture={handleScannedDoc}
            onClose={() => setShowDocCapture(false)}
          />
        </React.Suspense>
      )}

      {viewingFile && (
        <React.Suspense fallback={null}>
          <FileViewer
            file={viewingFile}
            onDownload={downloadFile}
            onClose={() => setViewingFile(null)}
          />
        </React.Suspense>
      )}

      {isStandalone && (
        <div className="p-6 sm:p-8 bg-slate-900 text-white flex flex-col items-center gap-4 text-center">
           <div className="flex items-center gap-3">
              <LogoTile className="p-2 rounded-lg" markClassName="w-5 h-5" />
              <h1 className="text-lg font-black tracking-tight text-white uppercase">Biomedic</h1>
           </div>
           <p className="text-xs text-slate-500 font-medium max-w-xs">
              Aceasta este o vizualizare individuala a dispozitivului. Pentru administrarea intregului parc de echipamente, accesati aplicatia principala.
           </p>
           <a 
              href={getAppBaseUrl()}
              className="mt-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/10"
           >
              Deschide Aplicatia Completa
           </a>
        </div>
      )}
    </div>
  );
};

/**
 * Un termen, cu cate zile mai are.
 *
 * Data singura nu spune nimic: "12.03.2026" cere socoteala in cap de fiecare
 * data. Aici scrie si daca a trecut, si peste cat timp vine.
 */
const TermenRow = ({ eticheta, data, gol, detaliu, greuCandLipseste }: {
  eticheta: string; data?: string; gol: string; detaliu?: string; greuCandLipseste?: boolean;
}) => {
  const zile = data && !Number.isNaN(Date.parse(data))
    ? Math.ceil((new Date(`${data}T00:00:00`).getTime()
      - new Date(new Date().toISOString().split('T')[0] + 'T00:00:00').getTime()) / 86400000)
    : null;
  const ton = zile === null
    ? (greuCandLipseste ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-500')
    : zile < 0 ? 'bg-red-50 border-red-200 text-red-800'
    : zile <= 45 ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-emerald-50 border-emerald-200 text-emerald-800';
  return (
    <div className={`px-4 py-3 rounded-2xl border ${ton}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{eticheta}</p>
      <p className="text-[14px] font-black mt-0.5">
        {data || gol}
        {zile !== null && (
          <span className="text-[11px] font-bold ml-2 opacity-80">
            {zile < 0 ? `expirat de ${-zile} zile` : zile === 0 ? 'expira azi' : `peste ${zile} zile`}
          </span>
        )}
      </p>
      {detaliu && <p className="text-[11px] font-bold opacity-70 mt-0.5 truncate">{detaliu}</p>}
    </div>
  );
};

// Display labels for internal file type values — the stored values stay unchanged
const FILE_TYPE_LABELS: Record<DeviceFile['type'], string> = {
  manual: 'Manual',
  report: 'Raport',
  service: 'Service',
  achizitie: 'Achizitie',
  metrologie: 'Metrologie',
  image: 'Imagine',
  other: 'Altele',
};

const FileCard = React.memo(({ file, color = 'blue', onView, onDownload, onDelete, onLink, alteAparate = [] }: any) => (
  <div className="hardware-card p-5 rounded-[1.5rem] hover:shadow-xl hover:shadow-slate-200/50 transition-all group relative overflow-hidden">
    <div className={`absolute top-0 left-0 w-1 h-full bg-${color}-600`} />
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
       <div className="flex items-center gap-3 sm:gap-4 min-w-0">
         <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600 shadow-sm shrink-0`}>
            {file.type === 'manual' ? <BookOpen className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
         </div>
         <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 min-w-0">
               <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-widest border shrink-0 bg-${color}-50 border-${color}-100 text-${color}-700`}>
                  {FILE_TYPE_LABELS[file.type as DeviceFile['type']] || file.type}
               </span>
               <span className="text-[10px] font-mono font-bold text-slate-500 truncate">{file.dateAdded}</span>
            </div>
            <h4 className="text-xs font-black text-slate-900 truncate pr-2 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{file.name}</h4>
            {alteAparate.length > 0 && (
              <p className="text-[10px] font-bold text-indigo-600 truncate mt-0.5"
                 title={alteAparate.map((d: any) => `${d.name}${d.serialNumber ? ` (${d.serialNumber})` : ''}`).join('\n')}>
                <Layers className="w-3 h-3 inline -mt-0.5 mr-1" />
                si pe {alteAparate.length} {alteAparate.length === 1 ? 'alt aparat' : 'alte aparate'}
              </p>
            )}
         </div>
       </div>
       {/* Actions drop to their own full-width row on phones so the file name keeps its space */}
       <div className={`grid ${onLink ? 'grid-cols-4' : 'grid-cols-3'} sm:flex sm:items-center gap-2 sm:gap-1.5 sm:shrink-0`}>
          {onLink && (
            <button onClick={onLink}
              className="flex items-center justify-center py-3 sm:p-3 bg-slate-50 border border-slate-200 text-slate-500 hover:text-white hover:bg-indigo-600 hover:border-indigo-600 rounded-xl transition active:scale-90"
              title="Pune acelasi document si pe alte aparate — se tine o singura data"
              aria-label="Pune documentul si pe alte aparate"><Layers className="w-5 h-5" /></button>
          )}
          <button onClick={onView} className="flex items-center justify-center py-3 sm:p-3 bg-slate-50 border border-slate-200 text-slate-500 hover:text-white hover:bg-blue-600 hover:border-blue-600 rounded-xl transition active:scale-90" title="Vizualizeaza" aria-label="Vizualizeaza"><Eye className="w-5 h-5" /></button>
          <button onClick={onDownload} className="flex items-center justify-center py-3 sm:p-3 bg-slate-50 border border-slate-200 text-slate-500 hover:text-white hover:bg-emerald-600 hover:border-emerald-600 rounded-xl transition active:scale-90" title="Descarca" aria-label="Descarca"><Download className="w-5 h-5" /></button>
          <button onClick={onDelete} className="flex items-center justify-center py-3 sm:p-3 bg-slate-50 border border-slate-200 text-slate-500 hover:text-white hover:bg-red-600 hover:border-red-600 rounded-xl transition active:scale-90" title="Sterge" aria-label="Sterge"><Trash2 className="w-5 h-5" /></button>
       </div>
    </div>
  </div>
));

const TabButton = React.memo(({ active, onClick, icon, label, shortLabel }: any) => (
  <button
    onClick={onClick}
    className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-3 px-1 sm:px-8 py-3 sm:py-6 text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all relative whitespace-nowrap ${
      active ? 'text-blue-600 bg-blue-50/60 sm:bg-transparent' : 'text-slate-500 hover:text-slate-600'
    }`}
  >
    {icon}
    <span className="sm:hidden truncate max-w-full">{shortLabel || label}</span>
    <span className="hidden sm:inline">{label}</span>
    {active && <div className="absolute bottom-0 left-2 right-2 sm:left-8 sm:right-8 h-1 bg-blue-600 rounded-full shadow-[0_-2px_10px_rgba(37,99,235,0.3)]" />}
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

const DeviceCostCard = React.memo(({ device, invoices }: { device: MedicalDevice; invoices: Invoice[] }) => {
  const deviceInvoices = invoices.filter(inv => (inv.deviceIds || []).includes(device.id));
  const contracts = device.contracts || [];

  // Sum invoice costs grouped by currency; each invoice's cost is split across its devices
  const byCurrency = new Map<string, number>();
  deviceInvoices.forEach(inv => {
    const share = inv.deviceIds.length > 0 ? inv.amount / inv.deviceIds.length : inv.amount;
    byCurrency.set(inv.currency, (byCurrency.get(inv.currency) || 0) + share);
  });
  const contractsAnnual = contracts.reduce((s, c) => s + (c.annualCost || 0), 0);
  const fmt = (n: number) => n.toLocaleString('ro-RO', { maximumFractionDigits: 2 });

  return (
    <div className="hardware-card p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem]">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Wallet className="w-5 h-5" /></div>
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Costuri Asociate</h3>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
          <div className="flex items-center gap-3">
            <Receipt className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Facturi ({deviceInvoices.length})</span>
          </div>
          <div className="text-right">
            {byCurrency.size === 0 ? (
              <span className="text-sm font-black text-slate-500">—</span>
            ) : (
              Array.from(byCurrency.entries()).map(([cur, total]) => (
                <p key={cur} className="text-sm font-black text-slate-900">{fmt(total)} <span className="text-[10px] text-slate-500">{cur}</span></p>
              ))
            )}
          </div>
        </div>
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contracte / an ({contracts.length})</span>
          </div>
          <span className="text-sm font-black text-slate-900">{contractsAnnual > 0 ? fmt(contractsAnnual) : '—'}</span>
        </div>
      </div>
    </div>
  );
});

export default DeviceDetail;
