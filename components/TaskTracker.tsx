
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { MedicalTask, TaskPriority, TaskStatus, MedicalDevice, TaskAttachment, HOSPITAL_DEPARTMENTS, getUniqueDepartments, TASK_STATUS_RO, TASK_PRIORITY_RO } from '../types';
import { CheckSquare, Plus, Search, Filter, AlertCircle, Clock, CheckCircle2, MoreHorizontal, Trash2, Edit, X, ArrowRight, User, Info, Building, MessageSquare, StickyNote, Fingerprint, LayoutGrid, Table2, Columns, ChevronUp, ChevronDown, Siren, Paperclip, Film, FileText } from 'lucide-react';
import IncidentReport from './IncidentReport';

import Portal from './Portal';
import useEscape from './useEscape';
import Pager, { usePagination } from './Pager';
import ConfirmDialog from './ConfirmDialog';
import { resolveSource } from '../services/fileStorage';
// Opens an attachment in a new tab. Newer ones come from Storage (or its local
// cache), older ones are still inline data URLs.
const openAttachment = async (a: TaskAttachment) => {
  const source = await resolveSource(a);
  if (source.blob) {
    window.open(URL.createObjectURL(source.blob), '_blank');
    return;
  }
  if (!source.dataUrl) return;
  try {
    const [meta, b64] = source.dataUrl.split(',');
    const mime = meta.match(/data:(.*?);/)?.[1] || 'application/octet-stream';
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    window.open(URL.createObjectURL(new Blob([bytes], { type: mime })), '_blank');
  } catch {
    window.open(source.dataUrl, '_blank');
  }
};

