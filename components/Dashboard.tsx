
import React, { useMemo, Suspense, lazy } from 'react';
import { MedicalDevice, DeviceStatus, MedicalTask, TaskStatus, TaskPriority, DEVICE_STATUS_RO, TASK_PRIORITY_RO } from '../types';
import { Activity, AlertTriangle, CheckCircle, Wrench, CheckSquare, Clock } from 'lucide-react';

const DashboardCharts = lazy(() => import('./DashboardCharts'));

interface DashboardProps {
  devices: MedicalDevice[];
  tasks: MedicalTask[];
}

const Dashboard: React.FC<DashboardProps> = ({ devices, tasks }) => {
  
  const statusData = useMemo(() => {
    const counts = {
      [DeviceStatus.ACTIVE]: 0,
      [DeviceStatus.MAINTENANCE]: 0,
      [DeviceStatus.BROKEN]: 0,
      [DeviceStatus.RETIRED]: 0,
    };
    devices.forEach(d => counts[d.status]++);
    return Object.entries(counts).map(([name, value]) => ({ name: DEVICE_STATUS_RO[name as DeviceStatus], value }));
  }, [devices]);

  const pendingTasks = useMemo(() => tasks.filter(t => t.status !== TaskStatus.COMPLETED).length, [tasks]);
  const criticalTasks = useMemo(() => tasks.filter(t => t.priority === TaskPriority.CRITICAL && t.status !== TaskStatus.COMPLETED).length, [tasks]);

  const dispatchTasks = useMemo(() => 
    tasks.filter(t => t.priority === TaskPriority.CRITICAL || t.priority === TaskPriority.HIGH)
         .filter(t => t.status !== TaskStatus.COMPLETED),
    [tasks]
  );

  const upcomingMaintenance = useMemo(() => {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(today.getMonth() + 1);
    
    return devices
      .filter(d => d.nextMaintenanceDate)
      .map(d => ({
        ...d,
        daysRemaining: Math.ceil((new Date(d.nextMaintenanceDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      }))
      .filter(d => d.daysRemaining <= 30 && d.daysRemaining >= -7) // Show up to 30 days in future and 7 days in past
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [devices]);

  const defecte = useMemo(
    () => devices.filter(d => d.status === DeviceStatus.BROKEN).length, [devices]);
  const sectii = useMemo(
    () => new Set(devices.map(d => (d.department || '').trim()).filter(Boolean)).size, [devices]);
  const intarziate = useMemo(
    () => upcomingMaintenance.filter(d => d.daysRemaining < 0).length, [upcomingMaintenance]);

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatCard
          title="Total Echipamente" value={devices.length}
          icon={<Activity className="w-5 h-5" />} color="text-blue-600" bgColor="bg-blue-50"
          note={sectii === 1 ? 'o sectie' : `${sectii} sectii`} tone="neutral"
        />
        <StatCard
          title="Defectiuni Critice" value={defecte}
          icon={<AlertTriangle className="w-5 h-5" />} color="text-red-700" bgColor="bg-red-50"
          note={defecte === 0 ? 'Niciuna' : defecte === 1 ? 'Necesita interventie' : 'Necesita interventii'}
          tone={defecte === 0 ? 'ok' : 'alert'}
        />
        <StatCard
          title="Tichete Active" value={pendingTasks}
          icon={<CheckSquare className="w-5 h-5" />} color="text-indigo-600" bgColor="bg-indigo-50"
          note={pendingTasks === 0 ? 'Niciunul deschis' : 'In lucru'}
          tone={pendingTasks === 0 ? 'ok' : 'neutral'}
        />
        <StatCard
          title="Interventii Urgente" value={criticalTasks}
          icon={<AlertTriangle className="w-5 h-5" />} color="text-orange-700" bgColor="bg-orange-50"
          note={criticalTasks === 0 ? 'Niciuna' : 'Imediat'}
          tone={criticalTasks === 0 ? 'ok' : 'alert'}
        />
        <StatCard
          title="Mentenante Programate" value={upcomingMaintenance.length}
          icon={<Wrench className="w-5 h-5" />} color="text-amber-700" bgColor="bg-amber-50"
          note={upcomingMaintenance.length === 0 ? 'Nimic in 30 zile'
                : intarziate > 0 ? `${intarziate} cu termen depasit` : 'Urm. 30 zile'}
          tone={upcomingMaintenance.length === 0 ? 'ok' : intarziate > 0 ? 'alert' : 'warn'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 hardware-card p-5 sm:p-10 rounded-3xl sm:rounded-[2.5rem]">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-8 sm:mb-10">
            <div>
              <h3 className="text-xl font-extrabold tracking-tight text-slate-900">Starea dispozitivelor medicale</h3>
              <p className="text-[13px] font-semibold text-slate-500 mt-1">Distributie status in timp real</p>
            </div>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Timp real</span>
            </div>
          </div>
          <Suspense fallback={<div className="h-72 flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" /></div>}>
            <DashboardCharts statusData={statusData} total={devices.length} />
          </Suspense>
        </div>

        <div className="lg:col-span-5 hardware-card p-5 sm:p-10 rounded-3xl sm:rounded-[2.5rem]">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-6 sm:mb-8">
            <div>
              <h3 className="text-xl font-extrabold tracking-tight text-slate-900">Interventii Prioritare</h3>
              <p className="text-[13px] font-semibold text-slate-500 mt-1">Operatiuni cu prioritate ridicata</p>
            </div>
            {/* A count, not a slogan: the black "Prioritate maxima" pill sat
                here even when the list under it was empty. */}
            <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap ${
              dispatchTasks.length === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-900 text-white'
            }`}>
              {dispatchTasks.length === 0
                ? 'Nimic urgent'
                : `${dispatchTasks.length} ${dispatchTasks.length === 1 ? 'interventie' : 'interventii'}`}
            </span>
          </div>
          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
            {dispatchTasks.map(task => (
              <div key={task.id} className="group p-5 bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 rounded-2xl border border-slate-100 transition-all duration-300">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">{task.title}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                       <span className="text-xs font-semibold text-slate-500">{task.department}</span>
                       <div className="w-1 h-1 rounded-full bg-slate-300" />
                       <span className="text-xs font-mono font-semibold text-slate-500 whitespace-nowrap">{task.id}</span>
                    </div>
                  </div>
                  <div className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold ${task.priority === TaskPriority.CRITICAL ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'}`}>
                    {TASK_PRIORITY_RO[task.priority]}
                  </div>
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="py-20 text-center">
                 <CheckCircle className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                 <p className="text-sm font-semibold text-slate-500">Niciun tichet critic activ</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hardware-card p-5 sm:p-10 rounded-3xl sm:rounded-[2.5rem]">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-8 sm:mb-10">
          <div>
            <h3 className="text-xl font-extrabold tracking-tight text-slate-900">Monitor Mentenante</h3>
            <p className="text-[13px] font-semibold text-slate-500 mt-1">Program preventiv 30 zile</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl">
            <Wrench className="w-6 h-6" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-6">
          {upcomingMaintenance.map(device => (
            <div key={device.id} className="p-4 sm:p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-3 sm:gap-4 group hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
              <div className={`p-3 shrink-0 rounded-2xl transition-transform group-hover:scale-110 ${device.daysRemaining < 0 ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : device.daysRemaining < 7 ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'}`}>
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-slate-900 leading-snug line-clamp-2 break-words" title={device.model}>{device.model}</p>
                <p className="text-xs font-semibold text-slate-500 mt-0.5 truncate">{device.department}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-[15px] font-bold whitespace-nowrap ${device.daysRemaining < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {device.daysRemaining < 0 ? 'Intarziat' : `${device.daysRemaining} zile`}
                </p>
                <p className="text-[11px] font-semibold text-slate-500 mt-1 whitespace-nowrap">{device.nextMaintenanceDate}</p>
              </div>
            </div>
          ))}
          {upcomingMaintenance.length === 0 && (
            <div className="col-span-full py-20 text-center bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
              <CheckCircle className="w-16 h-16 text-emerald-100 mx-auto mb-4" />
              <p className="text-sm font-semibold text-slate-500">Totul operational. Nicio mentenanta programata.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * The badge says what the number means, and changes when the number does.
 *
 * It used to be a fixed string per card, so "Defectiuni Critice: 0" wore a red
 * "Risc ridicat" and "Interventii Urgente: 0" an orange "Imediat". A hospital
 * with nothing wrong opened the app to a wall of alarm, which is the fastest
 * way to teach people to stop reading the colours. The first card was worse
 * still: "+2.4%" was written into the source, computed from nothing.
 */
const TONES: Record<'ok' | 'warn' | 'alert' | 'neutral', string> = {
  ok:      'bg-emerald-50 text-emerald-700',
  warn:    'bg-amber-50 text-amber-700',
  alert:   'bg-red-50 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
};

const StatCard = React.memo(({ title, value, icon, note, tone, color, bgColor }: {
  title: string; value: number; icon: React.ReactNode;
  note: string; tone: keyof typeof TONES; color: string; bgColor: string;
}) => (
  <div className="hardware-card p-6 rounded-[2rem] group hover:border-blue-200 transition-colors">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-xl transition-transform group-hover:scale-110 ${bgColor} ${color}`}>
        {icon}
      </div>
      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${TONES[tone]}`}>{note}</span>
    </div>
    <div>
      <p className="text-[13px] font-bold text-slate-500 leading-snug min-h-[2.1rem]">{title}</p>
      <p className="text-4xl font-extrabold text-slate-900 mt-1 tabular-nums tracking-tight">{value}</p>
    </div>
  </div>
));

export default React.memo(Dashboard);
