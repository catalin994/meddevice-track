
import React, { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Cpu, X, CalendarDays } from 'lucide-react';
import { MedicalDevice } from '../types';

interface MaintenanceCalendarProps {
  devices: MedicalDevice[];
  onReschedule: (device: MedicalDevice, newDate: string) => void;
  onSelectDevice?: (device: MedicalDevice) => void;
}

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sa', 'Du'];
const MONTH_NAMES = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

const toKey = (d: Date) => d.toISOString().split('T')[0];

const MaintenanceCalendar: React.FC<MaintenanceCalendarProps> = ({ devices, onReschedule, onSelectDevice }) => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // Devices grouped by scheduled maintenance date
  const byDate = useMemo(() => {
    const map = new Map<string, MedicalDevice[]>();
    devices.forEach(d => {
      if (!d.nextMaintenanceDate) return;
      const key = d.nextMaintenanceDate.split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return map;
  }, [devices]);

  // Build the visible grid: pad to Monday-start weeks
  const weeks = useMemo(() => {
    const first = new Date(year, month, 1);
    const startPad = (first.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [
      ...Array.from({ length: startPad }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(Date.UTC(year, month, i + 1))),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [year, month]);

  const navigate = useCallback((dir: 1 | -1) => {
    setSelectedDay(null);
    setMonth(m => {
      const next = m + dir;
      if (next < 0) { setYear(y => y - 1); return 11; }
      if (next > 11) { setYear(y => y + 1); return 0; }
      return next;
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dayKey: string) => {
    e.preventDefault();
    setDragOverDay(null);
    const deviceId = e.dataTransfer.getData('text/device-id');
    const device = devices.find(d => d.id === deviceId);
    if (device && device.nextMaintenanceDate?.split('T')[0] !== dayKey) {
      onReschedule(device, dayKey);
    }
  }, [devices, onReschedule]);

  const monthTotal = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    let count = 0;
    byDate.forEach((list, key) => { if (key.startsWith(prefix)) count += list.length; });
    return count;
  }, [byDate, year, month]);

  const todayKey = toKey(today);
  const selectedDevices = selectedDay ? (byDate.get(selectedDay) || []) : [];

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
      {/* Calendar header */}
      <div className="p-6 sm:p-8 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><CalendarDays className="w-5 h-5" /></div>
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{MONTH_NAMES[month]} {year}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{monthTotal} mentenante programate</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2.5 bg-slate-50 text-slate-500 hover:text-slate-900 rounded-xl transition"><ChevronLeft className="w-5 h-5" /></button>
          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(null); }}
            className="px-4 py-2.5 bg-slate-50 text-slate-500 hover:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition">Azi</button>
          <button onClick={() => navigate(1)} className="p-2.5 bg-slate-50 text-slate-500 hover:text-slate-900 rounded-xl transition"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map(w => <p key={w} className="text-center text-[9px] font-black text-slate-300 uppercase tracking-widest py-2">{w}</p>)}
        </div>
        <div className="space-y-1.5">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1.5">
              {week.map((day, di) => {
                if (!day) return <div key={di} className="min-h-[84px] rounded-2xl bg-slate-50/40" />;
                const key = toKey(day);
                const dayDevices = byDate.get(key) || [];
                const isToday = key === todayKey;
                const isSelected = key === selectedDay;
                const isPast = key < todayKey;
                return (
                  <div
                    key={di}
                    onClick={() => setSelectedDay(isSelected ? null : key)}
                    onDragOver={e => { e.preventDefault(); setDragOverDay(key); }}
                    onDragLeave={() => setDragOverDay(d => d === key ? null : d)}
                    onDrop={e => handleDrop(e, key)}
                    className={`min-h-[84px] rounded-2xl border p-1.5 cursor-pointer transition flex flex-col
                      ${dragOverDay === key ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-500/10' :
                        isSelected ? 'border-slate-900 bg-slate-900' :
                        isToday ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                  >
                    <div className="flex items-center justify-between px-1">
                      <span className={`text-[11px] font-black ${isSelected ? 'text-white' : isToday ? 'text-blue-600' : isPast ? 'text-slate-300' : 'text-slate-500'}`}>
                        {day.getUTCDate()}
                      </span>
                      {dayDevices.length > 0 && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : isPast ? 'bg-red-50 text-red-500' : 'bg-blue-600 text-white'}`}>
                          {dayDevices.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5 overflow-hidden">
                      {dayDevices.slice(0, 2).map(d => (
                        <div
                          key={d.id}
                          draggable
                          onDragStart={e => { e.dataTransfer.setData('text/device-id', d.id); e.stopPropagation(); }}
                          title={`${d.name} — trage pe alta zi pentru reprogramare`}
                          className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md truncate cursor-grab active:cursor-grabbing
                            ${isSelected ? 'bg-white/15 text-white' : isPast ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}
                        >
                          {d.name}
                        </div>
                      ))}
                      {dayDevices.length > 2 && (
                        <p className={`text-[8px] font-black px-1.5 ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>+{dayDevices.length - 2}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[9px] font-bold text-slate-300 uppercase tracking-widest">
          Trage un dispozitiv pe alta zi pentru a reprograma mentenanta
        </p>
      </div>

      {/* Selected day panel */}
      {selectedDay && (
        <div className="border-t border-slate-100 p-6 sm:p-8 bg-slate-50/50 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
              {new Date(selectedDay + 'T00:00:00').toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h4>
            <button onClick={() => setSelectedDay(null)} className="p-2 text-slate-400 hover:text-slate-900 transition"><X className="w-4 h-4" /></button>
          </div>
          {selectedDevices.length === 0 ? (
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest py-4 text-center">Nicio mentenanta programata in aceasta zi</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedDevices.map(d => (
                <button key={d.id} onClick={() => onSelectDevice?.(d)}
                  className="flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl text-left hover:border-blue-200 hover:shadow-md transition">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0"><Cpu className="w-4 h-4" /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{d.name}</p>
                    <p className="text-[10px] font-mono text-slate-400">SN: {d.serialNumber} · {d.department}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MaintenanceCalendar;
