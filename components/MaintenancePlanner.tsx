import React, { useState } from 'react';
import { MedicalDevice, MaintenanceRecord, MaintenanceType } from '../types';
import { Calendar, Wand2, Check, Clock, AlertCircle, Save, ArrowRight } from 'lucide-react';
import { generateBulkMaintenancePlan } from '../services/geminiService';

interface MaintenancePlannerProps {
  devices: MedicalDevice[];
  onApplyPlan: (updatedDevices: MedicalDevice[]) => void;
}

const MaintenancePlanner: React.FC<MaintenancePlannerProps> = ({ devices, onApplyPlan }) => {
  const [isPlanning, setIsPlanning] = useState(false);
  const [suggestedPlan, setSuggestedPlan] = useState<any[]>([]);

  const handleGeneratePlan = async () => {
    setIsPlanning(true);
    const plan = await generateBulkMaintenancePlan(devices);
    // Link plan items back to actual device IDs based on name matching
    const mappedPlan = plan.map(p => {
      const match = devices.find(d => d.name === p.deviceName);
      return { ...p, realId: match?.id };
    });
    setSuggestedPlan(mappedPlan);
    setIsPlanning(false);
  };

  const commitPlan = () => {
    const updatedDevices = devices.map(device => {
      const suggestion = suggestedPlan.find(p => p.realId === device.id);
      if (suggestion) {
        const newRecord: MaintenanceRecord = {
          id: `PLAN-${Math.floor(Math.random() * 10000)}`,
          date: new Date().toISOString().split('T')[0],
          type: MaintenanceType.PREVENTIVE,
          technician: 'AI Suggested Planner',
          description: `SCHEDULED: ${suggestion.tasks}`,
          nextScheduledDate: suggestion.nextScheduledDate,
          completed: false
        };
        return {
          ...device,
          maintenanceHistory: [newRecord, ...device.maintenanceHistory]
        };
      }
      return device;
    });

    onApplyPlan(updatedDevices);
    setSuggestedPlan([]);
    alert("Maintenance plan applied successfully!");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            Smart Maintenance Planner
          </h2>
          <p className="text-slate-500 mt-2">
            Our AI analyzes your inventory to suggest optimal service intervals and technical tasks for every device.
          </p>
        </div>
        <button 
          onClick={handleGeneratePlan}
          disabled={isPlanning || devices.length === 0}
          className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition flex items-center gap-2 disabled:opacity-50"
        >
          {isPlanning ? (
            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Calculating...</>
          ) : (
            <><Wand2 className="w-5 h-5" /> Generate Multi-Device Plan</>
          )}
        </button>
      </div>

      {suggestedPlan.length > 0 ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Proposed Schedule for {suggestedPlan.length} Devices</h3>
            <button 
              onClick={commitPlan}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center gap-2"
            >
              <Check className="w-4 h-4" /> Apply Plan to Inventory
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestedPlan.map((item, idx) => (
              <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition group">
                <div className="flex justify-between items-start mb-3">
                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    item.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {item.priority} Priority
                  </div>
                  <Clock className="w-4 h-4 text-slate-300" />
                </div>
                <h4 className="font-bold text-slate-900 truncate">{item.deviceName}</h4>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5" /> Next Date: <span className="text-slate-900 font-semibold">{item.nextScheduledDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" /> Interval: <span className="text-slate-900">{item.frequency}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-50">
                    <p className="text-[11px] text-slate-600 line-clamp-2 italic">"{item.tasks}"</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-20 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No Plan Generated Yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mt-2">
            Hit the button above to have Gemini AI organize your maintenance cycles for all {devices.length} active devices.
          </p>
        </div>
      )}
    </div>
  );
};

export default MaintenancePlanner;