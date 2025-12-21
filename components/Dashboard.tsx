import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { MedicalDevice, DeviceStatus } from '../types';
import { Activity, AlertTriangle, CheckCircle, Wrench } from 'lucide-react';

interface DashboardProps {
  devices: MedicalDevice[];
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#64748b'];

const Dashboard: React.FC<DashboardProps> = ({ devices }) => {
  
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

  const maintenanceUpcoming = useMemo(() => {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setDate(today.getDate() + 30);
    
    return devices.filter(d => {
      const lastMaint = d.maintenanceHistory[0];
      if (!lastMaint?.nextScheduledDate) return false;
      const date = new Date(lastMaint.nextScheduledDate);
      return date >= today && date <= nextMonth;
    }).length;
  }, [devices]);

  const activeContracts = useMemo(() => {
    const today = new Date();
    return devices.reduce((acc, dev) => {
      const valid = dev.contracts.filter(c => new Date(c.endDate) > today);
      return acc + valid.length;
    }, 0);
  }, [devices]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Devices" 
          value={devices.length} 
          icon={<Activity className="w-6 h-6 text-blue-600" />} 
          color="bg-blue-50" 
        />
        <StatCard 
          title="Active Contracts" 
          value={activeContracts} 
          icon={<CheckCircle className="w-6 h-6 text-green-600" />} 
          color="bg-green-50" 
        />
        <StatCard 
          title="Upcoming Maintenance" 
          value={maintenanceUpcoming} 
          icon={<Wrench className="w-6 h-6 text-amber-600" />} 
          color="bg-amber-50" 
        />
        <StatCard 
          title="Issues Reported" 
          value={devices.filter(d => d.status === DeviceStatus.BROKEN).length} 
          icon={<AlertTriangle className="w-6 h-6 text-red-600" />} 
          color="bg-red-50" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">Device Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">Department Overview</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={getDepartmentData(devices)}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
    <div className={`p-3 rounded-full ${color}`}>
      {icon}
    </div>
  </div>
);

const getDepartmentData = (devices: MedicalDevice[]) => {
  const depts: Record<string, number> = {};
  devices.forEach(d => {
    depts[d.department] = (depts[d.department] || 0) + 1;
  });
  return Object.entries(depts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
};

export default Dashboard;