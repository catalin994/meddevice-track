
import React, { useState, useMemo, useCallback } from 'react';
import { MedicalTask, TaskPriority, TaskStatus, MedicalDevice, HOSPITAL_DEPARTMENTS, getUniqueDepartments } from '../types';
import { CheckSquare, Plus, Search, Filter, AlertCircle, Clock, CheckCircle2, MoreHorizontal, Trash2, Edit, X, ArrowRight, User, Info, Building, MessageSquare, StickyNote, Fingerprint, LayoutGrid, Table2, Columns, ChevronUp, ChevronDown } from 'lucide-react';

type TaskViewMode = 'CARDS' | 'TABLE' | 'KANBAN';
type SortKey = 'title' | 'deviceName' | 'department' | 'priority' | 'status' | 'createdAt' | 'dueDate';

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  [TaskPriority.CRITICAL]: 0,
  [TaskPriority.HIGH]: 1,
  [TaskPriority.MEDIUM]: 2,
  [TaskPriority.LOW]: 3,
};

const STATUS_ORDER: Record<TaskStatus, number> = {
  [TaskStatus.PENDING]: 0,
  [TaskStatus.IN_PROGRESS]: 1,
  [TaskStatus.COMPLETED]: 2,
};

interface TaskTrackerProps {
  tasks: MedicalTask[];
  devices: MedicalDevice[];
  onAddTask: (task: MedicalTask) => void;
  onUpdateTask: (task: MedicalTask) => void;
  onDeleteTask: (id: string) => void;
}