/** Thumbnail that works for both storage-backed and inline attachments. */
const AttachmentThumb: React.FC<{ attachment: TaskAttachment }> = ({ attachment }) => {
  const [src, setSrc] = useState<string | null>(attachment.url || null);
  useEffect(() => {
    if (!attachment.path) { setSrc(attachment.url || null); return; }
    let url: string | null = null;
    let cancelled = false;
    resolveSource(attachment).then(source => {
      if (cancelled || !source.blob) return;
      url = URL.createObjectURL(source.blob);
      setSrc(url);
    });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [attachment.path, attachment.url]);

  if (!src) return <div className="w-full h-full bg-slate-100 animate-pulse" />;
  return <img src={src} alt={attachment.name} className="w-full h-full object-cover" />;
};

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
  const [isReportingIncident, setIsReportingIncident] = useState(false);
  // Every bin in this screen goes through here rather than straight to the
  // delete: a ticket carries the description of a fault and whatever was
  // attached to it, and none of that comes back.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  // Escape inchide formularul deschis, si raportul de incident
  useEscape(() => { setIsAdding(false); setEditingTask(null); }, isAdding || !!editingTask);
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

  // Kanban stays whole — a board split across pages is not a board.
  const { pageItems, page, pageSize, setPageSize, pageCount, goToPage, topRef } =
    usePagination(sortedTasks, 'meditrack_tasks_page_size');
  const visibleTasks = viewMode === 'KANBAN' ? sortedTasks : pageItems;

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
      <div className="bg-white p-3 sm:p-4 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-1">
          {/*
            Se strangea pana la un patrat cu o lupa in el, cand restul barei
            cerea loc — in Inventar cautarea e lata cat randul, aici ajungea o
            iconita. Aceeasi unealta trebuie sa arate la fel in amandoua.
          */}
          <div className="relative flex-1 min-w-[180px] sm:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input 
              type="text"
              placeholder="Cauta tichete, departamente..."
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-xl text-sm font-bold outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            aria-label="Filtreaza tichetele dupa status"
            className="bg-slate-50 border-none px-4 py-3 rounded-xl text-[13px] font-bold tracking-normal text-slate-600 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="ALL">Toate statusurile</option>
            {Object.values(TaskStatus).map(s => <option key={s} value={s}>{TASK_STATUS_RO[s]}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {([
              ['CARDS', 'Carduri', LayoutGrid],
              ['TABLE', 'Tabel', Table2],
              ['KANBAN', 'Kanban', Columns],
            ] as [TaskViewMode, string, any][]).map(([mode, label, Icon]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                title={label}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition ${viewMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                <Icon className="w-4 h-4" />
                <span className="hidden lg:inline">{label}</span>
              </button>
            ))}
          </div>
          {/*
            Rosu plin statea langa albastru plin, doua butoane care se certau, si
            rosul mai inseamna si stergere in restul aplicatiei. Raportarea unui
            incident e o actiune obisnuita, facuta des — ramane rosie ca sa se
            gaseasca repede, dar in tonul discret, ca butonul principal al
            ecranului sa fie unul singur.
          */}
          <button
            onClick={() => setIsReportingIncident(true)}
            className="px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl font-bold text-[13px] hover:bg-red-100 transition flex items-center gap-2 active:scale-95"
          >
            <Siren className="w-4 h-4" /> Raporteaza incident
          </button>
          <button
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-[13px] shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Tichet nou
          </button>
        </div>
      </div>

      <div ref={topRef} className="scroll-mt-4" />

      {filteredTasks.length === 0 ? (
        <div className="py-24 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-50">
          <div className="p-6 bg-slate-50 w-fit rounded-full mx-auto mb-6">
            <CheckSquare className="w-16 h-16 text-slate-200" />
          </div>
          <p className="text-slate-500 font-black tracking-[0.2em] text-sm">Nu exista tichete active</p>
          <p className="text-xs text-slate-500 mt-2 font-bold uppercase">Toate solicitarile au fost rezolvate</p>
        </div>
      ) : viewMode === 'CARDS' ? (
        <div className="grid grid-cols-1 gap-4">
          {visibleTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              devices={devices}
              onToggleStatus={toggleStatus}
              onEdit={handleEdit}
              onDelete={setPendingDelete}
            />
          ))}
          <Pager page={page} pageCount={pageCount} pageSize={pageSize}
            total={sortedTasks.length} onGoTo={goToPage} onPageSize={setPageSize} />
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
                      className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-900 transition whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {sortKey === key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />)}
                      </span>
                    </th>
                  ))}
                  <th className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Actiuni</th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map(task => (
                  <tr key={task.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition group">
                    <td className="px-5 py-3.5 max-w-[280px]">
                      <p className="text-xs font-black text-slate-900 truncate" title={task.title}>{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.notes && (
                          <p className="text-[11px] text-amber-600 font-bold uppercase tracking-wide flex items-center gap-1">
                            <StickyNote className="w-2.5 h-2.5" /> Note tehnice
                          </p>
                        )}
                        {(task.attachments || []).length > 0 && (
                          <p className="text-[11px] text-blue-600 font-bold uppercase tracking-wide flex items-center gap-1" title={`${task.attachments!.length} atasamente`}>
                            <Paperclip className="w-2.5 h-2.5" /> {task.attachments!.length}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 max-w-[180px]">
                      {task.deviceName
                        ? <span className="text-[11px] font-bold text-blue-600 truncate block" title={task.deviceName}>{task.deviceName}</span>
                        : <span className="text-[11px] text-slate-500 font-bold">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{task.department}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide whitespace-nowrap ${getPriorityText(task.priority)}`}>{TASK_PRIORITY_RO[task.priority]}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => toggleStatus(task)}
                        className={`px-3 py-1.5 rounded-lg font-black text-[11px] uppercase tracking-wide border transition flex items-center gap-1.5 whitespace-nowrap ${getStatusStyles(task.status)}`}
                        title="Click pentru a schimba statusul" aria-label="Click pentru a schimba statusul">
                        {getStatusIcon(task.status)}
                        {TASK_STATUS_RO[task.status]}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-[11px] font-mono font-bold text-slate-500 whitespace-nowrap">{task.createdAt}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {task.dueDate
                        ? <span className={`text-[11px] font-mono font-bold ${task.dueDate < new Date().toISOString().split('T')[0] && task.status !== TaskStatus.COMPLETED ? 'text-red-500' : 'text-slate-500'}`}>{task.dueDate}</span>
                        : <span className="text-[11px] text-slate-500 font-bold">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => handleEdit(task)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editeaza" aria-label="Editeaza">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setPendingDelete(task.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Sterge" aria-label="Sterge">
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
            <p className="text-xs font-semibold text-slate-500">{sortedTasks.length} tichete · click pe coloana pentru sortare · click pe status pentru avansare</p>
          </div>
          <div className="p-4 border-t border-slate-100">
            <Pager page={page} pageCount={pageCount} pageSize={pageSize}
              total={sortedTasks.length} onGoTo={goToPage} onPageSize={setPageSize} />
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
                  <p className="text-[11px] font-black text-slate-600 uppercase tracking-wide">{TASK_STATUS_RO[col.status]}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black ${col.status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-700' : col.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
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
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${getPriorityText(task.priority)}`}>{TASK_PRIORITY_RO[task.priority]}</span>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => handleEdit(task)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md transition"><Edit className="w-3 h-3" /></button>
                        <button onClick={() => setPendingDelete(task.id)} className="p-1.5 text-slate-500 hover:text-red-500 rounded-md transition"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                    <p className="text-xs font-black text-slate-900 leading-tight mt-2">{task.title}</p>
                    {task.deviceName && <p className="text-[11px] font-bold text-blue-600 truncate mt-1">{task.deviceName}</p>}
                    {(task.attachments || []).length > 0 && (
                      <p className="text-[11px] text-slate-500 font-bold flex items-center gap-1 mt-1"><Paperclip className="w-2.5 h-2.5" /> {task.attachments!.length} atasamente</p>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                        <Building className="w-2.5 h-2.5" /> {task.department}
                      </span>
                      {task.dueDate && (
                        <span className={`text-[11px] font-mono font-bold ${task.dueDate < new Date().toISOString().split('T')[0] && task.status !== TaskStatus.COMPLETED ? 'text-red-500' : 'text-slate-500'}`}>
                          {task.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {col.tasks.length === 0 && (
                  <p className="py-10 text-center text-[11px] font-black text-slate-500 uppercase tracking-wide">Trage un tichet aici</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isReportingIncident && (
        <IncidentReport
          devices={devices}
          onSubmit={onAddTask}
          onClose={() => setIsReportingIncident(false)}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Stergi tichetul?"
        icon={<Trash2 className="w-8 h-8 sm:w-10 sm:h-10" />}
        body={<>
          <span className="font-black text-slate-900">
            {tasks.find(t => t.id === pendingDelete)?.title || 'Acest tichet'}
          </span>{' '}
          se sterge definitiv, impreuna cu descrierea si fisierele atasate.
        </>}
        confirmLabel="Sterge tichetul"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) onDeleteTask(pendingDelete); setPendingDelete(null); }}
      />

      {(isAdding || editingTask) && (
        <Portal>
        <div className="fixed inset-0 z-[100] scrim flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl modal-shell flex flex-col animate-fade-in overflow-hidden border-4 border-white">
            <div className="p-5 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
               <div>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    {editingTask ? 'Editeaza Tichet' : 'Deschide Tichet Service'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mt-1">
                    {editingTask ? `Editare ID: ${editingTask.id}` : 'Registru Tichete Service'}
                  </p>
               </div>
               <button onClick={() => { setIsAdding(false); setEditingTask(null); }} className="p-3 text-slate-500 hover:bg-white hover:text-slate-900 rounded-2xl transition border border-slate-200 shadow-sm"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-6 flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1">Titlu / Tip Defectiune</label>
                <input required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="ex: Defectiune sonda ecograf" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1">Departament Solicitant</label>
                  <div className="relative">
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold appearance-none cursor-pointer focus:ring-4 focus:ring-blue-500/10 outline-none" value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})}>
                      {allAvailableDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 rotate-90 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1">Prioritate</label>
                  <div className="relative">
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold appearance-none cursor-pointer focus:ring-4 focus:ring-blue-500/10 outline-none" value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value as any})}>
                      {Object.values(TaskPriority).map(p => <option key={p} value={p}>{TASK_PRIORITY_RO[p]}</option>)}
                    </select>
                    <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 rotate-90 pointer-events-none" />
                  </div>
                </div>
              </div>
              <AlegeDispozitivul
                devices={devices}
                value={formData.deviceId}
                onChange={id => setFormData(f => ({ ...f, deviceId: id }))}
              />
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1">Descrierea Problemei</label>
                <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium min-h-[100px] focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Descrie problema raportata de departament..." />
              </div>

              {/* ADDITIONAL DATA FIELD */}
              <div className="space-y-2 p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                <label className="text-[11px] font-black text-blue-600 uppercase tracking-wide ml-1 flex items-center gap-2">
                  <StickyNote className="w-4 h-4" /> Note Tehnice
                </label>
                <textarea 
                  className="w-full bg-white border border-blue-200 rounded-2xl px-5 py-4 text-sm font-medium min-h-[120px] focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none placeholder:text-blue-300" 
                  value={formData.notes} 
                  onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                  placeholder="Adauga rezultate diagnostic, piese necesare sau progres tehnic..."
                />
                <p className="text-[11px] text-blue-400 font-bold uppercase tracking-wide text-right mt-1 italic">Aceste date sunt vizibile doar echipei tehnice</p>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => { setIsAdding(false); setEditingTask(null); }} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase tracking-wide hover:bg-slate-200 transition">Renunta</button>
                <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-wide shadow-2xl hover:bg-blue-700 transition active:scale-95 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> {editingTask ? 'Salveaza Modificarile' : 'Creeaza Tichet'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
};

/** "Ecograf" trebuie sa gaseasca si "ECOGRAF", si "ecográf". */
const faraSemne = (x: string) =>
  x.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .replace(/[șş]/g, 's').replace(/[țţ]/g, 't').replace(/[ăâ]/g, 'a').replace(/î/g, 'i')
   .toLowerCase();

/** Cate randuri se deseneaza. Un spital are mii de aparate; lista se scurteaza. */
const CAT_ARAT = 40;

/**
 * Alegerea aparatului pe un tichet.
 *
 * Era o lista derulanta cu toate aparatele din spital, in ordinea in care vin
 * din baza de date. Ca sa deschizi un tichet pentru injectomatul de la ATI
 * trebuia sa-l gasesti cu ochiul printre cateva mii, pe telefon, deruland.
 *
 * Se cauta acum dupa cum e scris pe aparat: denumire, serie sau model. Seria e
 * cea care conteaza cand in sectie sunt sase aparate la fel — si tocmai ea nu
 * se putea cauta.
 */
const AlegeDispozitivul: React.FC<{
  devices: MedicalDevice[];
  value: string;
  onChange: (id: string) => void;
}> = ({ devices, value, onChange }) => {
  const [cauta, setCauta] = useState('');
  const ales = useMemo(() => devices.find(d => d.id === value) || null, [devices, value]);

  const potrivite = useMemo(() => {
    const q = faraSemne(cauta.trim());
    if (!q) return devices;
    // Bucatile despartite de spatiu se cer toate: "ecograf ge" gaseste ecograful
    // GE fara sa ceara cuvintele in ordinea de pe eticheta.
    const parti = q.split(/\s+/).filter(Boolean);
    return devices.filter(d => {
      const fan = faraSemne(`${d.name} ${d.serialNumber} ${d.model} ${d.manufacturer} ${d.department}`);
      return parti.every(x => fan.includes(x));
    });
  }, [devices, cauta]);

  const aratate = potrivite.slice(0, CAT_ARAT);

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1">
        Dispozitiv Asociat (Optional)
      </label>

      {ales ? (
        <div className="flex items-center gap-3 p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/20">
          <div className="p-2 bg-white/20 rounded-lg shrink-0"><CheckCircle2 className="w-4 h-4" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black truncate">{ales.name}</p>
            <p className="text-[10px] font-bold uppercase tracking-tighter text-white/70 truncate">
              {ales.serialNumber}{ales.model ? ` · ${ales.model}` : ''}{ales.department ? ` · ${ales.department}` : ''}
            </p>
          </div>
          <button type="button" onClick={() => onChange('')} aria-label="Scoate dispozitivul de pe tichet"
            className="p-2 bg-white/15 hover:bg-white/25 rounded-lg transition shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              value={cauta}
              onChange={e => setCauta(e.target.value)}
              placeholder="Cauta dupa denumire, serie sau model..."
              aria-label="Cauta dispozitivul dupa denumire, serie sau model"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-4 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
            />
          </div>
          {devices.length === 0 ? (
            <p className="text-[12px] font-bold text-slate-500 px-1">Nu e niciun dispozitiv in inventar.</p>
          ) : potrivite.length === 0 ? (
            <p className="text-[12px] font-bold text-slate-500 px-1">
              Niciun dispozitiv nu se potriveste. Tichetul se poate deschide si fara.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {aratate.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => { onChange(d.id); setCauta(''); }}
                  className="w-full text-left p-3.5 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:bg-blue-50/40 transition flex items-center gap-3"
                >
                  <div className="p-2 bg-slate-50 text-slate-500 rounded-lg shrink-0"><Fingerprint className="w-4 h-4" /></div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-black text-slate-900 truncate">{d.name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-500 truncate">
                      {d.serialNumber}{d.model ? ` · ${d.model}` : ''}{d.department ? ` · ${d.department}` : ''}
                    </p>
                  </div>
                </button>
              ))}
              {potrivite.length > aratate.length && (
                <p className="text-[11px] font-bold text-slate-500 text-center py-2">
                  Inca {potrivite.length - aratate.length}. Scrie mai exact ca sa le vezi.
                </p>
              )}
            </div>
          )}
        </>
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
      <div className="p-4 sm:p-5 flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/*
            Intai ce s-a intamplat, apoi unde si la ce aparat.
            Randul cu prioritatea, sectia si aparatul statea deasupra titlului,
            asa ca ochiul citea "RIDICATA · RADIOLOGIE · Ecograf..." si abia pe
            randul urmator afla ca sonda nu porneste. Titlul vine primul.
          */}
          <h4 className="text-[15px] sm:text-base font-bold text-slate-900 leading-snug break-words">{task.title}</h4>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5">
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${getPriorityText(task.priority)}`}>{TASK_PRIORITY_RO[task.priority]}</span>
            <span className="text-[13px] font-semibold text-slate-600 flex items-center gap-1">
              <Building className="w-3 h-3 text-slate-400" /> {task.department}
            </span>
            {/*
              Era scris cu majuscule, albastru, pe fundal albastru, cu inca o
              caseta pentru serie — cantarea mai mult decat titlul tichetului de
              sub el, si ochiul citea intai aparatul, nu ce s-a stricat. Ramane
              acelasi lucru, spus mai incet.
            */}
            {task.deviceName && (
              <span className="text-[13px] font-medium text-slate-600 flex items-center gap-1.5 min-w-0">
                <Info className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{task.deviceName}</span>
                {device?.serialNumber && (
                  <span className="font-mono text-slate-500 shrink-0">· {device.serialNumber}</span>
                )}
              </span>
            )}
            {task.notes && (
              <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-tighter flex items-center gap-1 border border-amber-100" title="Note tehnice disponibile">
                <StickyNote className="w-2.5 h-2.5" /> Note
              </span>
            )}
          </div>
          <p className="text-[13px] text-slate-500 mt-1.5 line-clamp-2 max-w-3xl font-medium">{task.description}</p>
          {task.notes && (
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Note Tehnice
              </p>
              <p className="text-xs text-slate-600 italic leading-relaxed">{task.notes}</p>
            </div>
          )}

          {/* Incident attachments */}
          {(task.attachments || []).length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(task.attachments || []).map(a => (
                a.kind === 'image' ? (
                  <button key={a.id} onClick={() => openAttachment(a)} title={a.name}
                    className="w-14 h-14 rounded-xl overflow-hidden border-2 border-slate-200 hover:border-blue-400 transition shadow-sm">
                    <AttachmentThumb attachment={a} />
                  </button>
                ) : (
                  <button key={a.id} onClick={() => openAttachment(a)} title={a.name}
                    className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-400 transition text-slate-600">
                    {a.kind === 'video' ? <Film className="w-4 h-4 text-purple-500" /> : <FileText className="w-4 h-4 text-blue-500" />}
                    <span className="text-[11px] font-bold max-w-[110px] truncate">{a.name}</span>
                  </button>
                )
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden xl:block">
            <p className="text-[13px] font-medium text-slate-500 whitespace-nowrap">Creat {task.createdAt}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onToggleStatus(task)}
              title="Apasa ca sa schimbi statusul"
              className={`px-3.5 py-2 rounded-xl font-bold text-[13px] border transition-all flex items-center gap-2 active:scale-95 ${getStatusStyles(task.status)}`}
            >
              {getStatusIcon(task.status)}
              {TASK_STATUS_RO[task.status]}
            </button>
            
            <div className="flex gap-1 border-l border-slate-100 pl-4 ml-2">
              <button 
                onClick={() => onEdit(task)} 
                className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="Editeaza Tichet"
               aria-label="Editeaza Tichet">
                <Edit className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onDelete(task.id)} 
                className="p-2.5 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Sterge Tichet"
               aria-label="Sterge Tichet">
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
    case TaskPriority.CRITICAL: return 'bg-red-50 text-red-700 border border-red-100';
    case TaskPriority.HIGH: return 'bg-orange-50 text-orange-700 border border-orange-100';
    case TaskPriority.MEDIUM: return 'bg-blue-50 text-blue-600 border border-blue-100';
    case TaskPriority.LOW: return 'bg-slate-50 text-slate-600 border border-slate-100';
  }
};

const getStatusStyles = (s: TaskStatus) => {
  switch(s) {
    case TaskStatus.PENDING: return 'border-slate-200 text-slate-500 bg-white hover:border-slate-300';
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
