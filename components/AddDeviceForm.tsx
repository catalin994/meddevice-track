import React, { useState, useRef } from 'react';
import { MedicalDevice, DeviceStatus } from '../types';
import { X, Save, Wand2, Check, Box, Trash2, FileSpreadsheet, Upload, AlertCircle } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

declare var XLSX: any; // Global from CDN

interface AddDeviceFormProps {
  onSave: (device: MedicalDevice) => void;
  onBulkSave: (devices: MedicalDevice[]) => void;
  onCancel: () => void;
}

const AddDeviceForm: React.FC<AddDeviceFormProps> = ({ onSave, onBulkSave, onCancel }) => {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'excel'>('single');
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [previewDevices, setPreviewDevices] = useState<MedicalDevice[]>([]);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    department: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    status: DeviceStatus.ACTIVE,
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newDevice: MedicalDevice = {
      id: `DEV-${Math.floor(Math.random() * 10000)}`,
      ...formData,
      status: formData.status as DeviceStatus,
      maintenanceHistory: [],
      contracts: [],
      files: []
    };
    onSave(newDevice);
  };

  const processWithAI = async (inputData: string) => {
    setIsProcessing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Parse the following device data (possibly from a spreadsheet or raw text) into a structured JSON array of objects. 
        Map columns carefully: look for things that look like serial numbers, names, and manufacturers.
        Required fields for each: name, manufacturer, model, serialNumber, department, purchaseDate (YYYY-MM-DD), and status (one of: Active, In Maintenance, Broken, Retired).
        
        Data to parse:
        "${inputData}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                manufacturer: { type: Type.STRING },
                model: { type: Type.STRING },
                serialNumber: { type: Type.STRING },
                department: { type: Type.STRING },
                purchaseDate: { type: Type.STRING },
                status: { type: Type.STRING },
                notes: { type: Type.STRING }
              },
              required: ["name", "serialNumber"]
            }
          }
        }
      });

      const parsed: any[] = JSON.parse(response.text);
      const devicesWithIds: MedicalDevice[] = parsed.map(item => ({
        ...item,
        id: `DEV-${Math.floor(Math.random() * 90000) + 10000}`,
        status: item.status || DeviceStatus.ACTIVE,
        maintenanceHistory: [],
        contracts: [],
        files: []
      }));

      setPreviewDevices(devicesWithIds);
    } catch (error) {
      console.error(error);
      alert("AI Processing failed. Check your API key or data format.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Convert the JSON to a string to send to Gemini for mapping
        processWithAI(JSON.stringify(data));
      } catch (err) {
        alert("Error reading Excel file. Ensure it is a valid .xlsx or .xls file.");
      }
    };
    reader.readAsBinaryString(file);
    if (excelInputRef.current) excelInputRef.current.value = '';
  };

  const removePreviewItem = (id: string) => {
    setPreviewDevices(prev => prev.filter(d => d.id !== id));
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden max-w-4xl mx-auto animate-fade-in mb-10">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Register Devices</h2>
          <p className="text-xs text-slate-500 mt-1">Select your preferred method to add hospital inventory.</p>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 overflow-x-auto">
        <TabButton active={activeTab === 'single'} onClick={() => setActiveTab('single')} label="Single Entry" />
        <TabButton active={activeTab === 'bulk'} onClick={() => setActiveTab('bulk')} label="Smart Paste" />
        <TabButton active={activeTab === 'excel'} onClick={() => setActiveTab('excel')} label="Excel / CSV Upload" />
      </div>
      
      <div className="p-6 min-h-[400px]">
        {previewDevices.length > 0 ? (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center bg-green-50 p-4 rounded-lg border border-green-100">
               <h3 className="font-bold text-green-800 flex items-center gap-2">
                 <Check className="w-5 h-5 text-green-600" /> 
                 Ready to Import {previewDevices.length} Devices
               </h3>
               <button onClick={() => setPreviewDevices([])} className="text-sm text-green-700 font-medium hover:underline">Clear & Restart</button>
            </div>
            
            <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
              {previewDevices.map(device => (
                <div key={device.id} className="p-4 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Box className="w-5 h-5" /></div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{device.name}</p>
                      <p className="text-xs text-slate-500">{device.manufacturer} {device.model} • SN: {device.serialNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded">{device.department}</span>
                    <button onClick={() => removePreviewItem(device.id)} className="p-2 text-slate-300 hover:text-red-600 transition opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
              <button onClick={() => setPreviewDevices([])} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium">Cancel</button>
              <button 
                onClick={() => onBulkSave(previewDevices)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-md"
              >
                <Save className="w-4 h-4" /> Confirm & Save All
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'single' && (
              <form onSubmit={handleSingleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField label="Device Name" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., MRI Scanner" required />
                  <FormField label="Manufacturer" name="manufacturer" value={formData.manufacturer} onChange={handleChange} placeholder="e.g., Siemens" required />
                  <FormField label="Model" name="model" value={formData.model} onChange={handleChange} required />
                  <FormField label="Serial Number" name="serialNumber" value={formData.serialNumber} onChange={handleChange} required />
                  <FormField label="Department" name="department" value={formData.department} onChange={handleChange} placeholder="e.g., Radiology" required />
                  <FormField label="Purchase Date" name="purchaseDate" type="date" value={formData.purchaseDate} onChange={handleChange} required />
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Status</label>
                    <select 
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                    >
                      {Object.values(DeviceStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Notes</label>
                    <textarea 
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                </div>
                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                    <Save className="w-4 h-4" /> Save Device
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'bulk' && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3">
                  <Wand2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <p className="text-sm text-blue-800 leading-relaxed">
                    <strong>Smart Mapping:</strong> Paste raw text from any list. Our AI will automatically identify the device names, serials, and dates for you.
                  </p>
                </div>
                <textarea 
                  className="w-full h-48 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono bg-slate-50"
                  placeholder="Paste list here... e.g.
1. MRI Scanner - Siemens - Vida - SN1234 - ICU - 2023-01-01
2. Pump - Baxter - Sigma - SN9999 - ER - 2022-05-12"
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium">Cancel</button>
                  <button 
                    onClick={() => processWithAI(bulkText)}
                    disabled={isProcessing || !bulkText.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 shadow-md"
                  >
                    {isProcessing ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Processing...</>
                    ) : (
                      <><Wand2 className="w-4 h-4" /> Extract Devices</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'excel' && (
              <div className="flex flex-col items-center justify-center h-80 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 p-10 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Upload Spreadsheet</h3>
                <p className="text-sm text-slate-500 max-w-sm mt-2">
                  Select an Excel (.xlsx, .xls) or CSV file. Gemini AI will map your spreadsheet columns to the system automatically.
                </p>
                
                <input 
                  type="file" 
                  ref={excelInputRef} 
                  accept=".xlsx,.xls,.csv" 
                  onChange={handleExcelUpload} 
                  className="hidden" 
                />
                
                <button 
                  onClick={() => excelInputRef.current?.click()}
                  disabled={isProcessing}
                  className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Parsing File...</>
                  ) : (
                    <><Upload className="w-5 h-5" /> Select File</>
                  )}
                </button>
                
                <p className="mt-4 text-xs text-slate-400">Supports files up to 5MB</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) => (
  <button 
    onClick={onClick}
    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 shrink-0 ${active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
  >
    {label}
  </button>
);

const FormField = ({ label, name, value, onChange, placeholder = "", type = "text", required = false }: any) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-slate-700">{label}</label>
    <input 
      required={required}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
    />
  </div>
);

export default AddDeviceForm;