const TaskTracker: React.FC<TaskTrackerProps> = ({ tasks, devices, onAddTask, onUpdateTask, onDeleteTask }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingTask, setEditingTask] = useState<MedicalTask | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<TaskViewMode>('CARDS');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    deviceId: '',
    department: HOSPITAL_DEPARTMENTS[0] as string,
    priority: TaskPriority.MEDIUM,
    dueDate: '',
    notes: ''
  });

  const allAvailableDepartments = useMemo(() => {
    return getUniqueDepartments(devices, tasks);
  }, [devices, tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchStatus = filterStatus === 'ALL' || t.status === filterStatus;
      const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (t.deviceName && t.deviceName.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchStatus && matchSearch;
    });
  }, [tasks, filterStatus, searchQuery]);

  // Sorted view for the table
  const sortedTasks = useMemo(() => {
    const arr = [...filteredTasks];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'priority') cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      else if (sortKey === 'status') cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      else cmp = String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filteredTasks, sortKey, sortDir]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  // Kanban: group by status
  const kanbanColumns = useMemo(() => {
    return Object.values(TaskStatus).map(status => ({
      status,
      tasks: filteredTasks
        .filter(t => t.status === status)
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
    }));
  }, [filteredTasks]);

  const handleKanbanDrop = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('text/task-id');
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== status) {
      onUpdateTask({ ...task, status });
    }
  }, [tasks, onUpdateTask]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const device = devices.find(d => d.id === formData.deviceId);
    
    if (editingTask) {
      const updatedTask: MedicalTask = {
        ...editingTask,
        title: formData.title,
        description: formData.description,
        deviceId: formData.deviceId || undefined,
        deviceName: device?.name,
        department: formData.department.trim(),
        priority: formData.priority,
        dueDate: formData.dueDate,
        notes: formData.notes
      };
      onUpdateTask(updatedTask);
      setEditingTask(null);
    } else {
      const newTask: MedicalTask = {
        id: `TASK-${Date.now()}`,
        title: formData.title,
        description: formData.description,
        deviceId: formData.deviceId || undefined,
        deviceName: device?.name,
        department: formData.department.trim(),
        priority: formData.priority,
        status: TaskStatus.PENDING,
        createdAt: new Date().toISOString().split('T')[0],
        dueDate: formData.dueDate,
        notes: formData.notes
      };
      onAddTask(newTask);
      setIsAdding(false);
    }
    
    resetForm();
  }, [editingTask, formData, devices, onUpdateTask, onAddTask]);

  const handleEdit = useCallback((task: MedicalTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      deviceId: task.deviceId || '',
      department: task.department,
      priority: task.priority,
      dueDate: task.dueDate || '',
      notes: task.notes || ''
    });
  }, []);

  const resetForm = useCallback(() => {
    setFormData({ 
      title: '', 
      description: '', 
      deviceId: '', 
      department: HOSPITAL_DEPARTMENTS[0], 
      priority: TaskPriority.MEDIUM, 
      dueDate: '', 
      notes: '' 
    });
  }, []);

  const toggleStatus = useCallback((task: MedicalTask) => {
    const nextStatus = task.status === TaskStatus.PENDING ? TaskStatus.IN_PROGRESS :
                      task.status === TaskStatus.IN_PROGRESS ? TaskStatus.COMPLETED : 
                      TaskStatus.PENDING;
    onUpdateTask({ ...task, status: nextStatus });
  }, [onUpdateTask]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
            <input 
              type="text"
              placeholder="Search tasks, departments..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold shadow-inner focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="bg-slate-50 border-none px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="ALL">All Status</option>
            {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {([
              ['CARDS', 'Carduri', LayoutGrid],
              ['TABLE', 'Tabel', Table2],
              ['KANBAN', 'Kanban', Columns],
            ] as [TaskViewMode, string, any][]).map(([mode, label, Icon]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                title={label}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition ${viewMode === mode ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-slate-600'}`}>
                <Icon className="w-4 h-4" />
                <span className="hidden lg:inline">{label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-blue-700 transition flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </button>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="py-24 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-50">
          <div className="p-6 bg-slate-50 w-fit rounded-full mx-auto mb-6">
            <CheckSquare className="w-16 h-16 text-slate-200" />
          </div>
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm">Task queue is currently clear</p>
          <p className="text-xs text-slate-300 mt-2 font-bold uppercase">All clinical requests handled</p>
        </div>
      ) : viewMode === 'CARDS' ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              devices={devices}
              onToggleStatus={toggleStatus}
              onEdit={handleEdit}
              onDelete={onDeleteTask}
            />
          ))}
        </div>
      ) : viewMode === 'TABLE' ? (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {([
                    ['title', 'Titlu'],
                    ['deviceName', 'Dispozitiv'],
                    ['department', 'Departament'],
                    ['priority', 'Prioritate'],
                    ['status', 'Status'],
                    ['createdAt', 'Creat'],
                    ['dueDate', 'Scadenta'],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <th key={key} onClick={() => handleSort(key)}
                      className="px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none hover:text-slate-900 transition whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {sortKey === key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />)}
                      </span>
                    </th>
                  ))}
                  <th className="px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Actiuni</th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.map(task => (
                  <tr key={task.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition group">
                    <td className="px-5 py-3.5 max-w-[280px]">
                      <p className="text-xs font-black text-slate-900 truncate" title={task.title}>{task.title}</p>
                      {task.notes && (
                        <p className="text-[9px] text-amber-600 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
                          <StickyNote className="w-2.5 h-2.5" /> Note tehnice
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 max-w-[180px]">
                      {task.deviceName
                        ? <span className="text-[10px] font-bold text-blue-600 truncate block" title={task.deviceName}>{task.deviceName}</span>
                        : <span className="text-[10px] text-slate-300 font-bold">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">{task.department}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${getPriorityText(task.priority)}`}>{task.priority}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => toggleStatus(task)}
                        className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest border transition flex items-center gap-1.5 whitespace-nowrap ${getStatusStyles(task.status)}`}
                        title="Click pentru a schimba statusul">
                        {getStatusIcon(task.status)}
                        {task.status}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-[10px] font-mono font-bold text-slate-500 whitespace-nowrap">{task.createdAt}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {task.dueDate
                        ? <span className={`text-[10px] font-mono font-bold ${task.dueDate < new Date().toISOString().split('T')[0] && task.status !== TaskStatus.COMPLETED ? 'text-red-500' : 'text-slate-500'}`}>{task.dueDate}</span>
                        : <span className="text-[10px] text-slate-300 font-bold">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => handleEdit(task)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editeaza">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDeleteTask(task.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Sterge">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{sortedTasks.length} tichete · click pe coloana pentru sortare · click pe status pentru avansare</p>
          </div>
        </div>
      ) : (
        /* KANBAN */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {kanbanColumns.map(col => (
            <div
              key={col.status}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.status); }}
              onDragLeave={() => setDragOverCol(c => c === col.status ? null : c)}
              onDrop={e => handleKanbanDrop(e, col.status)}
              className={`rounded-[2rem] border-2 transition p-4 min-h-[300px] ${dragOverCol === col.status ? 'border-blue-400 bg-blue-50/50 ring-4 ring-blue-500/10' : 'border-slate-100 bg-slate-50/50'}`}
            >
              <div className="flex items-center justify-between px-2 pb-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(col.status)}
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{col.status}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${col.status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-700' : col.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                  {col.tasks.length}
                </span>
              </div>
              <div className="space-y-3">
                {col.tasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('text/task-id', task.id)}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${getPriorityText(task.priority)}`}>{task.priority}</span>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => handleEdit(task)} className="p-1.5 text-slate-300 hover:text-blue-600 rounded-md transition"><Edit className="w-3 h-3" /></button>
                        <button onClick={() => onDeleteTask(task.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-md transition"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                    <p className="text-xs font-black text-slate-900 leading-tight mt-2">{task.title}</p>
                    {task.deviceName && <p className="text-[10px] font-bold text-blue-600 truncate mt-1">{task.deviceName}</p>}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Building className="w-2.5 h-2.5" /> {task.department}
                      </span>
                      {task.dueDate && (
                        <span className={`text-[9px] font-mono font-bold ${task.dueDate < new Date().toISOString().split('T')[0] && task.status !== TaskStatus.COMPLETED ? 'text-red-500' : 'text-slate-400'}`}>
                          {task.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {col.tasks.length === 0 && (
                  <p className="py-10 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Trage un tichet aici</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(isAdding || editingTask) && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl animate-fade-in overflow-hidden border-4 border-white">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                    {editingTask ? 'Augment Task Data' : 'Open Service Ticket'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    {editingTask ? `Refining ID: ${editingTask.id}` : 'Clinical Engineering Registry'}
                  </p>
               </div>
               <button onClick={() => { setIsAdding(false); setEditingTask(null); }} className="p-3 text-slate-400 hover:bg-white hover:text-slate-900 rounded-2xl transition border border-slate-200 shadow-sm"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Task Title / Fault Type</label>
                <input required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g., Ultrasound probe failure" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Requesting Unit</label>
                  <div className="relative">
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold appearance-none cursor-pointer focus:ring-4 focus:ring-blue-500/10 outline-none" value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})}>
                      {allAvailableDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 rotate-90 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Clinical Priority</label>
                  <div className="relative">
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold appearance-none cursor-pointer focus:ring-4 focus:ring-blue-500/10 outline-none" value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value as any})}>
                      {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 rotate-90 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Linked Clinical Asset (Optional)</label>
                <div className="relative">
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold appearance-none cursor-pointer focus:ring-4 focus:ring-blue-500/10 outline-none" value={formData.deviceId} onChange={(e) => setFormData({...formData, deviceId: e.target.value})}>
                    <option value="">No device linked</option>
                    {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.serialNumber})</option>)}
                  </select>
                  <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 rotate-90 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Initial Problem Description</label>
                <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium min-h-[100px] focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Describe the issue reported by the unit..." />
              </div>

              {/* ADDITIONAL DATA FIELD */}
              <div className="space-y-2 p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <StickyNote className="w-4 h-4" /> Technical Notes & Follow-up Data
                </label>
                <textarea 
                  className="w-full bg-white border border-blue-200 rounded-2xl px-5 py-4 text-sm font-medium min-h-[120px] focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none placeholder:text-blue-300" 
                  value={formData.notes} 
                  onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                  placeholder="Append diagnostic results, parts needed, or technical progress..."
                />
                <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest text-right mt-1 italic">This data is visible only to the engineering team</p>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => { setIsAdding(false); setEditingTask(null); }} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition">Discard</button>
                <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-blue-700 transition active:scale-95 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> {editingTask ? 'Commit Data Updates' : 'Authorize Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const TaskCard = React.memo(({ 
  task, 
  devices, 
  onToggleStatus, 
  onEdit, 
  onDelete 
}: { 
  task: MedicalTask, 
  devices: MedicalDevice[], 
  onToggleStatus: (task: MedicalTask) => void, 
  onEdit: (task: MedicalTask) => void, 
  onDelete: (id: string) => void 
}) => {
  const device = useMemo(() => devices.find(d => d.id === task.deviceId), [devices, task.deviceId]);
  
  return (
    <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex items-stretch group">
      <div className={`w-2 ${getPriorityColor(task.priority)} transition-all group-hover:w-3`} />
      <div className="p-6 flex-1 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${getPriorityText(task.priority)}`}>{task.priority}</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Building className="w-3 h-3" /> {task.department}
            </span>
            {task.deviceName && (
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md uppercase tracking-tighter flex items-center gap-1.5 border border-blue-100 shadow-sm">
                <Info className="w-3 h-3 opacity-50" /> {task.deviceName}
                {device?.serialNumber && (
                  <span className="ml-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-mono text-[9px] font-black tracking-tight border border-indigo-100">
                    SN: {device.serialNumber}
                  </span>
                )}
              </span>
            )}
            {task.notes && (
              <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-tighter flex items-center gap-1 border border-amber-100" title="Technical Notes Available">
                <StickyNote className="w-2.5 h-2.5" /> Notes
              </span>
            )}
          </div>
          <h4 className="text-lg font-black text-slate-900 leading-tight truncate">{task.title}</h4>
          <p className="text-sm text-slate-500 mt-1 line-clamp-2 max-w-3xl font-medium">{task.description}</p>
          {task.notes && (
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Technical Follow-up
              </p>
              <p className="text-xs text-slate-600 italic leading-relaxed">{task.notes}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden xl:block">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Logged On</p>
            <p className="text-xs font-bold text-slate-600">{task.createdAt}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onToggleStatus(task)}
              className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all flex items-center gap-2 shadow-sm active:scale-95 ${getStatusStyles(task.status)}`}
            >
              {getStatusIcon(task.status)}
              {task.status}
            </button>
            
            <div className="flex gap-1 border-l border-slate-100 pl-4 ml-2">
              <button 
                onClick={() => onEdit(task)} 
                className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="Add Data / Edit Task"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onDelete(task.id)} 
                className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Delete Ticket"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const getPriorityColor = (p: TaskPriority) => {
  switch(p) {
    case TaskPriority.CRITICAL: return 'bg-red-600';
    case TaskPriority.HIGH: return 'bg-orange-500';
    case TaskPriority.MEDIUM: return 'bg-blue-500';
    case TaskPriority.LOW: return 'bg-slate-400';
  }
};

const getPriorityText = (p: TaskPriority) => {
  switch(p) {
    case TaskPriority.CRITICAL: return 'bg-red-50 text-red-600 border border-red-100';
    case TaskPriority.HIGH: return 'bg-orange-50 text-orange-600 border border-orange-100';
    case TaskPriority.MEDIUM: return 'bg-blue-50 text-blue-600 border border-blue-100';
    case TaskPriority.LOW: return 'bg-slate-50 text-slate-600 border border-slate-100';
  }
};

const getStatusStyles = (s: TaskStatus) => {
  switch(s) {
    case TaskStatus.PENDING: return 'border-slate-200 text-slate-400 bg-white hover:border-slate-300';
    case TaskStatus.IN_PROGRESS: return 'border-blue-200 text-blue-600 bg-blue-50/50 hover:bg-blue-50';
    case TaskStatus.COMPLETED: return 'border-green-200 text-green-600 bg-green-50/50 hover:bg-green-50';
  }
};

const getStatusIcon = (s: TaskStatus) => {
  switch(s) {
    case TaskStatus.PENDING: return <Clock className="w-3.5 h-3.5" />;
    case TaskStatus.IN_PROGRESS: return <AlertCircle className="w-3.5 h-3.5 animate-pulse" />;
    case TaskStatus.COMPLETED: return <CheckCircle2 className="w-3.5 h-3.5" />;
  }
};

export default React.memo(TaskTracker);
