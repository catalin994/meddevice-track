
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { MedicalTask, TaskPriority, TaskStatus, MedicalDevice, TaskAttachment, Referat, FoundationDoc, Invoice, HOSPITAL_DEPARTMENTS, getUniqueDepartments, TASK_STATUS_RO, TASK_PRIORITY_RO } from '../types';
import { CheckSquare, Plus, Search, Filter, AlertCircle, Clock, CheckCircle2, MoreHorizontal, Trash2, Edit, X, ArrowRight, User, Info, Building, MessageSquare, StickyNote, Fingerprint, LayoutGrid, Table2, Columns, ChevronUp, ChevronDown, Siren, Paperclip, Film, FileText } from 'lucide-react';
import IncidentReport from './IncidentReport';
const FisaTichet = React.lazy(() => import('./FisaTichet'));

import Portal from './Portal';
import { getPriorityColor, getPriorityText, getStatusStyles, getStatusIcon, marimeaDescrierii } from './stilTichet';
import useEscape from './useEscape';
import Pager, { usePagination } from './Pager';
import ConfirmDialog from './ConfirmDialog';
import { resolveSource } from '../services/fileStorage';
import { etichetaHartiei, culoareaHartiei, grupeazaHartiile, CULORI_HARTIE } from '../services/hartiiTichet';
import { zi } from '../services/valabilitate';
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
  /** Deschide fisa aparatului de pe tichet. */
  onSelectDevice?: (id: string) => void;
  /* Hartiile aparatului din Financiar, ca sa se vada din tichet ce exista deja. */
  referate?: Referat[];
  foundationDocs?: FoundationDoc[];
  invoices?: Invoice[];
}

