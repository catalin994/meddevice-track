
import React, { useMemo, Suspense, lazy } from 'react';
import { MedicalDevice, DeviceStatus, MedicalTask, TaskStatus, TaskPriority, DEVICE_STATUS_RO, TASK_PRIORITY_RO, TASK_STATUS_RO, Contract, normaliseDeviceStatus } from '../types';
import { Activity, AlertTriangle, CheckCircle, Wrench, CheckSquare, Clock, ShieldCheck, CalendarClock } from 'lucide-react';
import { termeneleTuturor, termeneDeUrmarit, metrologieExpirata, metrologieNecunoscuta, Termen, FelTermen } from '../services/termene';

const DashboardCharts = lazy(() => import('./DashboardCharts'));

interface DashboardProps {
  devices: MedicalDevice[];
  tasks: MedicalTask[];
  onSelectDevice?: (id: string) => void;
  /** Ducerea la lista intreaga de tichete, cand cele de pe Panou nu ajung. */
  onOpenTasks?: () => void;
}

/** Urgentele intai, si la aceeasi urgenta cel deschis mai de curand. */
const RANG_PRIORITATE: Record<TaskPriority, number> = {
  [TaskPriority.CRITICAL]: 0,
  [TaskPriority.HIGH]: 1,
  [TaskPriority.MEDIUM]: 2,
  [TaskPriority.LOW]: 3,
};

/** Cate tichete incap pe Panou fara sa impinga restul paginii afara. */
const TICHETE_PE_PANOU = 8;

