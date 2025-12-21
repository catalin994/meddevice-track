import React, { useState, useRef } from 'react';
import { MedicalDevice, DeviceStatus, MaintenanceType, Contract, DeviceFile, MaintenanceRecord } from '../types';
import { 
  Calendar, FileText, Activity, Box, QrCode, Plus, Trash2, 
  Download, ExternalLink, Wand2, ShieldCheck, X, Edit2
} from 'lucide-react';
import { analyzeContractText, suggestMaintenanceSchedule } from '../services/geminiService';

interface DeviceDetailProps {
  device: MedicalDevice;
  onUpdate: (updatedDevice: MedicalDevice) => void;
  onDelete: () => void;
  onBack: () => void;
}

const DeviceDetail: React.FC<DeviceDetailProps> = ({ device, onUpdate, onDelete, onBack }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'maintenance' | 'contracts' | 'qr'>('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [contractText, setContractText] = useState('');
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  const [maintenanceForm, setMaintenanceForm] = useState<Partial<MaintenanceRecord>>({
    date: new Date().toISOString().split('T')[0],
    type: MaintenanceType.PREVENTIVE,
    technician: '',
    description: '',
    completed: false,
    nextScheduledDate: ''
  });

  const initialContractForm = {
    name: '',
    provider: '',
    contractNumber: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    annualCost: '',
    coverageDetails: '',
    contactPhone: ''
  };

  const [manualContractForm, setManualContractForm] = useState(initialContractForm);

  // Maintenance Helpers
  const handleSuggestMaintenance = async () => {
    setIsAnalyzing(true);
    try {
      const suggestion = await suggestMaintenanceSchedule(device.name, device.model);
      alert(`AI Suggestion:\nType: ${suggestion.recommendedType}\nFreq: ${suggestion.frequency}\nTasks: ${suggestion.tasks.join(', ')}`);
    } catch (e) {
      alert("Failed to get suggestion.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveMaintenance = () => {
    if (!maintenanceForm.technician || !maintenanceForm.description) {
      alert("Please fill in Technician and Description fields");
      return;
    }

    const newRecord: MaintenanceRecord = {
      id: crypto.randomUUID(),
      date: maintenanceForm.date || new Date().toISOString().split('T')[0],
      type: maintenanceForm.type || MaintenanceType.PREVENTIVE,
      technician: maintenanceForm.technician,
      description: maintenanceForm.description,
      completed: maintenanceForm.completed || false,
      nextScheduledDate: maintenanceForm.nextScheduledDate || undefined
    };

    const updatedHistory = [newRecord, ...device.maintenanceHistory];
    
    // Optional: Update device status if maintenance is active (not completed)
    let updatedStatus = device.status;
    if (!newRecord.completed && newRecord.date <= new Date().toISOString().split('T')[0]) {
        updatedStatus = DeviceStatus.MAINTENANCE;
    } else if (newRecord.completed && device.status === DeviceStatus.MAINTENANCE) {
        updatedStatus = DeviceStatus.ACTIVE;
    }

    onUpdate({
      ...device,
      status: updatedStatus,
      maintenanceHistory: updatedHistory
    });

    setShowMaintenanceModal(false);
    setMaintenanceForm({
      date: new Date().toISOString().split('T')[0],
      type: MaintenanceType.PREVENTIVE,
      technician: '',
      description: '',
      completed: false,
      nextScheduledDate: ''
    });
  };

  // Contract Helpers
  const handleAnalyzeContract = async () => {
    if (!contractText) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeContractText(contractText);
      const newContract: Contract = {
        id: crypto.randomUUID(),
        provider: result.provider || 'Unknown',
        contractNumber: result.contractNumber || 'N/A',
        startDate: result.startDate || new Date().toISOString().split('T')[0],
        endDate: result.endDate || new Date().toISOString().split('T')[0],
        coverageDetails: result.coverageDetails || '',
        contactPhone: result.contactPhone || '',
        annualCost: result.annualCost || 0
      };
      
      onUpdate({
        ...device,
        contracts: [...device.contracts, newContract]
      });
      setShowContractModal(false);
      setContractText('');
    } catch (e) {
      alert("Failed to analyze contract text.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEditContract = (contract: Contract) => {
    setEditingContractId(contract.id);
    setManualContractForm({
      name: contract.name || '',
      provider: contract.provider,
      contractNumber: contract.contractNumber,
      startDate: contract.startDate,
      endDate: contract.endDate,
      annualCost: contract.annualCost.toString(),
      coverageDetails: contract.coverageDetails,
      contactPhone: contract.contactPhone
    });
    setShowContractModal(true);
  };

  const handleSaveManualContract = () => {
    if (!manualContractForm.provider || !manualContractForm.startDate || !manualContractForm.endDate) {
      alert("Please fill in Provider, Start Date and End Date.");
      return;
    }

    if (editingContractId) {
      // Update existing contract
      const updatedContracts = device.contracts.map(c => 
        c.id === editingContractId 
        ? {
            ...c,
            name: manualContractForm.name,
            provider: manualContractForm.provider,
            contractNumber: manualContractForm.contractNumber || 'Manual',
            startDate: manualContractForm.startDate,
            endDate: manualContractForm.endDate,
            coverageDetails: manualContractForm.coverageDetails || 'Standard Coverage',
            contactPhone: manualContractForm.contactPhone || '',
            annualCost: Number(manualContractForm.annualCost) || 0
          }
        : c
      );
      onUpdate({ ...device, contracts: updatedContracts });
    } else {
      // Create new contract
      const newContract: Contract = {
        id: crypto.randomUUID(),
        name: manualContractForm.name,
        provider: manualContractForm.provider,
        contractNumber: manualContractForm.contractNumber || 'Manual',
        startDate: manualContractForm.startDate,
        endDate: manualContractForm.endDate,
        coverageDetails: manualContractForm.coverageDetails || 'Standard Coverage',
        contactPhone: manualContractForm.contactPhone || '',
        annualCost: Number(manualContractForm.annualCost) || 0
      };
      onUpdate({ ...device, contracts: [...device.contracts, newContract] });
    }

    closeContractModal();
  };

  const closeContractModal = () => {
    setShowContractModal(false);
    setEditingContractId(null);
    setManualContractForm(initialContractForm);
    setContractText('');
  };

  const handleDeleteContract = (contractId: string) => {
    onUpdate({
      ...device,
      contracts: device.contracts.filter(c => c.id !== contractId)
    });
  };

  // File Upload Helpers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Limit file size to 1MB for database storage to avoid issues
      if (file.size > 1024 * 1024) {
        alert("File is too large for database storage. Please select a file under 1MB.");
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setUploadingFile(true);

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        
        // Determine type based on extension
        let type: DeviceFile['type'] = 'other';
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (['pdf', 'doc', 'docx'].includes(ext || '')) type = 'manual';
        else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) type = 'image';
        else if (['csv', 'xls', 'xlsx'].includes(ext || '')) type = 'report';

        const newFile: DeviceFile = {
          id: crypto.randomUUID(),
          name: file.name,
          type: type,
          url: base64String, // Store as Base64 to sync across DB
          dateAdded: new Date().toISOString().split('T')[0]
        };

        onUpdate({
          ...device,
          files: [...device.files, newFile]
        });
        
        setUploadingFile(false);
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Safe File Opening
  const handleOpenFile = (e: React.MouseEvent, file: DeviceFile) => {
    e.preventDefault();
    if (file.url === '#') {
      alert('This is a mock file. Upload a real file to test viewing.');
      return;
    }
    
    // Convert base64 to blob to open in new tab (bypassing chrome security on data urls)
    try {
       const byteString = atob(file.url.split(',')[1]);
       const mimeString = file.url.split(',')[0].split(':')[1].split(';')[0];
       const ab = new ArrayBuffer(byteString.length);
       const ia = new Uint8Array(ab);
       for (let i = 0; i < byteString.length; i++) {
         ia[i] = byteString.charCodeAt(i);
       }
       const blob = new Blob([ab], { type: mimeString });
       const blobUrl = URL.createObjectURL(blob);
       window.open(blobUrl, '_blank');
    } catch(err) {
       console.error("Error opening file:", err);
       // Fallback to direct window open if blob fails
       const win = window.open();
       if (win) {
         win.document.write('<iframe src="' + file.url + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>');
       }
    }
  };

  // QR Code Image URL
  // Construct a URL that deep links to this specific device
  // We prefer the user configured base URL if available to solve "cannot reach site" on mobile devices
  const getBaseUrl = () => {
    return localStorage.getItem('meditrack_base_url') || (window.location.origin + window.location.pathname);
  }
  
  const appBaseUrl = getBaseUrl();
  const qrData = `${appBaseUrl}?deviceId=${device.id}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex justify-between items-start">
        <div>
          <button onClick={onBack} className="text-slate-500 hover:text-slate-700 text-sm mb-2 flex items-center gap-1">
            ← Back to Inventory
          </button>
          <h1 className="text-2xl font-bold text-slate-900">{device.name}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
            <span className="flex items-center gap-1"><Box className="w-4 h-4" /> {device.model}</span>
            <span className="px-2 py-1 bg-slate-100 rounded-full text-xs font-medium">SN: {device.serialNumber}</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              device.status === DeviceStatus.ACTIVE ? 'bg-green-100 text-green-700' : 
              device.status === DeviceStatus.BROKEN ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {device.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={onDelete}
             className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition text-sm font-medium"
           >
             <Trash2 className="w-4 h-4" />
             Delete Device
           </button>
           <button 
            onClick={() => setActiveTab('qr')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition text-sm font-medium"
           >
             <QrCode className="w-4 h-4" />
             View QR
           </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-6">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity className="w-4 h-4" />} label="Overview" />
        <TabButton active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} icon={<Calendar className="w-4 h-4" />} label="Maintenance" />
        <TabButton active={activeTab === 'contracts'} onClick={() => setActiveTab('contracts')} icon={<FileText className="w-4 h-4" />} label="Contracts" />
        <TabButton active={activeTab === 'qr'} onClick={() => setActiveTab('qr')} icon={<QrCode className="w-4 h-4" />} label="QR Identity" />
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
        
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <Section title="General Information">
                <InfoRow label="Manufacturer" value={device.manufacturer} />
                <InfoRow label="Department" value={device.department} />
                <InfoRow label="Purchase Date" value={device.purchaseDate} />
                <InfoRow label="Location" value="Main Hospital, 3rd Floor" />
              </Section>
              
              <Section title="Notes">
                <p className="text-slate-600 text-sm leading-relaxed">
                  {device.notes || "No additional notes provided."}
                </p>
              </Section>
            </div>
            
            <div className="space-y-6">
               <Section title="Files & Manuals">
                 {device.files.length === 0 ? (
                   <div className="text-slate-400 text-sm italic py-4">No files attached.</div>
                 ) : (
                   <ul className="space-y-2">
                     {device.files.map(f => (
                       <li key={f.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg group hover:border-blue-300 transition-colors">
                         <div className="flex items-center gap-3">
                           <FileText className="w-5 h-5 text-blue-500" />
                           <div>
                             <a 
                               href={f.url} 
                               className="text-sm font-medium text-slate-800 hover:text-blue-600 hover:underline cursor-pointer block"
                               onClick={(e) => handleOpenFile(e, f)}
                             >
                               {f.name}
                             </a>
                             <p className="text-xs text-slate-500">{f.type.toUpperCase()} • {f.dateAdded}</p>
                           </div>
                         </div>
                         <button 
                           onClick={(e) => handleOpenFile(e, f)}
                           className="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-slate-50"
                         >
                           <Download className="w-4 h-4" />
                         </button>
                       </li>
                     ))}
                   </ul>
                 )}
                 <input 
                   type="file" 
                   ref={fileInputRef} 
                   className="hidden" 
                   onChange={handleFileSelect}
                 />
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   disabled={uploadingFile}
                   className="mt-4 w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-500 hover:text-blue-500 text-sm transition font-medium disabled:opacity-50 disabled:cursor-wait"
                 >
                   {uploadingFile ? "Encoding & Saving..." : "+ Upload Document (Max 1MB)"}
                 </button>
               </Section>
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
               <h3 className="text-lg font-semibold text-slate-800">Maintenance History</h3>
               <button 
                 onClick={handleSuggestMaintenance}
                 disabled={isAnalyzing}
                 className="flex items-center gap-2 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-200"
               >
                 <Wand2 className="w-4 h-4" />
                 {isAnalyzing ? "Analyzing..." : "AI Suggest Schedule"}
               </button>
            </div>

            <div className="space-y-4">
              {device.maintenanceHistory.map(record => (
                <div key={record.id} className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col md:flex-row gap-4 md:items-center justify-between">
                  <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${record.completed ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                      {record.completed ? <ShieldCheck className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{record.type}</h4>
                      <p className="text-sm text-slate-500">{record.description}</p>
                      <p className="text-xs text-slate-400 mt-1">Tech: {record.technician}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">{record.date}</p>
                    {record.nextScheduledDate && (
                      <p className="text-xs text-blue-600 mt-1">Next: {record.nextScheduledDate}</p>
                    )}
                  </div>
                </div>
              ))}
              {device.maintenanceHistory.length === 0 && (
                <div className="text-center py-10 text-slate-500">No maintenance records found.</div>
              )}
            </div>
            
            <button 
              onClick={() => setShowMaintenanceModal(true)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              <Plus className="w-4 h-4" /> Schedule New Maintenance
            </button>

            {/* Maintenance Modal */}
            {showMaintenanceModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800">Schedule Maintenance</h3>
                    <button onClick={() => setShowMaintenanceModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                        <input 
                          type="date" 
                          className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={maintenanceForm.date}
                          onChange={e => setMaintenanceForm({...maintenanceForm, date: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                        <select 
                          className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                          value={maintenanceForm.type}
                          onChange={e => setMaintenanceForm({...maintenanceForm, type: e.target.value as MaintenanceType})}
                        >
                          {Object.values(MaintenanceType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Technician</label>
                      <input 
                        type="text" 
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Technician Name"
                        value={maintenanceForm.technician}
                        onChange={e => setMaintenanceForm({...maintenanceForm, technician: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                      <textarea 
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        rows={3}
                        placeholder="Maintenance details..."
                        value={maintenanceForm.description}
                        onChange={e => setMaintenanceForm({...maintenanceForm, description: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="flex items-center gap-2 pt-6">
                          <input 
                            type="checkbox" 
                            id="completed"
                            checked={maintenanceForm.completed}
                            onChange={e => setMaintenanceForm({...maintenanceForm, completed: e.target.checked})}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <label htmlFor="completed" className="text-sm text-slate-700">Mark as Completed</label>
                       </div>
                       <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Next Scheduled</label>
                        <input 
                          type="date" 
                          className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={maintenanceForm.nextScheduledDate}
                          onChange={e => setMaintenanceForm({...maintenanceForm, nextScheduledDate: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="pt-4 flex gap-3">
                      <button 
                        onClick={() => setShowMaintenanceModal(false)}
                        className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSaveMaintenance}
                        className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                      >
                        Save Record
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'contracts' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">Service Contracts</h3>
              <button 
                onClick={() => {
                   setEditingContractId(null);
                   setManualContractForm(initialContractForm);
                   setShowContractModal(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" /> Add Contract
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {device.contracts.map(contract => (
                <div key={contract.id} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                       {contract.name && <h4 className="font-bold text-slate-800 text-lg">{contract.name}</h4>}
                       <div className="flex items-center gap-2 mt-1">
                         <span className="text-sm font-medium text-slate-600">{contract.provider}</span>
                         <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">#{contract.contractNumber}</span>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-sm text-slate-500">Expires</p>
                       <p className="font-semibold text-slate-900">{contract.endDate}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-slate-500 block">Coverage</span>
                      <span className="text-slate-800">{contract.coverageDetails}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Contact</span>
                      <span className="text-slate-800">{contract.contactPhone || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                     <span className="text-sm font-medium text-slate-600">Annual Cost: ${contract.annualCost.toLocaleString()}</span>
                     <div className="flex items-center gap-2">
                       <button 
                         onClick={() => handleEditContract(contract)}
                         className="text-blue-500 hover:text-blue-600 text-sm flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition"
                       >
                         <Edit2 className="w-3 h-3" /> Edit
                       </button>
                       <button 
                         onClick={() => handleDeleteContract(contract.id)}
                         className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition"
                       >
                         <Trash2 className="w-3 h-3" /> Remove
                       </button>
                     </div>
                  </div>
                </div>
              ))}
              {device.contracts.length === 0 && (
                <div className="text-center py-10 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  No contracts found. Add one manually or use AI extraction.
                </div>
              )}
            </div>
            
            {showContractModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-fade-in overflow-y-auto max-h-[90vh]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">
                      {editingContractId ? "Edit Service Contract" : "Add Service Contract"}
                    </h3>
                    <button onClick={closeContractModal}><X className="w-5 h-5" /></button>
                  </div>
                  <div className="space-y-6">
                    {/* AI Section - Hide when editing to keep UI simple */}
                    {!editingContractId && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <p className="text-sm text-blue-800 font-medium mb-2 flex items-center gap-2">
                          <Wand2 className="w-4 h-4" /> AI Assistant
                        </p>
                        <p className="text-xs text-blue-600 mb-3">Paste the raw text from a PDF or email contract, and AI will extract the details.</p>
                        <textarea 
                          className="w-full h-24 p-3 text-sm border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Paste contract text here..."
                          value={contractText}
                          onChange={(e) => setContractText(e.target.value)}
                        />
                        <button 
                          onClick={handleAnalyzeContract}
                          disabled={isAnalyzing || !contractText}
                          className="mt-2 w-full py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isAnalyzing ? "Extracting Data..." : "Auto-Fill with AI"}
                        </button>
                      </div>
                    )}

                    {!editingContractId && (
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-500">Or enter manually</span></div>
                      </div>
                    )}

                    {/* Manual Form */}
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1">Contract Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Gold Service Plan" 
                          className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                          value={manualContractForm.name}
                          onChange={e => setManualContractForm({...manualContractForm, name: e.target.value})}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-xs font-medium text-slate-500 block mb-1">Firm / Provider</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Siemens" 
                              className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                              value={manualContractForm.provider}
                              onChange={e => setManualContractForm({...manualContractForm, provider: e.target.value})}
                            />
                         </div>
                         <div>
                            <label className="text-xs font-medium text-slate-500 block mb-1">Annual Cost ($)</label>
                            <input 
                              type="number" 
                              placeholder="0.00" 
                              className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                              value={manualContractForm.annualCost}
                              onChange={e => setManualContractForm({...manualContractForm, annualCost: e.target.value})}
                            />
                         </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-slate-500 block mb-1">Start Date</label>
                          <input 
                            type="date" 
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                            value={manualContractForm.startDate}
                            onChange={e => setManualContractForm({...manualContractForm, startDate: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 block mb-1">End Date</label>
                          <input 
                            type="date" 
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                            value={manualContractForm.endDate}
                            onChange={e => setManualContractForm({...manualContractForm, endDate: e.target.value})}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                           <label className="text-xs font-medium text-slate-500 block mb-1">Contact Phone</label>
                           <input 
                              type="text" 
                              placeholder="e.g. 555-0123" 
                              className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                              value={manualContractForm.contactPhone}
                              onChange={e => setManualContractForm({...manualContractForm, contactPhone: e.target.value})}
                           />
                        </div>
                         <div>
                           <label className="text-xs font-medium text-slate-500 block mb-1">Coverage Details</label>
                           <textarea 
                              placeholder="Details about what is covered..." 
                              className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                              rows={2}
                              value={manualContractForm.coverageDetails}
                              onChange={e => setManualContractForm({...manualContractForm, coverageDetails: e.target.value})}
                           />
                        </div>
                      </div>

                      <button 
                        onClick={handleSaveManualContract}
                        className="w-full py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition"
                      >
                        {editingContractId ? "Update Contract" : "Add Contract"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'qr' && (
          <div className="flex flex-col items-center justify-center h-full py-10 space-y-6 animate-fade-in">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 flex flex-col items-center">
              <h3 className="text-xl font-bold text-slate-800 mb-6">{device.name}</h3>
              <div className="border-4 border-slate-900 p-2 rounded-lg">
                <img src={qrCodeUrl} alt="Device QR Code" className="w-48 h-48 object-contain" />
              </div>
              <p className="mt-6 text-sm text-slate-500 text-center max-w-xs">
                Scan this code to access full device history, maintenance logs, and manuals instantly.
              </p>
              <div className="mt-2 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 max-w-sm truncate text-center">
                 {qrData}
              </div>
              <div className="mt-6 flex gap-3">
                 <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                   <Download className="w-4 h-4" /> Save Image
                 </button>
                 <button 
                  onClick={() => window.open(qrCodeUrl, '_blank')}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium"
                 >
                   <ExternalLink className="w-4 h-4" /> Open Link
                 </button>
              </div>
            </div>
            <div className="text-center text-xs text-slate-400">
              ID: {device.id}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
      active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
    }`}
  >
    {icon}
    {label}
  </button>
);

const Section = ({ title, children }: { title: string, children?: React.ReactNode }) => (
  <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4 border-b border-slate-100 pb-2">{title}</h3>
    {children}
  </div>
);

const InfoRow = ({ label, value }: { label: string, value: string }) => (
  <div className="flex justify-between py-2 border-b border-slate-50 last:border-0">
    <span className="text-slate-500 text-sm">{label}</span>
    <span className="text-slate-900 font-medium text-sm">{value}</span>
  </div>
);

export default DeviceDetail;