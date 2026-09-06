
import React, { useState, useRef, useMemo, useCallback } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { MedicalDevice, DeviceStatus, DeviceComponent, HOSPITAL_DEPARTMENTS, DEVICE_CATEGORIES, getUniqueDepartments, calculateNextMaintenanceDate } from '../types';
import { CATEGORII_CU_METROLOGIE } from '../services/termene';
import { X, Save, Wand2, Box, Trash2, FileSpreadsheet, Upload, Camera, Layers, Hash, ChevronDown, Activity, ArrowRight, ShieldAlert, AlertTriangle } from 'lucide-react';
import DepartmentPicker from './DepartmentPicker';
import { ElementeEditor } from './ElementeComponente';

interface AddDeviceFormProps {
  devices: MedicalDevice[];
  onSave: (device: MedicalDevice) => Promise<void>;
  onBulkSave: (devices: MedicalDevice[]) => Promise<void>;
  onCancel: () => void;
}

const COMPRESSION_TARGET = 400 * 1024; 
const AI_BATCH_SIZE = 50; 

const AddDeviceForm: React.FC<AddDeviceFormProps> = ({ devices, onSave, onBulkSave, onCancel }) => {
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'bulk' | 'excel'>('single');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [previewDevices, setPreviewDevices] = useState<MedicalDevice[]>([]);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: DEVICE_CATEGORIES[0] as string,
    manufacturer: '',
    model: '',
    serialNumber: '',
    inventoryNumber: '',
    department: HOSPITAL_DEPARTMENTS[0] as string,
    customDepartment: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    status: DeviceStatus.ACTIVE,
    isCNCAN: false,
    notes: '',
    image: ''
  });

  /*
   * Elementele aparatului, cand e facut din mai multe bucati.
   *
   * Numai la aparatul singur. La generarea in serie, fiecare rand ar primi
   * aceleasi elemente cu aceleasi serii — adica sapte aparate care sustin toate
   * ca au acelasi generator.
   */
  const [elemente, setElemente] = useState<DeviceComponent[]>([]);

  const [batchData, setBatchData] = useState({
    quantity: 1,
    serialPrefix: 'SN-',
    startNum: 100,
  });

  const allAvailableDepartments = useMemo(() => {
    return getUniqueDepartments(devices);
  }, [devices]);

  // Shown beside each option: "Radiologie — 12 aparate" tells you at a glance
  // whether you are about to file this device somewhere nobody uses.
  const deviceCountByDepartment = useMemo(() => {
    const counts: Record<string, number> = {};
    (devices || []).forEach(d => {
      const key = (d.department || '').trim();
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [devices]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as any;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  }, []);

  const compressImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_DIM = 1000; 
          if (width > height) { if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; } }
          else { if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; } }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error("Canvas missing"));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleImageChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const compressed = await compressImage(e.target.files[0]);
      setFormData(prev => ({ ...prev, image: compressed }));
    }
  }, [compressImage]);

  /**
   * Aparatul care are deja seria scrisa acum.
   *
   * Doua fise pentru acelasi aparat rup istoricul in doua: jumatate din
   * mentenante pe una, jumatate pe cealalta, si niciuna nu spune adevarul. Mai
   * incurca si potrivirea facturilor, care se face tocmai dupa serie.
   *
   * Nu opreste pe nimeni — se intampla sa fie doua aparate cu aceeasi serie
   * gresit trecuta pe etichete — dar nu se mai adauga din greseala.
   */
  const seriaLuata = useMemo(() => {
    const s = (formData.serialNumber || '').trim().toLowerCase();
    if (!s) return null;
    return devices.find(d => (d.serialNumber || '').trim().toLowerCase() === s) || null;
  }, [devices, formData.serialNumber]);

  /**
   * Acelasi lucru pentru numarul de inventar.
   *
   * El e cheia din registrul spitalului si e unic prin definitie, deci o
   * potrivire aici inseamna sigur acelasi aparat — spre deosebire de serie,
   * care mai lipseste sau mai e tastata gresit.
   */
  const inventarulLuat = useMemo(() => {
    const s = (formData.inventoryNumber || '').trim().toLowerCase();
    if (!s) return null;
    return devices.find(d => (d.inventoryNumber || '').trim().toLowerCase() === s) || null;
  }, [devices, formData.inventoryNumber]);

  /** Aparatul care asteapta confirmarea, cand seria e deja luata. */
  const [intrebSeria, setIntrebSeria] = useState<MedicalDevice | null>(null);

  const handleSingleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if ((seriaLuata || inventarulLuat) && !intrebSeria) { setIntrebSeria(seriaLuata || inventarulLuat); return; }
    setIntrebSeria(null);
    setIsSubmitting(true);
    const finalDept = (formData.department || 'Nealocat').trim();
    
    const newDevice: MedicalDevice = {
      // FIX: Ensure every new device gets a truly unique identifier
      id: `DEV-${crypto.randomUUID()}`, 
      name: formData.name,
      category: formData.category,
      manufacturer: formData.manufacturer,
      model: formData.model,
      serialNumber: formData.serialNumber,
      inventoryNumber: formData.inventoryNumber.trim() || undefined,
      department: finalDept,
      purchaseDate: formData.purchaseDate,
      nextMaintenanceDate: calculateNextMaintenanceDate(formData.purchaseDate, formData.category),
      status: formData.status as DeviceStatus,
      isCNCAN: formData.isCNCAN,
      // Un defibrilator sau un injectomat poarta buletin metrologic. Bifat de
      // la inceput, aparatul apare imediat pe Panou ca "fara buletin trecut",
      // in loc sa fie descoperit la primul control. Se poate scoate din fisa.
      metrologyRequired: CATEGORII_CU_METROLOGIE.includes(formData.category),
      notes: formData.notes,
      image: formData.image,
      maintenanceHistory: [],
      contracts: [],
      files: [],
      // Numai cele completate: un rand adaugat din greseala si lasat gol n-are
      // ce cauta in fisa.
      components: elemente.filter(c => c.name.trim() || (c.serialNumber || '').trim()),
    };
    
    await onSave(newDevice);
    setIsSubmitting(false);
  }, [formData, elemente, onSave, seriaLuata, inventarulLuat, intrebSeria]);

  const handleGenerateBatch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const batch: MedicalDevice[] = [];
    const finalDept = (formData.department || 'Nealocat').trim();
    for (let i = 0; i < batchData.quantity; i++) {
      batch.push({
        id: `DEV-B-${crypto.randomUUID()}`,
        name: formData.name,
        category: formData.category,
        manufacturer: formData.manufacturer,
        model: formData.model,
        serialNumber: `${batchData.serialPrefix}${batchData.startNum + i}`,
        department: finalDept,
        purchaseDate: formData.purchaseDate,
        nextMaintenanceDate: calculateNextMaintenanceDate(formData.purchaseDate, formData.category),
        status: formData.status as DeviceStatus,
        isCNCAN: formData.isCNCAN,
        metrologyRequired: CATEGORII_CU_METROLOGIE.includes(formData.category),
        notes: formData.notes,
        image: formData.image,
        maintenanceHistory: [],
        contracts: [],
        files: [],
        components: []
      });
    }
    setPreviewDevices(batch);
  }, [formData, batchData]);

  const handleExcelUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const [XLSX, { GoogleGenAI }] = await Promise.all([import('xlsx'), import('@google/genai')]);
      const wb = XLSX.read(evt.target?.result, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Map this data to structured clinical objects: ${JSON.stringify(data.slice(0, 50))}`,
        config: { responseMimeType: "application/json" }
      });
      const parsed: any[] = JSON.parse(response.text || "[]");
      setPreviewDevices(parsed.map(p => {
        const category = p.category || DEVICE_CATEGORIES[0];
        const purchaseDate = p.purchaseDate || new Date().toISOString().split('T')[0];
        return { 
          ...p, 
          id: `DEV-EX-${crypto.randomUUID()}`, 
          category,
          purchaseDate,
          nextMaintenanceDate: calculateNextMaintenanceDate(purchaseDate, category),
          department: (p.department || 'Nealocat').trim(),
          maintenanceHistory: [], 
          contracts: [], 
          files: [], 
          components: [] 
        };
      }));
      setIsProcessing(false);
    };
    reader.readAsBinaryString(file);
  }, []);

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-w-5xl mx-auto animate-fade-in mb-20">
      {(isProcessing || isSubmitting) && <div className="absolute inset-0 bg-slate-900/90 z-[200] flex items-center justify-center"><Activity className="w-12 h-12 text-blue-500 animate-spin" /></div>}
      
      <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h2 className="text-2xl font-black text-slate-900">Inregistrare Dispozitiv</h2>
        <button onClick={onCancel} className="p-2 text-slate-500"><X className="w-6 h-6" /></button>
      </div>

      <div className="flex border-b border-slate-100 bg-white">
        <TabButton active={activeTab === 'single'} onClick={() => setActiveTab('single')} label="Manual" icon={<Box className="w-4 h-4" />} />
        <TabButton active={activeTab === 'batch'} onClick={() => setActiveTab('batch')} label="Lot" icon={<Layers className="w-4 h-4" />} />
        <TabButton active={activeTab === 'excel'} onClick={() => setActiveTab('excel')} label="Import" icon={<FileSpreadsheet className="w-4 h-4" />} />
      </div>

      <div className="p-10">
        {previewDevices.length > 0 ? (
          <div className="space-y-6">
            <h3 className="font-black text-xl">Adauga {previewDevices.length} dispozitive</h3>
            {(() => {
              // Seriile care exista deja, in orice fel de lot — generat sau adus
              // din Excel. Fara asta, un import repetat dubla jumatate din
              // inventar si nimeni nu observa pana la urmatoarea inventariere.
              const avem = new Map(devices.map(d => [(d.serialNumber || '').trim().toLowerCase(), d]));
              const cad = previewDevices.filter(d => avem.has((d.serialNumber || '').trim().toLowerCase()));
              if (cad.length === 0) return null;
              return (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <p className="text-[13px] font-bold text-amber-900 leading-relaxed">
                    <span className="font-black">{cad.length}</span> {cad.length === 1 ? 'serie exista' : 'serii exista'} deja in inventar
                    {' '}({cad.slice(0, 3).map(d => d.serialNumber).join(', ')}{cad.length > 3 ? ' si altele' : ''}).
                    Adaugate asa, aparatele vor avea cate doua fise si istoricul li se rupe in doua.
                  </p>
                </div>
              );
            })()}
            <div className="max-h-60 overflow-y-auto bg-slate-50 p-4 rounded-xl space-y-2">
              {previewDevices.map((d, i) => <div key={i} className="text-xs bg-white p-2 rounded border">{d.name} ({d.serialNumber})</div>)}
            </div>
            <button onClick={() => onBulkSave(previewDevices)} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold">Salveaza in Registru</button>
          </div>
        ) : (
          <form onSubmit={activeTab === 'single' ? handleSingleSubmit : handleGenerateBatch} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Denumire dispozitiv" name="name" value={formData.name} onChange={handleChange} required />
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500">Categorie</label>
                <select name="category" value={formData.category} onChange={handleChange} className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none">
                  {DEVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <FormField label="Producator" name="manufacturer" value={formData.manufacturer} onChange={handleChange} required />
              <FormField label="Model" name="model" value={formData.model} onChange={handleChange} required />
              {activeTab === 'single' && (
                <FormField label="Numar serie" name="serialNumber" value={formData.serialNumber} onChange={handleChange} required
                  avertisment={seriaLuata
                    ? `Seria asta e deja pe "${seriaLuata.name}" (${seriaLuata.department || 'fara sectie'}). Doua fise pentru acelasi aparat ii rup istoricul in doua.`
                    : ''} />
              )}
              {activeTab === 'single' && (
                <FormField label="Numar de inventar" name="inventoryNumber" value={formData.inventoryNumber} onChange={handleChange}
                  avertisment={inventarulLuat
                    ? `Numarul asta de inventar e deja pe "${inventarulLuat.name}" (${inventarulLuat.department || 'fara sectie'}). Numarul de inventar e unic in registru — foarte probabil e acelasi aparat.`
                    : ''} />
              )}
              <div className="space-y-2">
                <DepartmentPicker
                  value={formData.department}
                  onChange={(v) => setFormData(prev => ({ ...prev, department: v }))}
                  options={allAvailableDepartments}
                  counts={deviceCountByDepartment}
                  required
                />
              </div>
            </div>

            {/* Doar la aparatul singur: in serie, elementele ar fi copiate cu
                tot cu serii pe fiecare rand generat. */}
            {activeTab === 'single' && (
              <div className="pt-6 border-t border-slate-100">
                <ElementeEditor valoare={elemente} onChange={setElemente} />
              </div>
            )}

            <div className="flex justify-end gap-4 pt-6">
              <button type="button" onClick={onCancel} className="px-8 py-4 bg-slate-100 text-slate-500 rounded-xl font-bold text-[13px]">Anuleaza</button>
              <button type="submit" className="px-12 py-4 bg-blue-600 text-white rounded-xl font-bold text-[13px] shadow-xl hover:bg-blue-700">Salveaza</button>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={!!intrebSeria}
        tone="neutral"
        title={inventarulLuat && !seriaLuata ? 'Numarul de inventar exista deja' : 'Seria exista deja'}
        icon={<AlertTriangle className="w-8 h-8" />}
        body={<>
          {inventarulLuat && !seriaLuata ? 'Numarul de inventar ' : 'Seria '}
          <span className="font-black text-slate-900">{inventarulLuat && !seriaLuata ? formData.inventoryNumber : formData.serialNumber}</span> e trecut(a) pe{' '}
          <span className="font-black text-slate-900">{intrebSeria?.name}</span>
          {intrebSeria?.department ? `, ${intrebSeria.department}` : ''}.
          Doua fise pentru acelasi aparat ii rup istoricul in doua si incurca potrivirea facturilor,
          care se face tot dupa serie.
        </>}
        confirmLabel="Adaug oricum"
        cancelLabel="Ma intorc"
        onCancel={() => setIntrebSeria(null)}
        onConfirm={() => { void handleSingleSubmit({ preventDefault: () => {} } as React.FormEvent); }}
      />
    </div>
  );
};

const TabButton = React.memo(({ active, onClick, label, icon }: any) => (
  <button onClick={onClick} className={`px-8 py-4 text-[10px] font-black uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 ${active ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-slate-500'}`}>{icon}{label}</button>
));

const FormField = React.memo(({ label, name, value, onChange, type = "text", required = false, avertisment = '' }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black uppercase text-slate-500">{label}</label>
    <input required={required} name={name} type={type} value={value} onChange={onChange}
      className={`w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none ${
 avertisment ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200'
      }`} />
    {avertisment && (
      <p className="text-[11px] font-bold text-amber-700 leading-relaxed px-1">{avertisment}</p>
    )}
  </div>
));

export default AddDeviceForm;
