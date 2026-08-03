import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { MedicalDevice, MaintenanceRecord, MaintenanceType, DeviceStatus, DEVICE_STATUS_RO } from '../types';
import { 
  Calendar, Check, Clock, Save, CalendarDays, 
  ChevronDown, Search, Filter, ClipboardList, 
  AlertCircle, ArrowRight, Activity, FileSpreadsheet, Download, Box
} from 'lucide-react';

import MaintenanceCalendar from './MaintenanceCalendar';

interface MaintenancePlannerProps {
  devices: MedicalDevice[];
  onApplyPlan: (updatedDevices: MedicalDevice[]) => void;
  onSelectDevice?: (device: MedicalDevice) => void;
}

const MONTHS = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
];

// Stored values stay in English; Romanian labels are display-only
const FREQUENCY_OPTIONS = [
  'Monthly',
  'Quarterly',
  'Bi-Annually',
  'Annually',
  'Biennially',
  'On-Demand'
];

const FREQUENCY_RO: Record<string, string> = {
  'Monthly': 'Lunar',
  'Quarterly': 'Trimestrial',
  'Bi-Annually': 'Semestrial',
  'Annually': 'Anual',
  'Biennially': 'La 2 ani',
  'On-Demand': 'La cerere'
};

interface ScheduleDraft {
  deviceId: string;
  nextScheduledDate: string;
  frequency: string;
  tasks: string;
  isModified: boolean;
}

