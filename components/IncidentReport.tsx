
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { X, Siren, Search, Camera, Paperclip, Trash2, Loader2, CheckCircle2, Film, FileText, AlertTriangle } from 'lucide-react';
import { MedicalDevice, MedicalTask, TaskAttachment, TaskPriority, TaskStatus, TASK_PRIORITY_RO, HOSPITAL_DEPARTMENTS } from '../types';
import { buildPath, uploadDataUrl, resolveSource } from '../services/fileStorage';

import Portal from './Portal';
interface IncidentReportProps {
  devices: MedicalDevice[];
  onSubmit: (task: MedicalTask) => Promise<void> | void;
  onClose: () => void;
}

// Common incident types — one tap instead of typing
const COMMON_ISSUES = [
  'Aparatul nu porneste',
  'Eroare afisata pe ecran',
  'Zgomot / vibratii anormale',
  'Nu se incarca bateria',
  'Rezultate / masuratori incorecte',
  'Accesoriu defect',
];

const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 20;
const MAX_FILE_MB = 10;

// Downscale photos so tickets stay light enough to sync
const compressImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const MAX_DIM = 1600;
    let { width, height } = img;
    if (width > MAX_DIM || height > MAX_DIM) {
      const scale = MAX_DIM / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    resolve(canvas.toDataURL('image/jpeg', 0.82));
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')); };
  img.src = url;
});

const readAsDataURL = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