const Dashboard: React.FC<DashboardProps> = ({ devices, tasks, onSelectDevice, onOpenTasks }) => {
  
  const statusData = useMemo(() => {
    const counts = {
      [DeviceStatus.ACTIVE]: 0,
      [DeviceStatus.MAINTENANCE]: 0,
      [DeviceStatus.BROKEN]: 0,
      [DeviceStatus.RETIRED]: 0,
    };
    // Prin normalizare: o stare venita dintr-un import nu mai deschide un cos al
    // ei, cu numaratoarea pornita de la undefined — adica "NaN" sub grafic.
    devices.forEach(d => counts[normaliseDeviceStatus(d.status)]++);
    return Object.entries(counts).map(([name, value]) => ({ name: DEVICE_STATUS_RO[name as DeviceStatus], value }));
  }, [devices]);

  const pendingTasks = useMemo(() => tasks.filter(t => t.status !== TaskStatus.COMPLETED).length, [tasks]);
  const criticalTasks = useMemo(() => tasks.filter(t => t.priority === TaskPriority.CRITICAL && t.status !== TaskStatus.COMPLETED).length, [tasks]);

  /*
   * Tichetele deschise, toate.
   *
   * Panoul arata pana acum doar tichetele critice si ridicate, sub numele
   * "Interventii prioritare" — restul, adica majoritatea muncii de peste zi, se
   * vedeau doar daca intrai in Tichete service. Cine deschidea dimineata
   * aplicatia isi vedea aparatura, termenele si mentenanta, dar nu si ce a
   * lasat in lucru ieri. Acum sunt toate aici, cu urgentele primele.
   */
  const tichete = useMemo(() =>
    tasks
      .filter(t => t.status !== TaskStatus.COMPLETED)
      .slice()
      .sort((a, b) =>
        (RANG_PRIORITATE[a.priority] ?? 9) - (RANG_PRIORITATE[b.priority] ?? 9) ||
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
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

  /**
   * Termenele care se apropie: metrologie, garantie, contracte, CNCAN.
   *
   * Contractele stau in interiorul aparatelor, deci se aduna de acolo, cate
   * unul pe numar — acelasi contract acopera de obicei mai multe aparate.
   */
  const contracte = useMemo(() => Array.from(new Map<string, Contract>(
    devices.flatMap(d => d.contracts || []).map(c => [c.contractNumber, c])).values()), [devices]);
  const termene = useMemo(
    () => termeneDeUrmarit(termeneleTuturor(devices, contracte)).filter(t => t.fel !== 'mentenanta'),
    [devices, contracte]);
  const metrologieRea = useMemo(() => metrologieExpirata(devices), [devices]);
  const metrologieGoala = useMemo(() => metrologieNecunoscuta(devices), [devices]);

  const defecte = useMemo(
    () => devices.filter(d => d.status === DeviceStatus.BROKEN).length, [devices]);
  const sectii = useMemo(
    () => new Set(devices.map(d => (d.department || '').trim()).filter(Boolean)).size, [devices]);
  const intarziate = useMemo(
    () => upcomingMaintenance.filter(d => d.daysRemaining < 0).length, [upcomingMaintenance]);

  return (
    <div className="space-y-8 animate-slide-up">
      {/*
        Sase cifre, sase coloane pe ecran lat. Erau cinci, si a sasea ramanea
        singura pe un rand nou — un cartonas orfan cat un sfert de ecran. Pe
        telefon stau doua pe rand: una sub alta insemna sase ecrane de derulat
        pana la primul lucru care cere ceva de facut.
      */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
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
        {/*
          Metrologia isi merita cifra ei: un aparat cu buletinul expirat nu are
          voie sa fie folosit, si asta nu se vede din nimic altceva de pe ecran.
        */}
        <StatCard
          title="Metrologie Expirata" value={metrologieRea.length}
          icon={<ShieldCheck className="w-5 h-5" />} color="text-red-700" bgColor="bg-red-50"
          note={metrologieRea.length === 0
            ? (metrologieGoala.length ? `${metrologieGoala.length} fara buletin trecut` : 'Toate valabile')
            : 'Nu au voie sa fie folosite'}
          tone={metrologieRea.length > 0 ? 'alert' : metrologieGoala.length > 0 ? 'warn' : 'ok'}
        />
      </div>

      {/*
        Tichetele deschise, primele pe pagina.
        Panoul incepea cu termenele si cu mentenanta preventiva — lucruri care
        se misca o data pe luna — iar munca deschisa acum statea intr-o coloana
        ingusta mai jos, si numai partea critica din ea. Ce ai in lucru azi se
        vede primul; ceasurile care ticaie lung au coborat sub el.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 hardware-card p-5 sm:p-8 rounded-3xl">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5 sm:mb-6">
            <div>
              <h3 className="text-xl font-extrabold tracking-tight text-slate-900">Tichete service deschise</h3>
              <p className="text-[13px] font-semibold text-slate-500 mt-1">
                {tichete.length === 0
                  ? 'Nimic in lucru'
                  : `${tichete.length} ${tichete.length === 1 ? 'tichet' : 'tichete'} in lucru, urgentele primele`}
              </p>
            </div>
            {onOpenTasks && tasks.length > 0 && (
              <button
                onClick={onOpenTasks}
                className="px-3.5 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-[13px] font-semibold hover:border-slate-300 hover:text-slate-900 transition active:scale-95"
              >
                Vezi toate
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {tichete.slice(0, TICHETE_PE_PANOU).map(task => (
              <button
                key={task.id}
                onClick={onOpenTasks}
                disabled={!onOpenTasks}
                className={`w-full text-left group flex items-start gap-3 p-3.5 rounded-2xl border border-slate-100 bg-slate-50 transition-colors ${
                  onOpenTasks ? 'hover:bg-white hover:border-slate-200 cursor-pointer' : 'cursor-default'
                }`}
              >
                {/* Urgenta ca o dunga, nu ca o pastila colorata pe fiecare rand:
                    opt pastile rosii una sub alta nu mai spun care e cea grava. */}
                <span
                  className={`shrink-0 w-1 self-stretch rounded-full ${
                    task.priority === TaskPriority.CRITICAL ? 'bg-red-600'
                    : task.priority === TaskPriority.HIGH ? 'bg-orange-500'
                    : task.priority === TaskPriority.MEDIUM ? 'bg-blue-500'
                    : 'bg-slate-300'
                  }`}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-slate-900 leading-snug break-words group-hover:text-blue-600 transition-colors">
                    {task.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[13px]">
                    <span className={`font-semibold ${
                      task.priority === TaskPriority.CRITICAL ? 'text-red-600'
                      : task.priority === TaskPriority.HIGH ? 'text-orange-600'
                      : 'text-slate-500'
                    }`}>
                      {TASK_PRIORITY_RO[task.priority]}
                    </span>
                    {/* Punctul si textul de dupa el stau in aceeasi bucata:
                        altfel, cand randul se rupe pe telefon, punctul ramane
                        agatat la capat si arata ca o greseala. */}
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                      <span className="font-medium text-slate-600 truncate max-w-[12rem]">{task.department}</span>
                    </span>
                    {task.deviceName && (
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                        <span className="font-medium text-slate-500 truncate max-w-[14rem]">{task.deviceName}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                    task.status === TaskStatus.IN_PROGRESS
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {TASK_STATUS_RO[task.status]}
                  </span>
                  {task.createdAt && (
                    <p className="text-[11px] font-medium text-slate-500 mt-1 whitespace-nowrap">{task.createdAt}</p>
                  )}
                </div>
              </button>
            ))}

            {tichete.length > TICHETE_PE_PANOU && (
              <button
                onClick={onOpenTasks}
                disabled={!onOpenTasks}
                className="w-full py-3 text-[13px] font-semibold text-slate-500 hover:text-blue-600 transition-colors"
              >
                si inca {tichete.length - TICHETE_PE_PANOU} — vezi toate tichetele
              </button>
            )}

            {tichete.length === 0 && (
              <div className="py-14 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-100 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-500">
                  {tasks.length === 0 ? 'Niciun tichet deschis inca' : 'Toate tichetele sunt finalizate'}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 hardware-card p-5 sm:p-8 rounded-3xl">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-6 sm:mb-8">
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
      </div>

      {/*
        Termenele care se apropie, toate la un loc. Aplicatia se uita pana acum
        doar la mentenanta; restul ceasurilor ticaiau nevazute.
      */}
      {termene.length > 0 && (
        <div className="hardware-card p-5 sm:p-10 rounded-3xl">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-6 sm:mb-8">
            <div>
              <h3 className="text-xl font-extrabold tracking-tight text-slate-900">Termene care expira</h3>
              <p className="text-[13px] font-semibold text-slate-500 mt-1">
                Buletine metrologice, garantii, contracte de service, autorizatii
              </p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl"><CalendarClock className="w-6 h-6" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-4">
            {termene.slice(0, 24).map((t, i) => (
              <button
                key={`${t.fel}-${t.deviceId || t.subiect}-${i}`}
                onClick={() => t.deviceId && onSelectDevice?.(t.deviceId)}
                disabled={!t.deviceId}
                className={`text-left p-4 sm:p-5 rounded-3xl border flex items-center gap-3 sm:gap-4 transition-all ${
 t.zile < 0 ? 'bg-red-50 border-red-200' : t.zile <= 14 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'
                } ${t.deviceId ? 'hover:shadow-xl hover:shadow-slate-200/50 cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`p-3 shrink-0 rounded-2xl text-white shadow-lg ${
 t.zile < 0 ? 'bg-red-600 shadow-red-600/20' : t.zile <= 14 ? 'bg-amber-500 shadow-amber-500/20' : 'bg-slate-400 shadow-slate-400/20'
                }`}>
                  {t.fel === 'metrologie' ? <ShieldCheck className="w-5 h-5" /> : <CalendarClock className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{t.eticheta}</p>
                  <p className="text-[15px] font-bold text-slate-900 leading-snug line-clamp-2 break-words">{t.subiect}</p>
                  {t.detaliu && <p className="text-xs font-semibold text-slate-500 mt-0.5 truncate">{t.detaliu}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[15px] font-bold whitespace-nowrap ${t.zile < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {t.zile < 0 ? 'Expirat' : t.zile === 0 ? 'Azi' : `${t.zile} zile`}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1 whitespace-nowrap">{t.data}</p>
                </div>
              </button>
            ))}
          </div>
          {termene.length > 24 && (
            <p className="text-[12px] font-bold text-slate-500 mt-4 text-center">
              si inca {termene.length - 24} — vezi lista intreaga in Inventar
            </p>
          )}
        </div>
      )}

      <div className="hardware-card p-5 sm:p-10 rounded-3xl">
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
            <div key={device.id} className="p-4 sm:p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-3 sm:gap-4 group hover:bg-white hover:shadow-sm hover:shadow-slate-200/50 transition-all duration-300">
              <div className={`p-3 shrink-0 rounded-2xl transition-transform group-hover:scale-110 ${device.daysRemaining < 0 ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : device.daysRemaining < 7 ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'}`}>
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                {/* Numele aparatului, nu modelul singur: "EQ-90" si "Corpuls 3"
                    nu spun nimanui care aparat trebuie scos din sectie. */}
                <p className="text-[15px] font-bold text-slate-900 leading-snug line-clamp-2 break-words" title={device.name}>
                  {device.name || device.model || 'Dispozitiv fara nume'}
                </p>
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
            <div className="col-span-full py-20 text-center bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
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
  <div className="hardware-card p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] group hover:border-blue-200 transition-colors">
    <div className="flex items-start justify-between gap-2 mb-3">
      <div className={`p-2.5 rounded-xl transition-transform group-hover:scale-110 shrink-0 ${bgColor} ${color}`}>
        {icon}
      </div>
      {/* Nota se infasoara pe cartonasul ingust de pe telefon in loc sa iasa. */}
      <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-full text-right leading-tight ${TONES[tone]}`}>{note}</span>
    </div>
    <div>
      <p className="text-[12px] sm:text-[13px] font-bold text-slate-500 leading-snug min-h-[2.1rem]">{title}</p>
      <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-0.5 tabular-nums tracking-tight">{value}</p>
    </div>
  </div>
));

export default React.memo(Dashboard);