const TaskTracker: React.FC<TaskTrackerProps> = ({
  tasks, devices, onAddTask, onUpdateTask, onDeleteTask,
  onSelectDevice, referate = [], foundationDocs = [], invoices = [],
}) => {
  /** Tichetul deschis la vedere, cu tot ce se stie despre el. */
  const [deschis, setDeschis] = useState<MedicalTask | null>(null);
  /*
   * Randul desfacut in tabel. Unul singur: desfacute toate, tabelul nu mai e
   * tabel, e un sir de cartonase — si tocmai asta e de ales intre vederi.
   */
  const [desfacut, setDesfacut] = useState<string | null>(null);
  /*
   * Hartiile aratate dintr-un rand, intr-o fereastra mica agatata de insigna.
   * Se tine si locul ei pe ecran: tabelul deruleaza pe orizontala si isi taie
   * ce iese din el, asa ca fereastra se deseneaza deasupra paginii, nu in
   * celula.
   */
  const [hartiiLa, setHartiiLa] = useState<{ task: MedicalTask; x: number; y: number } | null>(null);
  useEscape(() => setHartiiLa(null), !!hartiiLa);
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
              onVeziAparatul={onSelectDevice}
              onDeschide={() => setDeschis(task)}
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
                  <th className="w-9" />
                  {([
                    ['title', 'Titlu'],
                    ['deviceName', 'Dispozitiv'],
                    ['department', 'Departament'],
                    ['priority', 'Prioritate'],
                    ['status', 'Status'],
                    ['createdAt', 'Creat'],
                    ['dueDate', 'Scadenta'],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <React.Fragment key={key}>
                      <th onClick={() => handleSort(key)}
                        className="px-3 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-900 transition whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {sortKey === key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />)}
                        </span>
                      </th>
                      {/*
                        Hartiile vin imediat dupa titlu, nu la capatul randului.
                        Ele se citesc la fiecare trecere peste lista — a venit
                        oferta? — pe cand butoanele se cauta abia cand ai hotarat
                        ce faci. Puse ultimele, erau primele care cadeau afara
                        din ecran. Nu se sorteaza: hartiile nu se asaza in sir.
                      */}
                      {key === 'title' && (
                        <th className="px-3 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Documente</th>
                      )}
                    </React.Fragment>
                  ))}
                  {/*
                    Actiunile raman lipite de marginea din dreapta. Cu zece
                    coloane, pe un laptop tabelul e mai lat decat ecranul, si
                    pana acum tocmai butoanele cadeau afara: se vedea tot, in
                    afara de ce se putea face.
                  */}
                  <th className="px-3 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Actiuni</th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map(task => (
                  <React.Fragment key={task.id}>
                  <tr onClick={() => setDeschis(task)}
                    className={`border-b border-slate-50 transition group cursor-pointer ${
                      desfacut === task.id ? 'bg-blue-50/40' : 'hover:bg-blue-50/30'
                    }`}>
                    {/* Sageata la inceputul randului, unde o cauta ochiul si
                        unde ramane la vedere oricat de ingust ar fi ecranul. */}
                    <td className="pl-3 pr-0 py-3.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setDesfacut(d => (d === task.id ? null : task.id))}
                        aria-expanded={desfacut === task.id}
                        title={desfacut === task.id ? 'Strange randul' : 'Vezi tot, aici pe rand'}
                        aria-label={desfacut === task.id ? `Strange ${task.title}` : `Vezi tot despre ${task.title}`}
                        className={`p-1.5 rounded-lg transition ${
                          desfacut === task.id ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
                        }`}>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${desfacut === task.id ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="text-xs font-black text-slate-900 leading-snug line-clamp-2 break-words max-w-[260px]" title={task.title}>
                        {task.title}
                      </p>
                      {/* Descrierea, pe un rand: ea spune ce s-a stricat, si
                          lipsea cu totul din tabel. */}
                      {task.description && desfacut !== task.id && (
                        <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5 max-w-[260px]" title={task.description}>
                          {task.description}
                        </p>
                      )}
                      {task.notes && (
                        <p className="text-[11px] text-amber-600 font-bold uppercase tracking-wide flex items-center gap-1 mt-0.5">
                          <StickyNote className="w-2.5 h-2.5" /> Note tehnice
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3.5" onClick={e => e.stopPropagation()}>
                      {(task.attachments || []).length === 0 ? (
                        <span className="text-[11px] font-bold text-slate-300">—</span>
                      ) : (
                        <button
                          onClick={e => {
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setHartiiLa(h => (h?.task.id === task.id ? null : { task, x: r.left, y: r.bottom }));
                          }}
                          aria-expanded={hartiiLa?.task.id === task.id}
                          aria-label={`Vezi cele ${task.attachments!.length} documente ale tichetului`}
                          title={task.attachments!.map(a => `${etichetaHartiei(a)} · ${a.name}`).join('\n')}
                          className={`px-2.5 py-1.5 rounded-xl border-2 text-[12px] font-black transition flex items-center gap-1.5 ${
                            hartiiLa?.task.id === task.id
                              ? 'bg-slate-900 border-slate-900 text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-900'
                          }`}>
                          <Paperclip className="w-3.5 h-3.5 shrink-0" />
                          {task.attachments!.length}
                          {/* Cate feluri sunt, in culori: oferta si referat se
                              deosebesc inainte sa fie citit vreun nume. */}
                          <span className="flex items-center gap-0.5 ml-0.5">
                            {[...new Set(task.attachments!.map(a => a.category || 'altul'))].slice(0, 4).map(fel => (
                              <span key={fel}
                                className={`w-1.5 h-1.5 rounded-full ${culoareaHartiei({ category: fel } as any).punct}`} />
                            ))}
                          </span>
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      {task.deviceName
                        ? <span className="text-[11px] font-bold text-blue-600 truncate block max-w-[150px]" title={task.deviceName}>{task.deviceName}</span>
                        : <span className="text-[11px] text-slate-500 font-bold">—</span>}
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{task.department}</span>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide whitespace-nowrap ${getPriorityText(task.priority)}`}>{TASK_PRIORITY_RO[task.priority]}</span>
                    </td>
                    <td className="px-3 py-3.5">
                      <button onClick={e => { e.stopPropagation(); toggleStatus(task); }}
                        className={`px-3 py-1.5 rounded-lg font-black text-[11px] uppercase tracking-wide border transition flex items-center gap-1.5 whitespace-nowrap ${getStatusStyles(task.status)}`}
                        title="Click pentru a schimba statusul" aria-label="Click pentru a schimba statusul">
                        {getStatusIcon(task.status)}
                        {TASK_STATUS_RO[task.status]}
                      </button>
                    </td>
                    <td className="px-3 py-3.5 text-[11px] font-mono font-bold text-slate-500 whitespace-nowrap">{task.createdAt}</td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      {task.dueDate
                        ? <span className={`text-[11px] font-mono font-bold ${task.dueDate < new Date().toISOString().split('T')[0] && task.status !== TaskStatus.COMPLETED ? 'text-red-500' : 'text-slate-500'}`}>{task.dueDate}</span>
                        : <span className="text-[11px] text-slate-500 font-bold">—</span>}
                    </td>
                    {/*
                      Hartiile tichetului, scrise pe fel, nu numai numarate.
                      "Agrafa 2" spunea ca sunt doua, nu care sunt — iar
                      intrebarea de la tabel e daca a venit oferta, nu cate
                      fisiere sunt pe tichet. Se apasa si se deschid.
                    */}
                    <td className="px-3 py-3.5">
                      <div className="flex justify-end gap-1 transition" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setDeschis(task)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Deschide tichetul" aria-label="Deschide tichetul">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleEdit(task)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editeaza" aria-label="Editeaza">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setPendingDelete(task.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Sterge" aria-label="Sterge">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {desfacut === task.id && (
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <td colSpan={10} className="px-4 pb-5 pt-1">
                        {/*
                          Jumatati egale: la ce aparat, si ce s-a stricat.
                          Aparatul sta in stanga, de unde incepe cititul — in
                          tabel vii cu intrebarea "care aparat?", iar descrierea
                          e raspunsul al doilea.
                        */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          <div className="space-y-3">
                            {task.deviceName && (() => {
                              const ap = devices.find(d => d.id === task.deviceId);
                              return (
                                <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Aparatul</p>
                                  <button onClick={e => { e.stopPropagation(); if (task.deviceId) onSelectDevice?.(task.deviceId); }}
                                    disabled={!task.deviceId || !onSelectDevice}
                                    className="text-[13px] font-black text-blue-700 hover:underline text-left break-words block">
                                    {task.deviceName}
                                  </button>
                                  {ap && (
                                    <p className="text-[11px] font-semibold text-slate-500 mt-0.5 break-words">
                                      {[ap.serialNumber && `SN ${ap.serialNumber}`,
                                        ap.inventoryNumber && `Inv. ${ap.inventoryNumber}`,
                                        [ap.manufacturer, ap.model].filter(Boolean).join(' '),
                                        ap.department].filter(Boolean).join(' · ')}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">
                                Documente ({(task.attachments || []).length})
                              </p>
                              {(task.attachments || []).length === 0 ? (
                                <p className="text-[13px] font-semibold text-slate-400">Nicio hartie pusa.</p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {task.attachments!.map(a => (
                                    <button key={a.id} onClick={e => { e.stopPropagation(); openAttachment(a); }}
                                      title={a.name} aria-label={`Deschide ${a.name}`}
                                      className="px-2.5 py-1.5 bg-white border-2 border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700 transition max-w-[220px] truncate flex items-center gap-1.5">
                                      <FileText className="w-3 h-3 shrink-0 text-slate-400" />
                                      <span className="truncate">{etichetaHartiei(a)} · {a.name}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Descrierea problemei</p>
                              {/* Se incadreaza in rand: o descriere de o pagina
                                  se scrie mai marunt, iar restul se deruleaza. */}
                              <p className={`font-medium text-slate-700 whitespace-pre-wrap break-words max-h-[180px] overflow-y-auto custom-scrollbar pr-1 ${
                                marimeaDescrierii(task.description || '')
                              }`}>
                                {task.description || 'Nu s-a scris nimic la deschiderea tichetului.'}
                              </p>
                            </div>
                            {task.notes && (
                              <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl">
                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-wide mb-1">Note tehnice</p>
                                <p className={`font-medium text-slate-700 whitespace-pre-wrap break-words max-h-[120px] overflow-y-auto custom-scrollbar pr-1 ${
                                  marimeaDescrierii(task.notes || '')
                                }`}>
                                  {task.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
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
                    onClick={() => setDeschis(task)}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-blue-200 transition group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${getPriorityText(task.priority)}`}>{TASK_PRIORITY_RO[task.priority]}</span>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleEdit(task)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md transition" title="Editeaza" aria-label="Editeaza"><Edit className="w-3 h-3" /></button>
                        <button onClick={() => setPendingDelete(task.id)} className="p-1.5 text-slate-500 hover:text-red-500 rounded-md transition" title="Sterge" aria-label="Sterge"><Trash2 className="w-3 h-3" /></button>
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

      {/*
        Hartiile randului, intr-o fereastra mica langa insigna lor.
        Insignele scrise una langa alta umpleau coloana si cadeau pe doua
        randuri, iar din sase hartii se vedeau doua. Asa se vede numarul si
        felurile dintr-o privire, iar lista intreaga vine la o apasare — si se
        deschide fiecare hartie de acolo.
      */}
      {hartiiLa && (
        <Portal>
          <div className="fixed inset-0 z-[590]" onClick={() => setHartiiLa(null)} onWheel={() => setHartiiLa(null)} />
          <div
            role="dialog"
            aria-label={`Documentele tichetului ${hartiiLa.task.title}`}
            className="fixed z-[600] w-[340px] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
            style={{
              top: Math.min(hartiiLa.y + 8, (typeof window !== 'undefined' ? window.innerHeight : 800) - 340),
              left: Math.max(12, Math.min(hartiiLa.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 352)),
            }}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-black text-slate-900 leading-tight">Documente</p>
                <p className="text-[11px] font-semibold text-slate-400 truncate mt-0.5">{hartiiLa.task.title}</p>
              </div>
              <button onClick={() => setHartiiLa(null)} aria-label="Inchide"
                className="p-1.5 -mr-1 -mt-1 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[46vh] overflow-y-auto custom-scrollbar py-2">
              {grupeazaHartiile(hartiiLa.task.attachments).map(g => (
                <div key={g.fel} className="px-2 py-1.5 border-t border-slate-50 first:border-0">
                  {/* Felul, o data, cu numarul lui la capat — un cap de dosar. */}
                  <div className="flex items-center gap-2 px-2 py-1">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${(CULORI_HARTIE[g.fel] || CULORI_HARTIE.altul).punct}`} />
                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 truncate">{g.text}</span>
                    <span className="ml-auto text-[10px] font-black text-slate-300 shrink-0">{g.hartii.length}</span>
                  </div>
                  {g.hartii.map(a => (
                    <button key={a.id} onClick={() => { openAttachment(a); setHartiiLa(null); }}
                      title={a.name} aria-label={`Deschide ${a.name}`}
                      className="w-full group/h flex items-center gap-2 pl-4 pr-2 py-1.5 rounded-lg hover:bg-slate-50 transition text-left">
                      {a.kind === 'video' ? <Film className="w-3.5 h-3.5 text-slate-300 group-hover/h:text-slate-500 shrink-0 transition" />
                        : <FileText className="w-3.5 h-3.5 text-slate-300 group-hover/h:text-slate-500 shrink-0 transition" />}
                      <span className="text-[12px] font-bold text-slate-700 truncate flex-1">{a.name}</span>
                      <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">{zi(a.dateAdded)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100">
              <button
                onClick={() => { const t = hartiiLa.task; setHartiiLa(null); setDeschis(t); }}
                className="w-full px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition flex items-center justify-center gap-1.5">
                Deschide tichetul <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </Portal>
      )}

      {deschis && (() => {
        /* Tichetul citit din sir, nu cel retinut la apasare: altfel fisa ar
           ramane cu starea veche dupa ce o schimbi din ea. */
        const t = tasks.find(x => x.id === deschis.id) || deschis;
        return (
          <React.Suspense fallback={null}>
            <FisaTichet
              task={t}
              device={devices.find(d => d.id === t.deviceId)}
              referate={referate}
              foundationDocs={foundationDocs}
              invoices={invoices}
              onSchimba={atasamente => onUpdateTask({ ...t, attachments: atasamente })}
              onStatus={() => toggleStatus(t)}
              onEditeaza={() => { setDeschis(null); handleEdit(t); }}
              onSterge={() => { setDeschis(null); setPendingDelete(t.id); }}
              onVeziAparatul={t.deviceId && onSelectDevice
                ? () => onSelectDevice(t.deviceId!)
                : undefined}
              onInchide={() => setDeschis(null)}
            />
          </React.Suspense>
        );
      })()}

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
              {/*
                Campurile erau cenusii pe alb, cu o margine abia vazuta: aratau
                a text scris, nu a casuta de scris. Acum sunt albe cu margine
                groasa, si se inchid la culoare cand scrii in ele — se vede ca
                asteapta ceva, si se vede care anume.
              */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1 flex items-center gap-1.5">
                  <Edit className="w-3 h-3 text-slate-400" /> Titlu / Tip defectiune
                  <span className="text-red-500">*</span>
                  <span className="font-semibold normal-case tracking-normal text-slate-400">— de scris</span>
                </label>
                <input required className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold placeholder:font-semibold placeholder:text-slate-400 focus:border-slate-900 focus:bg-white outline-none transition-all" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="ex: Defectiune sonda ecograf" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1 flex items-center gap-1.5">
                    <ChevronDown className="w-3 h-3 text-slate-400" /> Departament solicitant
                    <span className="font-semibold normal-case tracking-normal text-slate-400">— de ales</span>
                  </label>
                  <div className="relative">
                    <select className="w-full bg-white border-2 border-slate-200 rounded-2xl pl-5 pr-14 py-4 text-sm font-bold appearance-none cursor-pointer focus:border-slate-900 outline-none transition-all" value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})}>
                      {allAvailableDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-100 text-slate-600 rounded-xl pointer-events-none">
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1 flex items-center gap-1.5">
                    <ChevronDown className="w-3 h-3 text-slate-400" /> Prioritate
                    <span className="font-semibold normal-case tracking-normal text-slate-400">— de ales</span>
                  </label>
                  <div className="relative">
                    <select className="w-full bg-white border-2 border-slate-200 rounded-2xl pl-5 pr-14 py-4 text-sm font-bold appearance-none cursor-pointer focus:border-slate-900 outline-none transition-all" value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value as any})}>
                      {Object.values(TaskPriority).map(p => <option key={p} value={p}>{TASK_PRIORITY_RO[p]}</option>)}
                    </select>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-100 text-slate-600 rounded-xl pointer-events-none">
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
              <AlegeDispozitivul
                devices={devices}
                value={formData.deviceId}
                onChange={id => setFormData(f => ({ ...f, deviceId: id }))}
              />
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1 flex items-center gap-1.5">
                  <Edit className="w-3 h-3 text-slate-400" /> Descrierea problemei
                  <span className="font-semibold normal-case tracking-normal text-slate-400">— de scris</span>
                </label>
                <textarea className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium min-h-[110px] placeholder:text-slate-400 focus:border-slate-900 outline-none transition-all resize-none" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Ce face aparatul, de cand, in ce imprejurari. Ex: la pornire da eroare de inalta tensiune, din 12.07." />
              </div>

              {/* Notele poarta acelasi galben ca pe fisa tichetului: acelasi
                  lucru, aceeasi culoare, oriunde ar fi vazut. */}
              <div className="space-y-2 p-5 sm:p-6 bg-amber-50/60 rounded-3xl border-2 border-amber-100">
                <label className="text-[11px] font-black text-amber-700 uppercase tracking-wide ml-1 flex items-center gap-2">
                  <StickyNote className="w-4 h-4" /> Note tehnice
                  <span className="font-semibold normal-case tracking-normal text-amber-600/70">— de scris, daca ai ce</span>
                </label>
                <textarea 
                  className="w-full bg-white border-2 border-amber-200 rounded-2xl px-5 py-4 text-sm font-medium min-h-[120px] focus:border-amber-500 outline-none transition-all resize-none placeholder:text-amber-700/40" 
                  value={formData.notes} 
                  onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                  placeholder="Ce s-a constatat la fata locului, ce piese trebuie, cu cine s-a vorbit..."
                />
                <p className="text-[11px] text-amber-700/70 font-bold mt-1">Se vad numai de catre serviciul tehnic.</p>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => { setIsAdding(false); setEditingTask(null); }} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase tracking-wide hover:bg-slate-200 transition">Renunta</button>
                <button type="submit" className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-wide hover:bg-slate-800 transition active:scale-95 flex items-center justify-center gap-2">
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
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1 flex items-center gap-1.5">
        <Search className="w-3 h-3 text-slate-400" /> Dispozitivul
        <span className="font-semibold normal-case tracking-normal text-slate-400">
          — de cautat si ales, daca tichetul e pe un aparat anume
        </span>
      </label>

      {ales ? (
        /*
          Aparatul ales statea intr-un dreptunghi albastru plin, cu umbra
          albastra sub el — cantarea mai mult decat tot formularul si parea o
          alarma, nu o alegere facuta. Acum spune acelasi lucru mai incet:
          verde, ca orice lucru in regula din aplicatie.
        */
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl">
          <div className="p-2 bg-white text-emerald-600 rounded-lg shrink-0 border border-emerald-100">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black text-slate-900 truncate">{ales.name}</p>
            <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-500 truncate">
              {ales.serialNumber}{ales.model ? ` · ${ales.model}` : ''}{ales.department ? ` · ${ales.department}` : ''}
            </p>
          </div>
          <button type="button" onClick={() => onChange('')}
            title="Scoate aparatul de pe tichet" aria-label="Scoate dispozitivul de pe tichet"
            className="px-3 py-2 bg-white border-2 border-emerald-200 text-slate-600 hover:text-red-600 hover:border-red-200 rounded-xl transition shrink-0 flex items-center gap-1.5 text-[11px] font-bold">
            <X className="w-3.5 h-3.5" /> Schimba
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
              className="w-full bg-white border-2 border-slate-200 rounded-2xl pl-11 pr-4 py-4 text-sm font-bold placeholder:font-semibold placeholder:text-slate-400 focus:border-slate-900 outline-none transition-all"
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
                  className="w-full text-left p-3.5 bg-white border-2 border-slate-100 rounded-2xl hover:border-emerald-300 hover:bg-emerald-50/50 transition flex items-center gap-3"
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
  onDelete,
  onVeziAparatul,
  onDeschide,
}: { 
  task: MedicalTask, 
  devices: MedicalDevice[], 
  onToggleStatus: (task: MedicalTask) => void, 
  onEdit: (task: MedicalTask) => void, 
  onDelete: (id: string) => void,
  onVeziAparatul?: (id: string) => void,
  onDeschide?: () => void,
}) => {
  const device = useMemo(() => devices.find(d => d.id === task.deviceId), [devices, task.deviceId]);
  
  /*
   * Tichetul se deschide apasand pe el, ca aparatul din Inventar. Butoanele de
   * pe rand isi opresc apasarea: cine apasa pe cos vrea sa stearga, nu sa
   * citeasca.
   */
  return (
    <div
      role={onDeschide ? 'button' : undefined}
      tabIndex={onDeschide ? 0 : undefined}
      onClick={onDeschide}
      onKeyDown={e => { if (onDeschide && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onDeschide(); } }}
      className={`bg-white rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex items-stretch group ${
        onDeschide ? 'cursor-pointer hover:border-blue-200' : ''
      }`}>
      <div className={`w-2 ${getPriorityColor(task.priority)} transition-all group-hover:w-3`} />
      <div className="p-4 sm:p-5 flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/*
            Intai ce s-a intamplat, apoi unde si la ce aparat.
            Randul cu prioritatea, sectia si aparatul statea deasupra titlului,
            asa ca ochiul citea "RIDICATA · RADIOLOGIE · Ecograf..." si abia pe
            randul urmator afla ca sonda nu porneste. Titlul vine primul.
          */}
          <h4 className={`text-[15px] sm:text-base font-bold text-slate-900 leading-snug break-words transition-colors ${
            onDeschide ? 'group-hover:text-blue-700' : ''
          }`}>{task.title}</h4>
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
              /*
                Numele aparatului e acum drumul catre fisa lui. Tichetul spune
                ce s-a stricat; ce s-a mai intamplat cu aparatul — istoricul,
                buletinul, dosarul — sta la doua tab-uri si o cautare distanta,
                si se ajungea acolo cautandu-l de mana in Inventar.
              */
              <button type="button"
                onClick={e => { e.stopPropagation(); if (task.deviceId) onVeziAparatul?.(task.deviceId); }}
                disabled={!task.deviceId || !onVeziAparatul}
                title={task.deviceId && onVeziAparatul ? 'Deschide fisa aparatului' : undefined}
                className={`text-[13px] font-medium text-slate-600 flex items-center gap-1.5 min-w-0 rounded-lg px-1 -mx-1 transition ${
                  task.deviceId && onVeziAparatul ? 'hover:text-blue-700 hover:bg-blue-50' : ''
                }`}>
                <Info className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{task.deviceName}</span>
                {device?.serialNumber && (
                  <span className="font-mono text-slate-500 shrink-0">· {device.serialNumber}</span>
                )}
              </button>
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
                  <button key={a.id} onClick={e => { e.stopPropagation(); openAttachment(a); }} title={a.name}
                    className="w-14 h-14 rounded-xl overflow-hidden border-2 border-slate-200 hover:border-blue-400 transition shadow-sm">
                    <AttachmentThumb attachment={a} />
                  </button>
                ) : (
                  <button key={a.id} onClick={e => { e.stopPropagation(); openAttachment(a); }} title={a.name}
                    className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-400 transition text-slate-600">
                    {a.kind === 'video' ? <Film className="w-4 h-4 text-purple-500" /> : <FileText className="w-4 h-4 text-blue-500" />}
                    <span className="text-[11px] font-bold max-w-[110px] truncate">{a.name}</span>
                  </button>
                )
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0" onClick={e => e.stopPropagation()}>
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
              {/*
                Scris, nu numai desenat: "intra pe tichet" trebuie sa se vada ca
                se poate, nu sa fie ghicit dintr-o iconita.
              */}
              {onDeschide && (
                <button
                  onClick={onDeschide}
                  className="px-3.5 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-[12px] font-bold hover:bg-blue-100 transition flex items-center gap-1.5 active:scale-95"
                  title="Deschide tichetul: descriere, note, documente"
                  aria-label="Deschide tichetul">
                  <ArrowRight className="w-3.5 h-3.5" />
                  Deschide
                  {(task.attachments || []).length > 0 && (
                    <span className="inline-flex items-center gap-0.5 pl-1.5 ml-0.5 border-l border-blue-200 text-blue-600">
                      <Paperclip className="w-3 h-3" />{task.attachments!.length}
                    </span>
                  )}
                </button>
              )}
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

export default React.memo(TaskTracker);
