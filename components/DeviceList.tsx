
import React, { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { MedicalDevice, DeviceStatus, HOSPITAL_DEPARTMENTS, DEVICE_CATEGORIES, DeviceCategory } from '../types';
import { Search, Eye, Trash2, Box, FileSpreadsheet, Download, Edit2, X, Check, ChevronDown, Calendar, Info, Filter, PlusCircle, ShieldAlert, Hash, Fingerprint, AlertCircle, ShieldOff, RotateCcw, Layers, Loader2, FileText, Save, Building2, Tag, Plus } from 'lucide-react';

interface DeviceListProps {
  devices: MedicalDevice[];
  onSelectDevice: (device: MedicalDevice) => void;
  onUpdateDevice: (device: MedicalDevice) => void;
  onBulkUpdate: (devices: MedicalDevice[]) => void;
  onAddDevice: () => void;
  onDelete: (id: string) => void;
  searchQuery?: string;
}

const StatusBadge = React.memo(({ status }: { status: DeviceStatus }) => {
  let styles = "bg-slate-100 text-slate-700 border-slate-200";
  let dot = "bg-slate-400";
  switch(status) {
    case DeviceStatus.ACTIVE: 
      styles = "bg-emerald-50 text-emerald-700 border-emerald-100"; 
      dot = "bg-emerald-500";
      break;
    case DeviceStatus.MAINTENANCE: 
      styles = "bg-amber-50 text-amber-700 border-amber-100"; 
      dot = "bg-amber-500";
      break;
    case DeviceStatus.BROKEN: 
      styles = "bg-red-50 text-red-700 border-red-100"; 
      dot = "bg-red-500";
      break;
    case DeviceStatus.RETIRED: 
      styles = "bg-slate-100 text-slate-500 border-slate-200"; 
      dot = "bg-slate-300";
      break;
  }
  return (
    <span className={`px-3 py-1.5 rounded-xl tech-label text-[8px] border flex items-center gap-2 w-fit ${styles}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dot} ${status === DeviceStatus.ACTIVE ? 'animate-pulse' : ''}`} />
      {status}
    </span>
  );
});

const DeviceCard = React.memo(({ 
  device, 
  isSelected, 
  onToggleSelection, 
  onSelect, 
  onQuickEdit, 
  onDelete 
}: { 
  device: MedicalDevice, 
  isSelected: boolean, 
  onToggleSelection: (id: string) => void, 
  onSelect: (device: MedicalDevice) => void, 
  onQuickEdit: (e: React.MouseEvent, device: MedicalDevice) => void, 
  onDelete: (e: React.MouseEvent, id: string) => void 
}) => {
  return (
    <div
      className={`bg-white border border-slate-200 shadow-sm relative overflow-hidden rounded group flex flex-col md:flex-row items-center gap-6 p-6 transition-shadow transition-transform duration-200 hover:shadow-md hover:-translate-y-0.5 border-l-4 ${isSelected ? 'border-l-blue-600 bg-blue-50/30' : 'border-l-transparent hover:border-l-blue-400'}`}
    >
      {/* Selection Checkbox */}
      <div className="absolute top-6 left-6 md:static">
        <input 
          type="checkbox" 
          className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 cursor-pointer focus:ring-blue-500 transition-colors" 
          checked={isSelected} 
          onChange={() => onToggleSelection(device.id)} 
        />
      </div>

      {/* Asset Image/Icon */}
      <div 
        className="w-24 h-24 md:w-20 md:h-20 rounded-2xl bg-white border border-slate-100 overflow-hidden flex items-center justify-center relative shadow-sm group-hover:scale-105 transition-transform shrink-0 cursor-pointer"
        onClick={() => onSelect(device)}
      >
        {device.image ? (
          <img src={device.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <Box className="w-10 h-10 text-slate-200" />
        )}
        {device.isCNCAN && (
          <div className="absolute top-0 right-0 p-1.5 bg-amber-500 rounded-bl-xl shadow-sm">
            <ShieldAlert className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>

      {/* Asset Info */}
      <div className="flex-1 min-w-0 cursor-pointer space-y-2" onClick={() => onSelect(device)}>
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
          <h3 className="font-black text-slate-900 text-xl md:text-lg leading-tight truncate group-hover:text-blue-600 transition-colors uppercase tracking-tight">
            {device.name || 'Unnamed Asset'}
          </h3>
          <div className="flex items-center gap-2">
            <StatusBadge status={device.status || DeviceStatus.ACTIVE} />
            <span className="px-3 py-1 bg-slate-100 rounded-lg tech-label text-[9px] text-slate-600 border border-slate-200">
              {device.department || 'N/A'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="tech-label text-[10px] text-slate-500 uppercase tracking-wider font-bold">MFR:</span>
            <span className="text-xs font-black text-slate-700">{device.manufacturer || 'Unknown'}</span>
          </div>
          <div className="w-1 h-1 bg-slate-200 rounded-full hidden md:block" />
          <div className="flex items-center gap-2">
            <span className="tech-label text-[10px] text-slate-500 uppercase tracking-wider font-bold">MODEL:</span>
            <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{device.model || 'N/A'}</span>
          </div>
          <div className="w-1 h-1 bg-slate-200 rounded-full hidden md:block" />
          <div className="flex items-center gap-2">
            <span className="tech-label text-[10px] text-slate-500 uppercase tracking-wider font-bold">SN:</span>
            <span className="text-xs font-mono font-black text-slate-900 tracking-tighter">{device.serialNumber || 'N/A'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-wider">
            <Layers className="w-3 h-3" /> {device.category || 'Altele'}
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ID: {device.id.slice(0, 12)}...</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex md:flex-col gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 w-full md:w-auto justify-center z-[100]">
        <button 
          className="flex-1 md:flex-none p-3.5 bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 shadow-sm border border-slate-200 rounded-2xl transition-colors active:scale-90 flex items-center justify-center gap-2"
          onClick={(e) => onQuickEdit(e, device)}
          title="Quick Edit"
        >
          <Edit2 className="w-4 h-4" />
          <span className="md:hidden tech-label text-[10px]">Edit</span>
        </button>
        <button 
          className="flex-1 md:flex-none p-3.5 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 shadow-sm border border-slate-200 rounded-2xl transition-colors active:scale-90 flex items-center justify-center gap-2"
          onClick={(e) => onDelete(e, device.id)}
          title="Purge Asset"
        >
          <Trash2 className="w-4 h-4" />
          <span className="md:hidden tech-label text-[10px]">Purge</span>
        </button>
      </div>
    </div>
  );
});

const PAGE_SIZE = 15;

const DeviceList: React.FC<DeviceListProps> = ({ devices, onSelectDevice, onUpdateDevice, onBulkUpdate, onAddDevice, onDelete, searchQuery: externalSearch = '' }) => {
  const [filterStatus, setFilterStatus] = useState<DeviceStatus | 'ALL'>('ALL');
  const [filterDept, setFilterDept] = useState<string | 'ALL'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string | 'ALL'>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingDevice, setEditingDevice] = useState<MedicalDevice | null>(null);
  
  const [quickEditForm, setQuickEditForm] = useState({
    name: '',
    serialNumber: '',
    department: '',
    status: DeviceStatus.ACTIVE,
  });

  // Dynamic department list from existing fleet + static list
  const allAvailableDepartments = useMemo(() => {
    const existingDepts = (devices || []).map(d => d.department).filter(Boolean);
    const combined = Array.from(new Set([...HOSPITAL_DEPARTMENTS, ...existingDepts])).sort();
    return combined;
  }, [devices]);

  const effectiveSearch = (localSearch || externalSearch).toLowerCase().trim();

  // Reset to page 1 when filters change
  const resetPage = useCallback(() => setPage(1), []);

  const filteredDevices = useMemo(() => {
    if (!devices) return [];
    return devices.filter(d => {
      const name = (d.name || '').toLowerCase();
      const sn = (d.serialNumber || '').toLowerCase();
      const mfr = (d.manufacturer || '').toLowerCase();
      const model = (d.model || '').toLowerCase();
      const dept = (d.department || '').toLowerCase();
      const cat = (d.category || '').toLowerCase();

      const matchSearch = !effectiveSearch || 
        name.includes(effectiveSearch) || 
        sn.includes(effectiveSearch) ||
        mfr.includes(effectiveSearch) ||
        model.includes(effectiveSearch) ||
        dept.includes(effectiveSearch) ||
        cat.includes(effectiveSearch);
      
      const matchStatus = filterStatus === 'ALL' || d.status === filterStatus;
      const matchDept = filterDept === 'ALL' || d.department === filterDept;
      const matchCategory = filterCategory === 'ALL' || d.category === filterCategory;
      
      return matchSearch && matchStatus && matchDept && matchCategory;
    });
  }, [devices, effectiveSearch, filterStatus, filterDept, filterCategory]);

  const pagedDevices = useMemo(() => filteredDevices.slice(0, page * PAGE_SIZE), [filteredDevices, page]);
  const hasMore = filteredDevices.length > page * PAGE_SIZE;

  const handleOpenQuickEdit = useCallback((e: React.MouseEvent, device: MedicalDevice) => {
    e.preventDefault();
    e.stopPropagation();
    
    setEditingDevice(device);
    setQuickEditForm({
      name: device.name || '',
      serialNumber: device.serialNumber || '',
      department: device.department || HOSPITAL_DEPARTMENTS[0],
      status: device.status || DeviceStatus.ACTIVE,
    });
  }, []);

  const handleQuickEditChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setQuickEditForm(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSaveQuickEdit = useCallback(async () => {
    if (!editingDevice) return;
    const updated: MedicalDevice = { ...editingDevice, ...quickEditForm };
    await onUpdateDevice(updated);
    setEditingDevice(null);
  }, [editingDevice, quickEditForm, onUpdateDevice]);

  const handleDeleteClick = useCallback((e: React.MouseEvent, deviceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(deviceId);
  }, [onDelete]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="space-y-8 pb-24 relative">
      {/* QUICK EDIT OVERLAY */}
      {editingDevice && (
        <div className="fixed inset-0 z-[500] bg-slate-900/40 flex items-center justify-center p-4">
          <div className="hardware-card p-10 w-full max-w-xl rounded-[2.5rem] shadow-2xl animate-slide-up">
             <div className="flex justify-between items-center mb-8">
                <div>
                   <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Registry Quick Update</h3>
                   <p className="tech-label mt-1">ID: {editingDevice.id}</p>
                </div>
                <button onClick={() => setEditingDevice(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition text-slate-400"><X className="w-6 h-6" /></button>
             </div>
             
             <div className="space-y-6 mb-10">
                <div className="space-y-1">
                   <label className="tech-label ml-1">Asset Nomenclature</label>
                   <input name="name" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={quickEditForm.name} onChange={handleQuickEditChange} />
                </div>
                <div className="space-y-1">
                   <label className="tech-label ml-1">Serial Identifier</label>
                   <input name="serialNumber" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={quickEditForm.serialNumber} onChange={handleQuickEditChange} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="tech-label ml-1">Unit Assignment</label>
                    <div className="relative">
                      <select name="department" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold appearance-none outline-none focus:border-blue-500 transition-colors" value={quickEditForm.department} onChange={handleQuickEditChange}>
                          {allAvailableDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="tech-label ml-1">Registry Status</label>
                    <select name="status" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" value={quickEditForm.status} onChange={handleQuickEditChange}>
                        {Object.values(DeviceStatus).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>
             </div>

             <div className="flex gap-4">
                <button onClick={() => setEditingDevice(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition">Discard</button>
                <button onClick={handleSaveQuickEdit} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition active:scale-95 flex items-center justify-center gap-3">
                   <Save className="w-5 h-5" /> Commit Data
                </button>
             </div>
          </div>
        </div>
      )}

      {/* FILTER CONTROLS */}
      <div className="hardware-card p-8 rounded-[2.5rem] flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row items-center gap-4 w-full">
          <div className="relative flex-1 w-full group">
            <Search className={`absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${effectiveSearch ? 'text-blue-600' : 'text-slate-300'}`} />
            <input 
              type="text"
              placeholder="Search registry by name, category, serial, or unit..."
              className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500/20 focus:bg-white rounded-2xl text-sm font-bold focus:outline-none transition-colors shadow-inner"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={() => { setLocalSearch(''); setFilterStatus('ALL'); setFilterDept('ALL'); setFilterCategory('ALL'); resetPage(); }}
            className="px-4 py-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-blue-600 hover:bg-blue-50 transition-colors shadow-inner flex items-center justify-center"
            title="Reset Filters"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 w-full">
          <div className="space-y-1">
            <label className="tech-label ml-1">Department</label>
            <select className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-blue-500/20 rounded-xl text-[10px] font-black text-slate-700 outline-none uppercase tracking-wider shadow-inner" value={filterDept} onChange={(e) => { setFilterDept(e.target.value); resetPage(); }}>
              <option value="ALL">ALL DEPTS</option>
              {allAvailableDepartments.map(dept => <option key={dept} value={dept}>{dept.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="tech-label ml-1">Category</label>
            <select className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-blue-500/20 rounded-xl text-[10px] font-black text-slate-700 outline-none uppercase tracking-wider shadow-inner" value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); resetPage(); }}>
              <option value="ALL">ALL CATEGORIES</option>
              {DEVICE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="tech-label ml-1">Status</label>
            <select className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-blue-500/20 rounded-xl text-[10px] font-black text-slate-700 outline-none uppercase tracking-wider shadow-inner" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value as any); resetPage(); }}>
              <option value="ALL">ALL STATUSES</option>
              {Object.values(DeviceStatus).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-8 py-2">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 px-3 py-1 rounded-lg text-white font-mono text-xs font-black">
              {filteredDevices.length}
            </div>
            <span className="tech-label">Assets Identified</span>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-4">
               <span className="tech-label text-blue-600 font-black">{selectedIds.size} Selected</span>
               <button className="px-4 py-2 bg-red-50 text-red-600 rounded-xl tech-label hover:bg-red-100 transition-colors border border-red-100">Bulk Purge</button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {pagedDevices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              isSelected={selectedIds.has(device.id)}
              onToggleSelection={toggleSelection}
              onSelect={onSelectDevice}
              onQuickEdit={handleOpenQuickEdit}
              onDelete={handleDeleteClick}
            />
          ))}
          {hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="w-full py-4 bg-slate-50 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              Load More ({filteredDevices.length - page * PAGE_SIZE} remaining)
            </button>
          )}

          {filteredDevices.length === 0 && (
            <div className="hardware-card py-32 text-center rounded-[2.5rem]">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100">
                <Box className="w-10 h-10 text-slate-200" />
              </div>
              <p className="tech-label mb-8 text-slate-400">No matching assets found in the registry</p>
              <button 
                onClick={onAddDevice}
                className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-600 transition flex items-center gap-3 mx-auto active:scale-95"
              >
                <Plus className="w-5 h-5" /> Register New Asset
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(DeviceList);
