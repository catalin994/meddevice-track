
import React, { useState, useRef, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { MedicalDevice, DeviceStatus, HOSPITAL_DEPARTMENTS, DEVICE_CATEGORIES, getUniqueDepartments, calculateNextMaintenanceDate } from '../types';
import { X, Save, Wand2, Box, Trash2, FileSpreadsheet, Upload, Camera, Layers, Hash, ChevronDown, Activity, ArrowRight, ShieldAlert } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

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
    department: HOSPITAL_DEPARTMENTS[0] as string,
    customDepartment: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    status: DeviceStatus.ACTIVE,
    isCNCAN: false,
    notes: '',
    image: ''
  });

  const [batchData, setBatchData] = useState({
    quantity: 1,
    serialPrefix: 'SN-',
    startNum: 100,
  });

  const allAvailableDepartments = useMemo(() => {
    return getUniqueDepartments(devices);
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

  const handleSingleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const finalDept = (formData.department === 'NEW_DEPT' ? (formData.customDepartment || 'Unassigned') : formData.department).trim();
    
    const newDevice: MedicalDevice = {
      // FIX: Ensure every new device gets a truly unique identifier
      id: `DEV-${crypto.randomUUID()}`, 
      name: formData.name,
      category: formData.category,
      manufacturer: formData.manufacturer,
      model: formData.model,
      serialNumber: formData.serialNumber,
      department: finalDept,
      purchaseDate: formData.purchaseDate,
      nextMaintenanceDate: calculateNextMaintenanceDate(formData.purchaseDate, formData.category),
      status: formData.status as DeviceStatus,
      isCNCAN: formData.isCNCAN,
      notes: formData.notes,
      image: formData.image,
      maintenanceHistory: [],
      contracts: [],
      files: [],
      components: []
    };
    
    await onSave(newDevice);
    setIsSubmitting(false);
  }, [formData, onSave]);

  const handleGenerateBatch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const batch: MedicalDevice[] = [];
    const finalDept = (formData.department === 'NEW_DEPT' ? (formData.customDepartment || 'Unassigned') : formData.department).trim();
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
          department: (p.department || 'Unassigned').trim(),
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
        <h2 className="text-2xl font-black text-slate-900 uppercase">Asset Intake</h2>
        <button onClick={onCancel} className="p-2 text-slate-400"><X className="w-6 h-6" /></button>
      </div>

      <div className="flex border-b border-slate-100 bg-white">
        <TabButton active={activeTab === 'single'} onClick={() => setActiveTab('single')} label="Manual" icon={<Box className="w-4 h-4" />} />
        <TabButton active={activeTab === 'batch'} onClick={() => setActiveTab('batch')} label="Batch" icon={<Layers className="w-4 h-4" />} />
        <TabButton active={activeTab === 'excel'} onClick={() => setActiveTab('excel')} label="Import" icon={<FileSpreadsheet className="w-4 h-4" />} />
      </div>

      <div className="p-10">
        {previewDevices.length > 0 ? (
          <div className="space-y-6">
            <h3 className="font-black text-xl">Deploy {previewDevices.length} Assets</h3>
            <div className="max-h-60 overflow-y-auto bg-slate-50 p-4 rounded-xl space-y-2">
              {previewDevices.map((d, i) => <div key={i} className="text-xs bg-white p-2 rounded border">{d.name} ({d.serialNumber})</div>)}
            </div>
            <button onClick={() => onBulkSave(previewDevices)} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase">Commit to Registry</button>
          </div>
        ) : (
          <form onSubmit={activeTab === 'single' ? handleSingleSubmit : handleGenerateBatch} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Asset Name" name="name" value={formData.name} onChange={handleChange} required />
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Category</label>
                <select name="category" value={formData.category} onChange={handleChange} className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none">
                  {DEVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <FormField label="Manufacturer" name="manufacturer" value={formData.manufacturer} onChange={handleChange} required />
              <FormField label="Model" name="model" value={formData.model} onChange={handleChange} required />
              {activeTab === 'single' && <FormField label="Serial Number" name="serialNumber" value={formData.serialNumber} onChange={handleChange} required />}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Department</label>
                <select name="department" value={formData.department} onChange={handleChange} className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none">
                  {allAvailableDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                  <option value="NEW_DEPT">+ Add New Department</option>
                </select>
              </div>
              {formData.department === 'NEW_DEPT' && (
                <FormField label="Custom Department Name" name="customDepartment" value={formData.customDepartment} onChange={handleChange} required />
              )}
            </div>
            <div className="flex justify-end gap-4 pt-6">
              <button type="button" onClick={onCancel} className="px-8 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-xs uppercase">Cancel</button>
              <button type="submit" className="px-12 py-4 bg-blue-600 text-white rounded-xl font-black text-xs uppercase shadow-xl hover:bg-blue-700">Save Asset</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const TabButton = React.memo(({ active, onClick, label, icon }: any) => (
  <button onClick={onClick} className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 ${active ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-slate-400'}`}>{icon}{label}</button>
));

const FormField = React.memo(({ label, name, value, onChange, type = "text", required = false }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black uppercase text-slate-400">{label}</label>
    <input required={required} name={name} type={type} value={value} onChange={onChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
  </div>
));

export default React.memo(AddDeviceForm);
