import React, { useState } from 'react';
import { MedicalDevice, DeviceStatus } from '../types';
import { Search, Filter, MoreVertical, Eye, Trash2 } from 'lucide-react';

interface DeviceListProps {
  devices: MedicalDevice[];
  onSelectDevice: (device: MedicalDevice) => void;
  onAddDevice: () => void;
  onDelete: (id: string) => void;
}

const DeviceList: React.FC<DeviceListProps> = ({ devices, onSelectDevice, onAddDevice, onDelete }) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<DeviceStatus | 'ALL'>('ALL');

  const filteredDevices = devices.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) || 
                          d.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
                          d.model.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || d.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text"
            placeholder="Search devices by name, model, or serial..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select 
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none cursor-pointer"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as DeviceStatus | 'ALL')}
          >
            <option value="ALL">All Statuses</option>
            {Object.values(DeviceStatus).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button 
            onClick={onAddDevice}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm whitespace-nowrap"
          >
            + New Device
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Device Name</th>
                <th className="px-6 py-4">Model / Serial</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Next Maint.</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDevices.map(device => (
                <tr 
                  key={device.id} 
                  className="hover:bg-blue-50/50 transition group"
                >
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onSelectDevice(device)}>
                    <div className="font-medium text-slate-900">{device.name}</div>
                    <div className="text-xs text-slate-500">{device.manufacturer}</div>
                  </td>
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onSelectDevice(device)}>
                    <div className="text-sm text-slate-800">{device.model}</div>
                    <div className="text-xs font-mono text-slate-500">{device.serialNumber}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 cursor-pointer" onClick={() => onSelectDevice(device)}>{device.department}</td>
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onSelectDevice(device)}>
                    <div className="text-sm text-slate-800">
                      {device.maintenanceHistory[0]?.nextScheduledDate || "Not Scheduled"}
                    </div>
                  </td>
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onSelectDevice(device)}>
                    <StatusBadge status={device.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 relative z-20">
                      <button 
                        type="button"
                        className="p-2 text-slate-400 hover:text-blue-600 transition rounded-full hover:bg-slate-100" 
                        title="View Details"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDevice(device);
                        }}
                      >
                        <Eye className="w-5 h-5 pointer-events-none" />
                      </button>
                      <button 
                        type="button"
                        className="p-2 text-slate-400 hover:text-red-600 transition rounded-full hover:bg-red-50" 
                        title="Delete Device"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDelete(device.id);
                        }}
                      >
                        <Trash2 className="w-5 h-5 pointer-events-none" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDevices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    No devices found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: DeviceStatus }) => {
  let styles = "";
  switch(status) {
    case DeviceStatus.ACTIVE: styles = "bg-green-100 text-green-700"; break;
    case DeviceStatus.MAINTENANCE: styles = "bg-amber-100 text-amber-700"; break;
    case DeviceStatus.BROKEN: styles = "bg-red-100 text-red-700"; break;
    case DeviceStatus.RETIRED: styles = "bg-slate-100 text-slate-700"; break;
  }
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border border-transparent ${styles}`}>
      {status}
    </span>
  );
};

export default DeviceList;