/** The picture just taken, whether it went to Storage or stayed inline. */
const AttachmentPreview: React.FC<{ attachment: TaskAttachment }> = ({ attachment }) => {
  const [src, setSrc] = useState<string | null>(attachment.url || null);
  useEffect(() => {
    if (!attachment.path) { setSrc(attachment.url || null); return; }
    let url: string | null = null;
    let cancelled = false;
    resolveSource(attachment).then(source => {
      if (cancelled || !source.blob) return;
      url = URL.createObjectURL(source.blob);
      setSrc(url);
    });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [attachment.path, attachment.url]);

  if (!src) return <div className="w-full h-20 bg-slate-100 animate-pulse rounded" />;
  return <img src={src} alt={attachment.name} className="w-full h-20 object-cover" />;
};

const IncidentReport: React.FC<IncidentReportProps> = ({ devices, onSubmit, onClose }) => {
  const [deviceSearch, setDeviceSearch] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<MedicalDevice | null>(null);
  const [department, setDepartment] = useState<string>(HOSPITAL_DEPARTMENTS[0]);
  const [issue, setIssue] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.HIGH);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  // Attachments are uploaded while the form is still open, so the ticket needs
  // its id up front rather than at submit time.
  const ticketIdRef = useRef(`INC-${Date.now()}`);
  const ticketId = ticketIdRef.current;
  const [attachError, setAttachError] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchResults = useMemo(() => {
    const q = deviceSearch.toLowerCase().trim();
    if (q.length < 2) return [];
    return devices.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.serialNumber.toLowerCase().includes(q) ||
      d.department.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [devices, deviceSearch]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachError('');
    setIsProcessingFile(true);
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const sizeMB = file.size / (1024 * 1024);
        let kind: TaskAttachment['kind'];
        let url: string;

        if (file.type.startsWith('image/')) {
          if (sizeMB > MAX_IMAGE_MB) { errors.push(`${file.name}: poza depaseste ${MAX_IMAGE_MB}MB`); continue; }
          kind = 'image';
          url = await compressImage(file).catch(() => readAsDataURL(file));
        } else if (file.type.startsWith('video/')) {
          if (sizeMB > MAX_VIDEO_MB) { errors.push(`${file.name}: video depaseste ${MAX_VIDEO_MB}MB`); continue; }
          kind = 'video';
          url = await readAsDataURL(file);
        } else {
          if (sizeMB > MAX_FILE_MB) { errors.push(`${file.name}: fisierul depaseste ${MAX_FILE_MB}MB`); continue; }
          kind = 'file';
          url = await readAsDataURL(file);
        }

        // Straight to Storage; the inline copy is only a fallback for a
        // failed upload, so a photo taken at the bedside is never lost.
        const id = crypto.randomUUID();
        const { path, error } = await uploadDataUrl(buildPath('incidents', ticketId, id, file.name), url);
        if (error) errors.push(`${file.name}: ramane doar pe telefon (${error})`);

        setAttachments(prev => [...prev, {
          id,
          name: file.name,
          kind,
          ...(path ? { path } : { url }),
          size: file.size,
          dateAdded: new Date().toISOString().split('T')[0],
        }]);
      } catch {
        errors.push(`${file.name}: eroare la citire`);
      }
    }
    if (errors.length) setAttachError(errors.join(' · '));
    setIsProcessingFile(false);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const title = issue.trim() || description.trim().slice(0, 60);
    if (!title) return;
    setIsSubmitting(true);

    const task: MedicalTask = {
      id: ticketId,
      title,
      description: description.trim() || issue,
      deviceId: selectedDevice?.id,
      deviceName: selectedDevice?.name,
      department: (selectedDevice?.department || department).trim(),
      priority,
      status: TaskStatus.PENDING,
      createdAt: new Date().toISOString().split('T')[0],
      notes: `Incident raportat de operator${selectedDevice ? ` · SN: ${selectedDevice.serialNumber}` : ''}`,
      attachments,
    };
    await onSubmit(task);
    setIsSubmitting(false);
    onClose();
  }, [issue, description, selectedDevice, department, priority, attachments, onSubmit, onClose, ticketId]);

  const fmtSize = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : `${Math.round(b / 1024)}KB`;

  return (
    <Portal>
    <div className="fixed inset-0 z-[500] scrim flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl modal-shell overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-red-50/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg shadow-red-600/20">
              <Siren className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Raporteaza Incident</h3>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Se genereaza automat un tichet de service</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-white text-slate-500 rounded-2xl hover:text-slate-900 transition border border-slate-200 shadow-sm"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {/* Device picker */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Aparatul cu probleme</label>
            {selectedDevice ? (
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate">{selectedDevice.name}</p>
                  <p className="text-[10px] font-mono text-slate-500">SN: {selectedDevice.serialNumber} · {selectedDevice.department}</p>
                </div>
                <button type="button" onClick={() => { setSelectedDevice(null); setDeviceSearch(''); }} className="text-slate-500 hover:text-red-500 transition"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    value={deviceSearch}
                    onChange={e => setDeviceSearch(e.target.value)}
                    placeholder="Cauta dupa nume, serie sau departament..."
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-red-500/10"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {searchResults.map(d => (
                      <button key={d.id} type="button" onClick={() => { setSelectedDevice(d); setDeviceSearch(''); }}
                        className="w-full text-left p-3 rounded-xl border bg-white border-slate-100 hover:border-blue-300 hover:bg-blue-50/50 transition">
                        <p className="text-sm font-bold text-slate-900">{d.name}</p>
                        <p className="text-[10px] font-mono text-slate-500">SN: {d.serialNumber} · {d.department}</p>
                      </button>
                    ))}
                  </div>
                )}
                {deviceSearch.length < 2 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1">Optional — daca nu stii aparatul, alege departamentul:</p>
                    <select value={department} onChange={e => setDepartment(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none">
                      {HOSPITAL_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Problem quick-select */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ce problema are?</label>
            <div className="flex flex-wrap gap-2">
              {COMMON_ISSUES.map(ci => (
                <button key={ci} type="button" onClick={() => setIssue(issue === ci ? '' : ci)}
                  className={`px-4 py-2.5 rounded-xl text-[11px] font-bold border transition ${issue === ci ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-600/20' : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'}`}>
                  {ci}
                </button>
              ))}
            </div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descrie problema cu propriile cuvinte (optional daca ai ales una de mai sus)..."
              className="w-full mt-2 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium min-h-[80px] outline-none focus:ring-4 focus:ring-red-500/10 resize-none"
            />
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cat de grav este?</label>
            <div className="grid grid-cols-3 gap-2">
              {([TaskPriority.CRITICAL, TaskPriority.HIGH, TaskPriority.MEDIUM] as TaskPriority[]).map(p => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition ${priority === p
                    ? p === TaskPriority.CRITICAL ? 'bg-red-600 text-white border-red-600' : p === TaskPriority.HIGH ? 'bg-orange-500 text-white border-orange-500' : 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-500 border-slate-200'}`}>
                  {TASK_PRIORITY_RO[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Attachments */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Poze, video sau fisiere</label>
            <div className="grid grid-cols-2 gap-3">
              <input ref={mediaInputRef} type="file" accept="image/*,video/*" capture="environment" multiple className="hidden" onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
              <button type="button" onClick={() => mediaInputRef.current?.click()} disabled={isProcessingFile}
                className="flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition active:scale-95 disabled:opacity-50">
                <Camera className="w-4 h-4" /> Poza / Video
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isProcessingFile}
                className="flex items-center justify-center gap-2 py-4 bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition active:scale-95 disabled:opacity-50">
                <Paperclip className="w-4 h-4" /> Fisiere
              </button>
            </div>
            {isProcessingFile && (
              <div className="flex items-center gap-2 text-slate-500 text-xs font-bold"><Loader2 className="w-4 h-4 animate-spin" /> Se proceseaza...</div>
            )}
            {attachError && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-amber-700">{attachError}</p>
              </div>
            )}
            {attachments.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {attachments.map(a => (
                  <div key={a.id} className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                    {a.kind === 'image' ? (
                      <AttachmentPreview attachment={a} />
                    ) : (
                      <div className="w-full h-20 flex flex-col items-center justify-center gap-1 text-slate-500">
                        {a.kind === 'video' ? <Film className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                        <span className="text-[10px] font-black uppercase">{a.kind === 'video' ? 'Video' : 'Fisier'}</span>
                      </div>
                    )}
                    <div className="px-1.5 py-1 bg-white border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-500 truncate" title={a.name}>{a.name}</p>
                      <p className="text-[10px] font-mono text-slate-500">{fmtSize(a.size)}</p>
                    </div>
                    <button type="button" onClick={() => setAttachments(prev => prev.filter(x => x.id !== a.id))}
                      className="absolute top-1 right-1 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Limite: poze {MAX_IMAGE_MB}MB · video {MAX_VIDEO_MB}MB · fisiere {MAX_FILE_MB}MB</p>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition">Renunta</button>
            <button type="submit" disabled={isSubmitting || (!issue.trim() && !description.trim())}
              className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-red-600/20 hover:bg-red-700 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Siren className="w-5 h-5" />}
              Trimite Incidentul
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
};

export default IncidentReport;
