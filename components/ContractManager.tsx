
import React, { useState } from 'react';
import { Contract, MedicalDevice } from '../types';
import { ShieldCheck, Plus, X, Wand2, Search, Check, Info, Calendar, DollarSign, Phone, FileText, ChevronRight, Loader2 } from 'lucide-react';
import { analyzeContractText } from '../services/geminiService';

interface ContractManagerProps {
  devices: MedicalDevice[];
  onSaveContract: (contract: Contract, deviceIds: string[]) => void;
}

const ContractManager: React.FC<ContractManagerProps> = ({ devices, onSaveContract }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiText, setAiText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    provider: '',
    contractNumber: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    coverageDetails: '',
    contactPhone: '',
    annualCost: 0
  });

  // Extract all unique contracts from all devices to show a global list.
  // Fix: Explicitly type the Map to ensure globalContracts is inferred as Contract[].
  const globalContracts = Array.from(
    new Map<string, Contract>(
      devices.flatMap(d => d.contracts).map(c => [c.contractNumber, c])
    ).values()
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'annualCost' ? parseFloat(value) || 0 : value }));
  };

  const toggleDevice = (id: string) => {
    setSelectedDevices(prev => 
      prev.includes(id) ? prev.filter(did => did !== id) : [...prev, id]
    );
  };

  const handleAiExtract = async () => {
    if (!aiText) return;
    setIsAnalyzing(true);
    try {
      const extracted = await analyzeContractText(aiText);
      setFormData(prev => ({
        ...prev,
        ...extracted,
        annualCost: extracted.annualCost || prev.annualCost
      }));
      setAiText('');
    } catch (err) {
      alert("AI Extraction failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDevices.length === 0) {
      alert("Please associate at least one device with this contract.");
      return;
    }
    const newContract: Contract = {
      id: `CON-${Math.floor(Math.random() * 90000)}`,
      ...formData
    };
    onSaveContract(newContract, selectedDevices);
    setIsAdding(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      provider: '',
      contractNumber: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      coverageDetails: '',
      contactPhone: '',
      annualCost: 0
    });
    setSelectedDevices([]);
  };

  const filteredDevices = devices.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <ShieldCheck className="w-8 h-8" />
            </div>
            Contract Registry
          </h2>
          <p className="text-sm text-slate-400 font-bold uppercase mt-1 tracking-widest">Master Service Level Agreements</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition shadow-sm active:scale-95 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Register Agreement
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {globalContracts.map(contract => (
          <div key={contract.contractNumber} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-colors group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
               <ShieldCheck className="w-32 h-32 text-indigo-900" />
            </div>
            
            <div className="flex justify-between items-start mb-6">
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest">Valid Agreement</span>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Annual Value</p>
                <p className="text-lg font-black text-indigo-600">${contract.annualCost.toLocaleString()}</p>
              </div>
            </div>

            <h3 className="text-xl font-black text-slate-900 leading-none">{contract.provider}</h3>
            <p className="text-[10px] font-mono text-slate-400 uppercase mt-1">Ref: {contract.contractNumber}</p>

            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                <Calendar className="w-4 h-4 text-slate-300" />
                <span>{contract.startDate} — {contract.endDate}</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                <Phone className="w-4 h-4 text-slate-300" />
                <span>{contract.contactPhone}</span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
              <div className="flex -space-x-3 overflow-hidden">
                {devices.filter(d => d.contracts.some(c => c.contractNumber === contract.contractNumber)).slice(0, 4).map((d, i) => (
                  <div key={d.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                    {d.image ? <img src={d.image} className="h-full w-full object-cover" /> : <div className="text-[8px] font-bold text-slate-400">{d.name.charAt(0)}</div>}
                  </div>
                ))}
                {devices.filter(d => d.contracts.some(c => c.contractNumber === contract.contractNumber)).length > 4 && (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full ring-2 ring-white bg-slate-900 text-white text-[8px] font-black">
                    +{devices.filter(d => d.contracts.some(c => c.contractNumber === contract.contractNumber)).length - 4}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Covered Fleet</span>
            </div>
          </div>
        ))}
        {globalContracts.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border-4 border-dashed border-slate-50 flex flex-col items-center">
            <FileText className="w-16 h-16 text-slate-100 mb-4" />
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No active master agreements found</p>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in border border-white">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Register Master Agreement</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase mt-1 tracking-widest">Associate contract to fleet assets</p>
               </div>
               <button onClick={() => setIsAdding(false)} className="p-3 bg-white text-slate-400 rounded-2xl hover:text-slate-900 transition shadow-sm border border-slate-200"><X className="w-6 h-6" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 lg:p-12">
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  <div className="lg:col-span-7 space-y-10">
                     <div className="space-y-6">
                        <div className="bg-violet-900 p-8 rounded-xl text-white shadow-xl">
                           <div className="flex items-center gap-3 mb-6">
                              <Wand2 className="w-6 h-6 text-violet-400" />
                              <h4 className="text-sm font-black uppercase tracking-widest">Smart AI Extraction</h4>
                           </div>
                           <textarea 
                              className="w-full bg-white/10 border border-white/20 rounded-2xl p-6 text-sm font-medium outline-none focus:bg-white/20 transition-colors placeholder:text-violet-300/50 min-h-[120px]" 
                              placeholder="Paste raw contract text, OCR data, or PDF summary here..."
                              value={aiText}
                              onChange={(e) => setAiText(e.target.value)}
                           />
                           <button 
                              onClick={handleAiExtract}
                              disabled={isAnalyzing || !aiText}
                              className="mt-6 w-full py-4 bg-white text-violet-900 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-violet-50 transition flex items-center justify-center gap-2 disabled:opacity-50"
                           >
                              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Extract Agreement Metadata"}
                           </button>
                        </div>

                        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                           <FormInput label="Service Provider" name="provider" value={formData.provider} onChange={handleInputChange} placeholder="e.g. GE HealthCare" required />
                           <FormInput label="Contract Number" name="contractNumber" value={formData.contractNumber} onChange={handleInputChange} placeholder="MSLA-992-00" required />
                           <FormInput label="Start Date" name="startDate" type="date" value={formData.startDate} onChange={handleInputChange} required />
                           <FormInput label="Expiration Date" name="endDate" type="date" value={formData.endDate} onChange={handleInputChange} required />
                           <FormInput label="Annual Cost ($)" name="annualCost" type="number" value={formData.annualCost.toString()} onChange={handleInputChange} placeholder="0.00" required />
                           <FormInput label="Support Phone" name="contactPhone" type="tel" value={formData.contactPhone} onChange={handleInputChange} placeholder="555-000-0000" required />
                           <div className="sm:col-span-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Coverage Details</label>
                              <textarea 
                                 name="coverageDetails"
                                 value={formData.coverageDetails}
                                 onChange={handleInputChange}
                                 className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold min-h-[100px] outline-none focus:ring-4 focus:ring-indigo-500/10 transition-colors"
                                 placeholder="Full parts, labor, software updates, 4h response time..."
                                 required
                              />
                           </div>
                           <button type="submit" className="hidden" id="main-submit-btn"></button>
                        </form>
                     </div>
                  </div>

                  <div className="lg:col-span-5 space-y-6">
                     <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 h-full flex flex-col">
                        <div className="mb-6">
                           <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                              <Plus className="w-5 h-5 text-indigo-600" /> Associate Fleet Assets
                           </h4>
                           <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Selected: {selectedDevices.length}</p>
                        </div>

                        <div className="relative mb-6">
                           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                           <input 
                              type="text" 
                              placeholder="Search inventory..."
                              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                           />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                           {filteredDevices.map(device => (
                              <div 
                                 key={device.id}
                                 onClick={() => toggleDevice(device.id)}
                                 className={`p-4 rounded-2xl border transition-colors cursor-pointer flex items-center gap-4 ${
                                    selectedDevices.includes(device.id) 
                                    ? 'bg-indigo-600 text-white border-indigo-600 ' 
                                    : 'bg-white border-slate-100 hover:border-indigo-200'
                                 }`}
                              >
                                 <div className={`p-2 rounded-lg ${selectedDevices.includes(device.id) ? 'bg-white/20' : 'bg-slate-50 text-slate-400'}`}>
                                    {selectedDevices.includes(device.id) ? <Check className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                                 </div>
                                 <div className="truncate flex-1">
                                    <p className={`text-[11px] font-black truncate ${selectedDevices.includes(device.id) ? 'text-white' : 'text-slate-900'}`}>{device.name}</p>
                                    <p className={`text-[9px] font-bold uppercase tracking-tighter ${selectedDevices.includes(device.id) ? 'text-white/60' : 'text-slate-400'}`}>{device.serialNumber}</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
               <button onClick={() => setIsAdding(false)} className="px-8 py-4 text-slate-500 font-black text-xs uppercase tracking-widest">Cancel</button>
               <button 
                  onClick={() => document.getElementById('main-submit-btn')?.click()}
                  className="px-12 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow hover:bg-indigo-700 transition active:scale-95 flex items-center gap-3"
               >
                  <ShieldCheck className="w-5 h-5" /> Execute Agreement
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FormInput = ({ label, name, value, onChange, placeholder, type = "text", required = false }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <input 
      required={required}
      name={name} 
      type={type} 
      value={value} 
      onChange={onChange} 
      placeholder={placeholder} 
      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-colors"
    />
  </div>
);

export default ContractManager;
