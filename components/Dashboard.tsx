
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { MedicalDevice, DeviceStatus, MedicalTask, TaskStatus, TaskPriority } from '../types';
import { Activity, AlertTriangle, CheckCircle, Wrench, CheckSquare, Clock } from 'lucide-react';

interface DashboardProps {
  devices: MedicalDevice[];
  tasks: MedicalTask[];
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#64748b'];

const Dashboard: React.FC<DashboardProps> = ({ devices, tasks }) => {
  
  const statusData = useMemo(() => {
    const counts = {
      [DeviceStatus.ACTIVE]: 0,
      [DeviceStatus.MAINTENANCE]: 0,
      [DeviceStatus.BROKEN]: 0,
      [DeviceStatus.RETIRED]: 0,
    };
    devices.forEach(d => counts[d.status]++);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
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

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatCard title="Total Assets" value={devices.length} icon={<Activity className="w-5 h-5" />} trend="+2.4%" color="text-blue-600" bgColor="bg-blue-50" />
        <StatCard title="Critical Failures" value={devices.filter(d => d.status === DeviceStatus.BROKEN).length} icon={<AlertTriangle className="w-5 h-5" />} trend="High Risk" color="text-red-600" bgColor="bg-red-50" />
        <StatCard title="Active Tickets" value={pendingTasks} icon={<CheckSquare className="w-5 h-5" />} trend="Operational" color="text-indigo-600" bgColor="bg-indigo-50" />
        <StatCard title="Emergency Response" value={criticalTasks} icon={<AlertTriangle className="w-5 h-5" />} trend="Immediate" color="text-orange-600" bgColor="bg-orange-50" />
        <StatCard title="Scheduled PMs" value={upcomingMaintenance.length} icon={<Wrench className="w-5 h-5" />} trend="Next 30d" color="text-amber-600" bgColor="bg-amber-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 hardware-card p-10 rounded-2xl">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Fleet Integrity Matrix</h3>
              <p className="tech-label mt-1">Real-time status distribution</p>
            </div>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500" />
               <span className="tech-label text-[10px]">Live Feed</span>
            </div>
          </div>
          <div className="h-72 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value" stroke="none">
                  {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
               <p className="tech-label">Total</p>
               <p className="text-4xl font-black text-slate-900 font-mono">{devices.length}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
             {statusData.map((s, i) => (
               <div key={s.name} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <p className="tech-label">{s.name}</p>
                  </div>
                  <p className="text-xl font-black font-mono text-slate-900">{s.value}</p>
               </div>
             ))}
          </div>
        </div>

        <div className="lg:col-span-5 hardware-card p-10 rounded-2xl">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Field Dispatch</h3>
              <p className="tech-label mt-1">High-priority operations</p>
            </div>
            <span className="px-3 py-1 bg-slate-900 text-white rounded-lg tech-label text-[10px]">Priority Alpha</span>
          </div>
          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
            {dispatchTasks.map(task => (
              <div key={task.id} className="group p-5 bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 rounded-2xl border border-slate-100 transition-shadow duration-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{task.title}</p>
                    <div className="flex items-center gap-3 mt-2">
                       <span className="tech-label text-[10px]">{task.department}</span>
                       <div className="w-1 h-1 rounded-full bg-slate-300" />
                       <span className="tech-label text-[10px] font-mono">{task.id}</span>
                    </div>
                  </div>
                  <div className={`shrink-0 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${task.priority === TaskPriority.CRITICAL ? 'bg-red-600 text-white shadow-lg ' : 'bg-orange-500 text-white '}`}>
                    {task.priority}
                  </div>
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="py-20 text-center">
                 <CheckCircle className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                 <p className="tech-label">No active critical tasks</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hardware-card p-10 rounded-2xl">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Maintenance Watchdog</h3>
            <p className="tech-label mt-1">30-day preventive schedule</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <Wrench className="w-6 h-6" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {upcomingMaintenance.map(device => (
            <div key={device.id} className="p-6 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-5 group hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-shadow duration-200">
              <div className={`p-4 rounded-2xl transition-transform group-hover:scale-110 ${device.daysRemaining < 0 ? 'bg-red-600 text-white shadow-lg ' : device.daysRemaining < 7 ? 'bg-amber-500 text-white ' : 'bg-blue-600 text-white shadow-lg '}`}>
                <Clock className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900 truncate tracking-tight">{device.model}</p>
                <p className="tech-label text-[10px] mt-1 truncate">{device.department}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-black font-mono ${device.daysRemaining < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {device.daysRemaining < 0 ? 'OVERDUE' : `T-${device.daysRemaining}D`}
                </p>
                <p className="tech-label text-[10px] mt-1">{device.nextMaintenanceDate}</p>
              </div>
            </div>
          ))}
          {upcomingMaintenance.length === 0 && (
            <div className="col-span-full py-20 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
              <CheckCircle className="w-16 h-16 text-emerald-100 mx-auto mb-4" />
              <p className="tech-label">All systems operational. No upcoming PMs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = React.memo(({ title, value, icon, trend, color, bgColor }: { title: string, value: number, icon: React.ReactNode, trend: string, color: string, bgColor: string }) => (
  <div className="hardware-card p-6 rounded-xl group hover:border-blue-200 transition-colors">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-xl transition-transform group-hover:scale-110 ${bgColor} ${color}`}>
        {icon}
      </div>
      <span className={`tech-label text-[10px] px-2 py-0.5 rounded-full ${bgColor} ${color}`}>{trend}</span>
    </div>
    <div>
      <p className="tech-label">{title}</p>
      <p className="text-3xl font-black text-slate-900 mt-1 font-mono tracking-tighter">{value}</p>
    </div>
  </div>
));

export default React.memo(Dashboard);