const MaintenancePlanner: React.FC<MaintenancePlannerProps> = ({ devices, onApplyPlan, onSelectDevice }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [drafts, setDrafts] = useState<Record<string, ScheduleDraft>>({});
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');

  // Incremental rendering — mount planner cards in batches while scrolling,
  // instead of the entire fleet at once (heavy: each card holds form controls)
  const BATCH_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) {
        setVisibleCount(c => c + BATCH_SIZE);
      }
    }, { rootMargin: '600px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [viewMode]);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [searchQuery]);

  const handleCalendarReschedule = useCallback((device: MedicalDevice, newDate: string) => {
    onApplyPlan([{ ...device, nextMaintenanceDate: newDate }]);
  }, [onApplyPlan]);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear + i);

  // Only add drafts for newly added devices; preserve existing user edits
  useEffect(() => {
    setDrafts(prev => {
      let changed = false;
      const next = { ...prev };
      devices.forEach(device => {
        if (!next[device.id]) {
          next[device.id] = {
            deviceId: device.id,
            nextScheduledDate: device.nextMaintenanceDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            frequency: 'Annually',
            tasks: 'Inspectie standard de mentenanta preventiva.',
            isModified: false
          };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [devices]);

  const handleUpdateDraft = useCallback((deviceId: string, updates: Partial<ScheduleDraft>) => {
    setDrafts(prev => ({
      ...prev,
      [deviceId]: { ...prev[deviceId], ...updates, isModified: true }
    }));
  }, []);

  const filteredDevices = useMemo(() => {
    const term = (searchQuery || '').toLowerCase().trim();
    if (!term) return devices;

    return devices.filter(d => 
      (d.name || '').toLowerCase().includes(term) || 
      (d.model || '').toLowerCase().includes(term) || 
      (d.serialNumber || '').toLowerCase().includes(term) ||
      (d.department || '').toLowerCase().includes(term)
    );
  }, [devices, searchQuery]);

  const modifiedCount = useMemo(() => 
    (Object.values(drafts) as ScheduleDraft[]).filter(d => d.isModified).length
  , [drafts]);

  const handleExportSchedule = useCallback(async () => {
    if (devices.length === 0) return alert("Nu exista dispozitive de exportat.");
    const XLSX = await import('xlsx');

    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();
    const reportId = `MT-REP-${Math.floor(1000 + Math.random() * 9000)}`;

    // Status aggregation for the header
    const statusCounts = devices.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 1. Prepare Table Data
    const tableHeader = [
      'DENUMIRE DISPOZITIV',
      'PRODUCATOR',
      'MODEL / VERSIUNE',
      'NUMAR SERIE',
      'DEPARTAMENT',
      'LUNA PROGRAMATA',
      'CICLU MENTENANTA',
      'DETALII TEHNICE',
      'STATUS DISPOZITIV'
    ];

    const tableRows = devices.map(device => {
      const draft = drafts[device.id] || { nextScheduledDate: '', frequency: 'N/A', tasks: 'N/A' };
      const serviceDate = new Date(draft.nextScheduledDate);
      const serviceWindow = isNaN(serviceDate.getTime())
        ? 'NEPROGRAMAT'
        : `${MONTHS[serviceDate.getMonth()].toUpperCase()} ${serviceDate.getFullYear()}`;

      return [
        device.name.toUpperCase(),
        device.manufacturer,
        device.model,
        device.serialNumber,
        device.department,
        serviceWindow,
        (FREQUENCY_RO[draft.frequency] || draft.frequency).toUpperCase(),
        draft.tasks,
        (DEVICE_STATUS_RO[device.status] || device.status).toUpperCase()
      ];
    });

    // 2. Construct Aesthetic AOA (Array of Arrays) with detailed summary
    const aoa = [
      ['BIOMEDIC - SISTEM DE MANAGEMENT AL DISPOZITIVELOR MEDICALE'],
      ['PROGRAM DE MENTENANTA SI SERVICE'],
      [''],
      ['SUMAR'],
      [`ID RAPORT: ${reportId}`, ``, `TOTAL DISPOZITIVE: ${devices.length}`],
      [`GENERAT: ${dateStr} ${timeStr}`, ``, `DISPOZITIVE ACTIVE: ${statusCounts[DeviceStatus.ACTIVE] || 0}`],
      [`PREGATIT PENTRU: DEPARTAMENTUL TEHNIC`, ``, `DISPOZITIVE IN SERVICE: ${statusCounts[DeviceStatus.MAINTENANCE] || 0}`],
      [''],
      ['------------------------------------------------------------------------------------------------------------------------------------'],
      [''],
      tableHeader,
      ...tableRows,
      [''],
      ['--- SFARSITUL RAPORTULUI DE SERVICE ---'],
      [''],
      ['NOTA DE CONFIDENTIALITATE: Acest document contine date despre dispozitive medicale. Accesul este restrictionat personalului autorizat.'],
      ['Biomedic | Date proprietare infrastructura clinica']
    ];

    try {
      const worksheet = XLSX.utils.aoa_to_sheet(aoa);

      // 3. Apply Professional Sheet Configurations (Cols & Rows)
      
      // Column widths based on header and data content with extra padding for aesthetics
      const colWidths = tableHeader.map((_, colIndex) => {
        let maxLen = tableHeader[colIndex].length;
        tableRows.forEach(row => {
          const val = row[colIndex] ? String(row[colIndex]).length : 0;
          if (val > maxLen) maxLen = val;
        });
        return { wch: Math.min(Math.max(maxLen + 6, 20), 65) }; 
      });
      worksheet['!cols'] = colWidths;

      // Row heights (Create visual hierarchy)
      const rowHeights = [
        { hpt: 25 }, // System Header
        { hpt: 35 }, // Title (Large)
        { hpt: 10 }, // Spacer
        { hpt: 20 }, // Executive Summary label
        { hpt: 18 }, // Summary Row 1
        { hpt: 18 }, // Summary Row 2
        { hpt: 18 }, // Summary Row 3
        { hpt: 10 }, // Spacer
        { hpt: 12 }, // Separator Line
        { hpt: 15 }, // Spacer
        { hpt: 30 }, // Main Table Headers (Taller/Deeper for visibility)
      ];
      worksheet['!rows'] = rowHeights;

      // 4. Create Workbook and Download
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Raport");
      
      const fileDate = now.toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Biomedic_Raport_Echipamente_${fileDate}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Generarea raportului a esuat. Verificati daca pop-up-urile sunt permise in browser.");
    }
  }, [devices, drafts]);

  const commitAllSchedules = useCallback(() => {
    if (modifiedCount === 0) {
      alert("Nu exista modificari de aplicat.");
      return;
    }

    const updatedDevices = devices.map(device => {
      const draft = drafts[device.id] as ScheduleDraft | undefined;
      if (draft && draft.isModified) {
        const newRecord: MaintenanceRecord = {
          id: `SCHED-${Math.floor(Math.random() * 90000)}`,
          date: new Date().toISOString().split('T')[0],
          type: MaintenanceType.PREVENTIVE,
          technician: 'Planificator mentenanta',
          description: `[${draft.frequency}] ${draft.tasks}`,
          nextScheduledDate: draft.nextScheduledDate,
          completed: false
        };
        return {
          ...device,
          maintenanceHistory: [newRecord, ...device.maintenanceHistory],
          nextMaintenanceDate: draft.nextScheduledDate
        };
      }
      return device;
    });

    onApplyPlan(updatedDevices);
    alert(`Programarile au fost aplicate cu succes pentru ${modifiedCount} dispozitive.`);
  }, [devices, drafts, modifiedCount, onApplyPlan]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header & Global Controls */}
      <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col 2xl:flex-row items-stretch 2xl:items-center justify-between gap-6 sm:gap-8">
        <div className="flex-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-4 tracking-tight">
            <div className="p-3 sm:p-4 shrink-0 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
              <CalendarDays className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            Planificator Mentenanta
          </h2>
          <p className="text-slate-500 mt-2 font-medium max-w-xl text-sm">
            Programeaza manual interventiile de service si protocoalele de mentenanta pentru echipamente.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch gap-3 sm:gap-4 w-full 2xl:w-auto">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl shrink-0">
            <button onClick={() => setViewMode('LIST')}
              className={`px-5 py-3 rounded-xl text-[11px] font-bold transition ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow' : 'text-slate-400'}`}>
              Lista
            </button>
            <button onClick={() => setViewMode('CALENDAR')}
              className={`px-5 py-3 rounded-xl text-[11px] font-bold transition ${viewMode === 'CALENDAR' ? 'bg-white text-slate-900 shadow' : 'text-slate-400'}`}>
              Calendar
            </button>
          </div>
          <div className="relative flex-1 sm:min-w-[240px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
            <input 
              type="text"
              placeholder="Cauta dupa nume, model, serie sau departament..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none text-sm font-bold shadow-inner"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button 
              onClick={handleExportSchedule}
              className="px-4 sm:px-6 py-3.5 sm:py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold text-[13px] hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-5 h-5" /> Exporta Program
            </button>
            <button 
              onClick={commitAllSchedules}
              disabled={modifiedCount === 0}
              className={`px-5 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-bold text-[13px] transition-all flex items-center justify-center gap-2 sm:gap-3 shadow-2xl active:scale-95 whitespace-nowrap ${
                modifiedCount > 0 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-5 h-5" /> Aplica Tot ({modifiedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'CALENDAR' && (
        <MaintenanceCalendar
          devices={devices}
          onReschedule={handleCalendarReschedule}
          onSelectDevice={onSelectDevice}
        />
      )}

      {/* Planning Grid */}
      {viewMode === 'LIST' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
        {filteredDevices.slice(0, visibleCount).map(device => (
          <MaintenanceCard
            key={device.id}
            device={device}
            draft={drafts[device.id]}
            onUpdateDraft={handleUpdateDraft}
          />
        ))}

        {/* Sentinel — loads the next batch when scrolled into view */}
        <div ref={sentinelRef} className="h-1 col-span-full" />
        {visibleCount < filteredDevices.length && (
          <div className="col-span-full py-6 flex items-center justify-center gap-3 text-slate-400">
            <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-[11px] font-bold">Se incarca... {Math.min(visibleCount, filteredDevices.length)} / {filteredDevices.length}</span>
          </div>
        )}

        {filteredDevices.length === 0 && (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-center">
            <div className="p-8 bg-slate-50 rounded-full mb-6">
              <ClipboardList className="w-16 h-16 text-slate-200" />
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Niciun dispozitiv gasit</h3>
            <p className="text-sm text-slate-400 mt-2 font-medium max-w-xs">Ajusteaza cautarea sau adauga dispozitive noi in inventar pentru a incepe planificarea.</p>
          </div>
        )}
      </div>
      )}

      {/* Footer Status Bar */}
      {modifiedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-3xl shadow-2xl border border-white/10 flex items-center gap-8 z-50 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black">
              {modifiedCount}
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 leading-none mb-1">Modificari in asteptare</p>
              <p className="text-sm font-bold leading-none">Modificari pregatite</p>
            </div>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <button 
            onClick={commitAllSchedules}
            className="px-6 py-2 bg-white text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition active:scale-95 flex items-center gap-2"
          >
            Aplica Acum <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

const MaintenanceCard = React.memo(({ 
  device, 
  draft: initialDraft, 
  onUpdateDraft 
}: { 
  device: MedicalDevice, 
  draft: ScheduleDraft | undefined, 
  onUpdateDraft: (deviceId: string, updates: Partial<ScheduleDraft>) => void 
}) => {
  const draft = initialDraft || ({ 
    nextScheduledDate: '', 
    frequency: 'Annually', 
    tasks: '', 
    isModified: false 
  } as ScheduleDraft);

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => Array.from({ length: 11 }, (_, i) => currentYear + i), [currentYear]);

  // Parse current date to get month and year indices
  const currentDate = new Date(draft.nextScheduledDate || Date.now());
  const selectedMonth = currentDate.getMonth(); // 0-11
  const selectedYear = currentDate.getFullYear();

  const handleDatePartChange = useCallback((part: 'month' | 'year', value: number) => {
    const newDate = new Date(draft.nextScheduledDate || Date.now());
    if (part === 'month') newDate.setMonth(value);
    if (part === 'year') newDate.setFullYear(value);
    // Normalize to 1st of month
    newDate.setDate(1);
    onUpdateDraft(device.id, { nextScheduledDate: newDate.toISOString().split('T')[0] });
  }, [draft.nextScheduledDate, device.id, onUpdateDraft]);

  return (
    <div 
      className={`bg-white p-6 rounded-[2.5rem] border-2 transition-all relative overflow-hidden group flex flex-col ${
        draft.isModified 
          ? 'border-blue-400 shadow-2xl shadow-blue-500/10 bg-blue-50/10' 
          : 'border-slate-100 shadow-sm hover:border-slate-200'
      }`}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1">
          <h4 className="font-black text-slate-900 text-lg leading-tight break-words">{device.name}</h4>
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex items-center gap-2 text-[11px] font-bold text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded-md uppercase tracking-widest">
              <Box className="w-3 h-3" /> Model: {device.model || 'N/A'}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{device.department || 'Necunoscut'}</span>
              <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
              <span className="text-[11px] font-mono text-slate-400 font-bold">SN: {device.serialNumber || 'N/A'}</span>
            </div>
          </div>
        </div>
        {draft.isModified && (
          <div className="bg-blue-600 text-white p-1.5 rounded-lg animate-pulse shrink-0 ml-2">
            <Check className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="space-y-6 flex-1">
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block ml-1">Data Programata</label>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <select 
                value={selectedMonth}
                onChange={(e) => handleDatePartChange('month', parseInt(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 px-3 py-3 rounded-xl text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer focus:border-blue-500 transition-all"
              >
                {MONTHS.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select 
                value={selectedYear}
                onChange={(e) => handleDatePartChange('year', parseInt(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 px-3 py-3 rounded-xl text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer focus:border-blue-500 transition-all"
              >
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block ml-1">Frecventa</label>
          <div className="relative">
            <select 
              value={draft.frequency}
              onChange={(e) => onUpdateDraft(device.id, { frequency: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer focus:border-blue-500 transition-all"
            >
              {FREQUENCY_OPTIONS.map(opt => <option key={opt} value={opt}>{FREQUENCY_RO[opt] || opt}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block ml-1">Protocol Service / Sarcini</label>
          <textarea
            value={draft.tasks}
            onChange={(e) => onUpdateDraft(device.id, { tasks: e.target.value })}
            placeholder="Descrie calibrarea, curatarea sau inlocuirea pieselor..."
            className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs font-medium text-slate-600 min-h-[80px] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all resize-none placeholder:text-slate-300"
          />
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">Stare dispozitiv: Nominala</span>
        </div>
        {!draft.isModified && (
          <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest italic">Nemodificat</span>
        )}
      </div>
    </div>
  );
});

export default MaintenancePlanner;
