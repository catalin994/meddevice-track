
import React, { useState, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import {
  Receipt, ShieldCheck, TrendingUp, Plus, X, Search, Loader2, Upload, FileText,
  CheckCircle, AlertTriangle, Clock, Trash2, Pencil, Download, Wallet, CalendarClock, Landmark,
  FolderOpen, FileSpreadsheet
} from 'lucide-react';
import { MedicalDevice, Invoice, InvoiceStatus, Contract } from '../types';
import ContractManager from './ContractManager';
import { saveFileAs } from '../services/fileService';
import { buildPath, uploadDataUrl, resolveSource } from '../services/fileStorage';

import Portal from './Portal';
import useEscape from './useEscape';
import Pager, { usePagination, PageSizePicker } from './Pager';
import ConfirmDialog from './ConfirmDialog';
import { extractInvoiceFields, pdfItemsToText } from '../services/invoiceParse';
const FinanceCharts = lazy(() => import('./FinanceCharts'));

interface FinanceManagerProps {
  devices: MedicalDevice[];
  invoices: Invoice[];
  onUpsertInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onSaveContract: (contract: Contract, deviceIds: string[]) => void;
}

type FinanceTab = 'OVERVIEW' | 'INVOICES' | 'CONTRACTS';

const emptyForm = () => ({
  invoiceNumber: '',
  supplier: '',
  issueDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  amount: 0,
  currency: 'RON',
  status: InvoiceStatus.UNPAID,
  contractNumber: '',
  description: '',
  fileUrl: '',
  fileName: '',
});

// An unpaid invoice past its due date is effectively overdue even if not marked so
export const effectiveStatus = (inv: Invoice): InvoiceStatus => {
  if (inv.status === InvoiceStatus.UNPAID && inv.dueDate && inv.dueDate < new Date().toISOString().split('T')[0]) {
    return InvoiceStatus.OVERDUE;
  }
  return inv.status;
};

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  [InvoiceStatus.PAID]: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  [InvoiceStatus.UNPAID]: 'bg-amber-50 text-amber-700 border-amber-200',
  [InvoiceStatus.OVERDUE]: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  [InvoiceStatus.PAID]: 'Platita',
  [InvoiceStatus.UNPAID]: 'Neplatita',
  [InvoiceStatus.OVERDUE]: 'Restanta',
};


interface BulkDraft {
  include: boolean;
  isDuplicate: boolean;
  invoiceNumber: string;
  supplier: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  contractNumber: string;
  deviceIds: string[];
  fileUrl: string;
  fileName: string;
}

/** Invoice PDFs live in Storage now; older ones are still inline. */
const downloadInvoicePdf = async (inv: Invoice) => {
  const source = await resolveSource({ path: inv.filePath, url: inv.fileUrl });
  if (source.blob || source.dataUrl) {
    await saveFileAs(inv.fileName || `${inv.invoiceNumber}.pdf`, source.blob || source.dataUrl!);
  }
};

const FinanceManager: React.FC<FinanceManagerProps> = ({ devices, invoices, onUpsertInvoice, onDeleteInvoice, onSaveContract }) => {
  const [tab, setTab] = useState<FinanceTab>('OVERVIEW');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  // The browser's own confirm() looked like a system fault next to the rest of
  // the app, and on a phone it is a grey slab with the site's hostname on it.
  const [pendingDelete, setPendingDelete] = useState<Invoice | null>(null);
  useEscape(() => setIsEditing(false), isEditing);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | InvoiceStatus>('ALL');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractNote, setExtractNote] = useState('');
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Bulk folder import
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [bulkDrafts, setBulkDrafts] = useState<BulkDraft[] | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const devicesMap = useMemo(() => new Map(devices.map(d => [d.id, d])), [devices]);

  const globalContracts = useMemo(() => Array.from(
    new Map<string, Contract>(
      devices.flatMap(d => d.contracts || []).map(c => [c.contractNumber, c])
    ).values()
  ), [devices]);

  // ---- Overview aggregations ----
  const dominantCurrency = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach(i => { counts[i.currency] = (counts[i.currency] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'RON';
  }, [invoices]);

  const totals = useMemo(() => {
    const inCurrency = invoices.filter(i => i.currency === dominantCurrency);
    const thisYear = new Date().getFullYear().toString();
    return {
      yearTotal: inCurrency.filter(i => i.issueDate?.startsWith(thisYear)).reduce((s, i) => s + i.amount, 0),
      unpaid: inCurrency.filter(i => effectiveStatus(i) !== InvoiceStatus.PAID).reduce((s, i) => s + i.amount, 0),
      overdueCount: invoices.filter(i => effectiveStatus(i) === InvoiceStatus.OVERDUE).length,
      contractsAnnual: globalContracts.reduce((s, c) => s + (c.annualCost || 0), 0),
    };
  }, [invoices, dominantCurrency, globalContracts]);

  const monthlyData = useMemo(() => {
    const months: { month: string; total: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7); // YYYY-MM
      const label = d.toLocaleDateString('ro-RO', { month: 'short' });
      const total = invoices
        .filter(inv => inv.currency === dominantCurrency && inv.issueDate?.startsWith(key))
        .reduce((s, inv) => s + inv.amount, 0);
      months.push({ month: label, total });
    }
    return months;
  }, [invoices, dominantCurrency]);

  const expiringContracts = useMemo(() => {
    const today = new Date();
    const limit = new Date();
    limit.setDate(limit.getDate() + 90);
    return globalContracts
      .filter(c => { const end = new Date(c.endDate); return end >= today && end <= limit; })
      .sort((a, b) => a.endDate.localeCompare(b.endDate));
  }, [globalContracts]);

  const topDevicesByCost = useMemo(() => {
    const costs = new Map<string, number>();
    invoices.forEach(inv => {
      if (inv.currency !== dominantCurrency) return;
      const share = inv.deviceIds.length > 0 ? inv.amount / inv.deviceIds.length : 0;
      inv.deviceIds.forEach(id => costs.set(id, (costs.get(id) || 0) + share));
    });
    return Array.from(costs.entries())
      .map(([id, total]) => ({ device: devicesMap.get(id), total }))
      .filter(x => x.device)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [invoices, devicesMap, dominantCurrency]);

  // ---- Invoice list filtering ----
  const filteredInvoices = useMemo(() => {
    const q = listSearch.toLowerCase();
    return invoices
      .filter(inv => statusFilter === 'ALL' || effectiveStatus(inv) === statusFilter)
      .filter(inv => !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.supplier.toLowerCase().includes(q) ||
        (inv.contractNumber || '').toLowerCase().includes(q) ||
        (inv.description || '').toLowerCase().includes(q) ||
        // also by the devices the cost is attached to, which is how someone
        // usually arrives here: from a piece of equipment, not from a number
        (inv.deviceIds || []).some(id => {
          const d = devices.find(x => x.id === id);
          return !!d && (d.name.toLowerCase().includes(q) || (d.serialNumber || '').toLowerCase().includes(q));
        }))
      .sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
  }, [invoices, listSearch, statusFilter, devices]);

  const { pageItems: pagedInvoices, page, pageSize, setPageSize, pageCount, goToPage, topRef } =
    usePagination(filteredInvoices, 'meditrack_invoices_page_size');

  // ---- PDF auto-detection ----
  const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;
    setIsExtracting(true);
    setExtractNote('');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(new Blob([arrayBuffer], { type: 'application/pdf' }));
      });

      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      // O pagina o data: coordonatele o iau de la capat la fiecare pagina, iar
      // randurile se reconstruiesc din ele.
      const pagini: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const content = await (await pdf.getPage(i)).getTextContent();
        pagini.push(pdfItemsToText(content.items as any));
      }
      const text = pagini.join('\n');
      const fields = extractInvoiceFields(text, file.name, devices, globalContracts);

      setForm(prev => ({
        ...prev,
        invoiceNumber: fields.invoiceNumber || prev.invoiceNumber,
        amount: fields.amount || prev.amount,
        currency: fields.currency,
        issueDate: fields.issueDate || prev.issueDate,
        // Scadenta era citita si aruncata: campul exista in formular, dar nimic
        // nu il completa, si se tasta de mana la fiecare factura.
        dueDate: fields.dueDate || prev.dueDate,
        contractNumber: fields.contractNumber || prev.contractNumber,
        supplier: fields.supplier || prev.supplier,
        fileUrl: base64,
        fileName: file.name,
      }));
      if (fields.deviceIds.length > 0) {
        setSelectedDeviceIds(prev => Array.from(new Set([...prev, ...fields.deviceIds])));
      }
      // Spune si ce a gasit, si ce n-a gasit: un camp ramas gol se vede greu
      // intr-un formular lung, iar suma gresita se corecteaza doar daca stii
      // ca trebuie sa te uiti la ea.
      const gasit = [
        fields.invoiceNumber && `nr. ${fields.invoiceNumber}`,
        fields.amount && `${fields.amount.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} ${fields.currency}`,
        fields.issueDate && `emisa ${fields.issueDate}`,
        fields.dueDate && `scadenta ${fields.dueDate}`,
        fields.deviceIds.length && `${fields.deviceIds.length} dispozitiv${fields.deviceIds.length === 1 ? '' : 'e'}`,
        fields.contractNumber && `contract ${fields.contractNumber}`,
      ].filter(Boolean);
      const lipsa = [
        !fields.invoiceNumber && 'numarul',
        !fields.amount && 'suma',
        !fields.issueDate && 'data',
      ].filter(Boolean);
      setExtractNote(
        (gasit.length ? `Detectat: ${gasit.join(' · ')}` : 'PDF atasat')
        + (lipsa.length ? ` — completeaza ${lipsa.join(' si ')}` : '')
      );
    } catch {
      setExtractNote('PDF atasat (extragerea automata a esuat)');
    } finally {
      setIsExtracting(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  }, [devices, globalContracts]);

  // ---- Bulk folder import ----
  const handleBulkImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (files.length === 0) return;

    setIsBulkProcessing(true);
    setBulkProgress({ done: 0, total: files.length });
    setBulkDrafts(null);

    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

    const existingNumbers = new Set(invoices.map(i => i.invoiceNumber.toLowerCase().trim()).filter(Boolean));
    const seenInBatch = new Set<string>();
    const drafts: BulkDraft[] = [];

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(new Blob([arrayBuffer], { type: 'application/pdf' }));
        });

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pagini: string[] = [];
        for (let p = 1; p <= pdf.numPages; p++) {
          const content = await (await pdf.getPage(p)).getTextContent();
          pagini.push(pdfItemsToText(content.items as any));
        }
        const text = pagini.join('\n');

        const fields = extractInvoiceFields(text, file.name, devices, globalContracts);
        const numKey = fields.invoiceNumber.toLowerCase().trim();
        const isDuplicate = !!numKey && (existingNumbers.has(numKey) || seenInBatch.has(numKey));
        if (numKey) seenInBatch.add(numKey);

        drafts.push({
          include: !isDuplicate,
          isDuplicate,
          invoiceNumber: fields.invoiceNumber || file.name.replace(/\.pdf$/i, ''),
          supplier: fields.supplier,
          issueDate: fields.issueDate || new Date().toISOString().split('T')[0],
          dueDate: fields.dueDate,
          amount: fields.amount,
          currency: fields.currency,
          contractNumber: fields.contractNumber,
          deviceIds: fields.deviceIds,
          fileUrl: base64,
          fileName: file.name,
        });
      } catch {
        drafts.push({
          include: false, isDuplicate: false,
          invoiceNumber: file.name.replace(/\.pdf$/i, ''), supplier: '', amount: 0, currency: 'RON',
          issueDate: new Date().toISOString().split('T')[0], dueDate: '',
          contractNumber: '', deviceIds: [], fileUrl: '', fileName: `${file.name} (eroare la citire)`,
        });
      }
      setBulkProgress({ done: fi + 1, total: files.length });
    }

    setIsBulkProcessing(false);
    setBulkDrafts(drafts);
    if (bulkInputRef.current) bulkInputRef.current.value = '';
  }, [devices, globalContracts, invoices]);

  const updateBulkDraft = useCallback((index: number, updates: Partial<BulkDraft>) => {
    setBulkDrafts(prev => prev ? prev.map((d, i) => i === index ? { ...d, ...updates } : d) : prev);
  }, []);

  const handleBulkSave = useCallback(async () => {
    if (!bulkDrafts) return;
    const toSave = bulkDrafts.filter(d => d.include && d.invoiceNumber.trim());
    if (toSave.length === 0) return;
    setIsBulkSaving(true);
    for (const d of toSave) {
      const id = crypto.randomUUID();
      // Each PDF goes to Storage rather than into the invoice row
      let filePath: string | undefined;
      let inlineUrl: string | undefined = d.fileUrl || undefined;
      if (inlineUrl?.startsWith('data:')) {
        const uploaded = await uploadDataUrl(buildPath('invoices', id, id, d.fileName || 'factura.pdf'), inlineUrl);
        if (uploaded.path) { filePath = uploaded.path; inlineUrl = undefined; }
      }
      await onUpsertInvoice({
        id,
        invoiceNumber: d.invoiceNumber.trim(),
        supplier: d.supplier.trim() || 'Necunoscut',
        issueDate: d.issueDate,
        dueDate: d.dueDate || undefined,
        amount: d.amount,
        currency: d.currency,
        status: InvoiceStatus.UNPAID,
        contractNumber: d.contractNumber || undefined,
        deviceIds: d.deviceIds,
        filePath,
        fileUrl: inlineUrl,
        fileName: d.fileName || undefined,
      });
    }
    setIsBulkSaving(false);
    setBulkDrafts(null);
    setTab('INVOICES');
  }, [bulkDrafts, onUpsertInvoice]);

  // ---- Centralizator Excel export ----
  const handleExportExcel = useCallback(async () => {
    if (invoices.length === 0) return;
    const XLSX = await import('xlsx');
    const rows = [...invoices]
      .sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''))
      .map(inv => ({
        'NR. FACTURA': inv.invoiceNumber,
        'FURNIZOR': inv.supplier,
        'DATA EMITERII': inv.issueDate,
        'SCADENTA': inv.dueDate || '',
        'SUMA': inv.amount,
        'MONEDA': inv.currency,
        'STATUS': STATUS_LABELS[effectiveStatus(inv)],
        'CONTRACT': inv.contractNumber || '',
        'DISPOZITIVE': inv.deviceIds.map(id => devicesMap.get(id)?.name || id).join(', '),
        'SERII': inv.deviceIds.map(id => devicesMap.get(id)?.serialNumber || '').filter(Boolean).join(', '),
        'DESCRIERE': inv.description || '',
      }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 16 }, { wch: 40 }, { wch: 30 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Centralizator Facturi');
    XLSX.writeFile(wb, `Centralizator_Facturi_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [invoices, devicesMap]);

  // ---- Form handlers ----
  const openNew = useCallback(() => {
    setForm(emptyForm());
    setSelectedDeviceIds([]);
    setEditingId(null);
    setExtractNote('');
    setIsEditing(true);
  }, []);

  const openEdit = useCallback((inv: Invoice) => {
    setForm({
      invoiceNumber: inv.invoiceNumber,
      supplier: inv.supplier,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate || '',
      amount: inv.amount,
      currency: inv.currency,
      status: inv.status,
      contractNumber: inv.contractNumber || '',
      description: inv.description || '',
      fileUrl: inv.fileUrl || '',
      fileName: inv.fileName || '',
    });
    setSelectedDeviceIds(inv.deviceIds || []);
    setEditingId(inv.id);
    setExtractNote('');
    setIsEditing(true);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingId || crypto.randomUUID();

    // The PDF goes to Storage; keeping it inline would put a whole document
    // inside the invoice row and drag it through every sync.
    let filePath: string | undefined;
    let inlineUrl: string | undefined = form.fileUrl || undefined;
    if (inlineUrl?.startsWith('data:')) {
      const uploaded = await uploadDataUrl(buildPath('invoices', id, id, form.fileName || 'factura.pdf'), inlineUrl);
      if (uploaded.path) { filePath = uploaded.path; inlineUrl = undefined; }
    }

    const invoice: Invoice = {
      id,
      invoiceNumber: form.invoiceNumber.trim(),
      supplier: form.supplier.trim(),
      issueDate: form.issueDate,
      dueDate: form.dueDate || undefined,
      amount: form.amount,
      currency: form.currency,
      status: form.status,
      contractNumber: form.contractNumber || undefined,
      deviceIds: selectedDeviceIds,
      description: form.description || undefined,
      filePath,
      fileUrl: inlineUrl,
      fileName: form.fileName || undefined,
    };
    onUpsertInvoice(invoice);
    setIsEditing(false);
  }, [editingId, form, selectedDeviceIds, onUpsertInvoice]);

  const toggleDevice = useCallback((id: string) => {
    setSelectedDeviceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const filteredFormDevices = useMemo(() => {
    const q = deviceSearch.toLowerCase();
    if (!q) return devices.slice(0, 30);
    return devices.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.serialNumber.toLowerCase().includes(q) ||
      d.department.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [devices, deviceSearch]);

  const fmt = (n: number) => n.toLocaleString('ro-RO', { maximumFractionDigits: 2 });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + tabs */}
      <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-xl border border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Wallet className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Financiar</h2>
              <p className="text-sm text-slate-500 font-bold uppercase mt-1 tracking-widest">Facturi & Contracte Service</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input ref={bulkInputRef} type="file" accept="application/pdf" multiple onChange={handleBulkImport} className="hidden" />
            <button onClick={() => bulkInputRef.current?.click()} disabled={isBulkProcessing}
              className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition shadow-xl active:scale-95 flex items-center gap-2 disabled:opacity-50">
              {isBulkProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderOpen className="w-5 h-5" />}
              {isBulkProcessing ? `Procesare ${bulkProgress.done}/${bulkProgress.total}...` : 'Import Folder PDF'}
            </button>
            <button onClick={openNew} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition shadow-xl shadow-blue-600/20 active:scale-95 flex items-center gap-2">
              <Plus className="w-5 h-5" /> Adauga Factura
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-8">
          {([
            ['OVERVIEW', 'Sumar', TrendingUp],
            ['INVOICES', 'Facturi', Receipt],
            ['CONTRACTS', 'Contracte', ShieldCheck],
          ] as [FinanceTab, string, any][]).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-6 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition ${tab === key ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:text-slate-900'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ============ OVERVIEW ============ */}
      {tab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={<Receipt className="w-5 h-5" />} label={`Facturat ${new Date().getFullYear()}`} value={`${fmt(totals.yearTotal)} ${dominantCurrency}`} tone="blue" />
            <KpiCard icon={<Clock className="w-5 h-5" />} label="De plata" value={`${fmt(totals.unpaid)} ${dominantCurrency}`} tone="amber" />
            <KpiCard icon={<AlertTriangle className="w-5 h-5" />} label="Facturi restante" value={`${totals.overdueCount}`} tone="red" />
            <KpiCard icon={<Landmark className="w-5 h-5" />} label="Contracte / an" value={`${fmt(totals.contractsAnnual)}`} tone="indigo" />
          </div>

          <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Cheltuieli lunare</h3>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Ultimele 12 luni · {dominantCurrency}</span>
            </div>
            <Suspense fallback={<div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>}>
              <FinanceCharts monthlyData={monthlyData} currency={dominantCurrency} />
            </Suspense>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expiring contracts */}
            <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-500" /> Contracte care expira (90 zile)
              </h3>
              {expiringContracts.length === 0 ? (
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest py-8 text-center">Niciun contract nu expira curand</p>
              ) : (
                <div className="space-y-3">
                  {expiringContracts.map(c => (
                    <div key={c.contractNumber} className="flex items-center justify-between p-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
                      <div>
                        <p className="text-sm font-black text-slate-900">{c.provider}</p>
                        <p className="text-[11px] font-mono text-slate-500">{c.contractNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-amber-600">{c.endDate}</p>
                        <p className="text-[11px] font-bold text-slate-500">{fmt(c.annualCost)}/an</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top devices by cost */}
            <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" /> Top dispozitive dupa cost
              </h3>
              {topDevicesByCost.length === 0 ? (
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest py-8 text-center">Nicio factura asociata cu dispozitive</p>
              ) : (
                <div className="space-y-3">
                  {topDevicesByCost.map(({ device, total }, i) => (
                    <div key={device!.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                      <span className="w-7 h-7 shrink-0 bg-slate-900 text-white rounded-lg flex items-center justify-center text-[11px] font-black">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{device!.name}</p>
                        <p className="text-[11px] font-mono text-slate-500">SN: {device!.serialNumber}</p>
                      </div>
                      <p className="text-sm font-black text-blue-600 shrink-0">{fmt(total)} {dominantCurrency}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ INVOICES ============ */}
      {tab === 'INVOICES' && (
        <div className="space-y-4">
          <div className="bg-white p-5 sm:p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1 min-w-[15rem]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="Cauta dupa numar, furnizor sau contract..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {(['ALL', InvoiceStatus.PAID, InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-4 py-3 rounded-xl text-[11px] font-bold transition ${statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:text-slate-900'}`}>
                  {s === 'ALL' ? 'Toate' : STATUS_LABELS[s]}
                </button>
              ))}
              <button onClick={handleExportExcel} disabled={invoices.length === 0}
                className="px-4 py-3 bg-emerald-600 text-white rounded-xl text-[11px] font-bold hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-40 shadow-lg shadow-emerald-600/20"
                title="Exporta centralizatorul facturilor in Excel">
                <FileSpreadsheet className="w-4 h-4" /> Centralizator
              </button>
              <PageSizePicker value={pageSize} onChange={setPageSize} />
            </div>
          </div>

          <div ref={topRef} className="scroll-mt-4" />

          {filteredInvoices.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-[2.5rem] border-4 border-dashed border-slate-50 flex flex-col items-center">
              <Receipt className="w-16 h-16 text-slate-100 mb-4" />
              <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Nicio factura inregistrata</p>
              <button onClick={openNew} className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest">+ Adauga prima factura</button>
            </div>
          ) : (
            <div className="space-y-3">
              {pagedInvoices.map(inv => {
                const st = effectiveStatus(inv);
                return (
                  <div key={inv.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`p-3 rounded-2xl shrink-0 ${st === InvoiceStatus.PAID ? 'bg-emerald-50 text-emerald-600' : st === InvoiceStatus.OVERDUE ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                        <Receipt className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-sm font-black text-slate-900">{inv.invoiceNumber}</p>
                          <span className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${STATUS_STYLES[st]}`}>{STATUS_LABELS[st]}</span>
                          {inv.contractNumber && (
                            <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-[11px] font-bold flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />{inv.contractNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-500 mt-1 truncate">{inv.supplier} · {inv.issueDate}{inv.dueDate ? ` · scadenta ${inv.dueDate}` : ''}</p>
                        {inv.deviceIds.length > 0 && (
                          <p className="text-[11px] font-bold text-slate-500 mt-0.5 truncate">
                            {inv.deviceIds.slice(0, 3).map(id => devicesMap.get(id)?.name || id).join(', ')}
                            {inv.deviceIds.length > 3 ? ` +${inv.deviceIds.length - 3}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <p className="text-lg font-black text-slate-900">{fmt(inv.amount)} <span className="text-xs text-slate-500">{inv.currency}</span></p>
                      {(inv.filePath || inv.fileUrl) && (
                        <button onClick={() => downloadInvoicePdf(inv)} className="p-2.5 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-xl transition" title="Descarca PDF" aria-label="Descarca PDF">
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => openEdit(inv)} className="p-2.5 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-xl transition" title="Editeaza" aria-label="Editeaza">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setPendingDelete(inv)} className="p-2.5 bg-slate-50 text-slate-500 hover:text-red-600 rounded-xl transition" title="Sterge" aria-label={`Sterge factura ${inv.invoiceNumber}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <Pager page={page} pageCount={pageCount} pageSize={pageSize}
                total={filteredInvoices.length} onGoTo={goToPage} />
            </div>
          )}
        </div>
      )}

      {/* ============ CONTRACTS ============ */}
      {tab === 'CONTRACTS' && (
        <ContractManager devices={devices} onSaveContract={onSaveContract} />
      )}

      {/* ============ BULK IMPORT REVIEW MODAL ============ */}
      {bulkDrafts && (
        <Portal>
        <div className="fixed inset-0 z-[500] scrim flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-6xl modal-shell overflow-hidden flex flex-col animate-fade-in">
            <div className="p-6 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Centralizare Facturi PDF</h3>
                <p className="text-[11px] text-slate-500 font-black uppercase mt-1 tracking-widest">
                  {bulkDrafts.length} fisiere procesate · {bulkDrafts.filter(d => d.include).length} selectate pentru salvare
                  {bulkDrafts.some(d => d.isDuplicate) && <span className="text-amber-500"> · {bulkDrafts.filter(d => d.isDuplicate).length} duplicate detectate</span>}
                </p>
              </div>
              <button onClick={() => setBulkDrafts(null)} className="p-3 bg-white text-slate-500 rounded-2xl hover:text-slate-900 transition shadow-sm border border-slate-200"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2">
              {/* Column headers */}
              <div className="hidden lg:grid grid-cols-[24px_1.2fr_1.4fr_110px_130px_90px_120px] gap-3 px-4 pb-1">
                {['', 'Nr. factura', 'Furnizor', 'Data', 'Suma', 'Moneda', 'Asocieri'].map((h, i) => (
                  <p key={i} className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{h}</p>
                ))}
              </div>
              {bulkDrafts.map((d, i) => (
                <div key={i} className={`grid grid-cols-1 lg:grid-cols-[24px_1.2fr_1.4fr_110px_130px_90px_120px] gap-3 items-center p-4 rounded-2xl border transition ${d.isDuplicate ? 'bg-amber-50/60 border-amber-200' : d.include ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                  <button onClick={() => updateBulkDraft(i, { include: !d.include })}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition ${d.include ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                    {d.include && <CheckCircle className="w-4 h-4" />}
                  </button>
                  <div className="min-w-0">
                    <input value={d.invoiceNumber} onChange={e => updateBulkDraft(i, { invoiceNumber: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500/20" />
                    {d.isDuplicate && <p className="text-[11px] font-black text-amber-600 uppercase tracking-widest mt-1">Duplicat — exista deja</p>}
                    <p className="text-[11px] text-slate-500 font-bold truncate mt-0.5" title={d.fileName}>{d.fileName}</p>
                  </div>
                  <input value={d.supplier} onChange={e => updateBulkDraft(i, { supplier: e.target.value })} placeholder="Furnizor"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20" />
                  <input type="date" value={d.issueDate} onChange={e => updateBulkDraft(i, { issueDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold outline-none" />
                  <input type="number" step="0.01" value={d.amount || ''} onChange={e => updateBulkDraft(i, { amount: parseFloat(e.target.value) || 0 })} placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none text-right" />
                  <select value={d.currency} onChange={e => updateBulkDraft(i, { currency: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold outline-none">
                    <option>RON</option><option>EUR</option><option>USD</option>
                  </select>
                  <div className="flex flex-col gap-1">
                    {d.deviceIds.length > 0
                      ? <span className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[11px] font-bold text-center">{d.deviceIds.length} dispozitiv{d.deviceIds.length > 1 ? 'e' : ''}</span>
                      : <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[11px] font-bold text-center">fara disp.</span>}
                    {d.contractNumber && <span className="px-2 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-[11px] font-bold text-center truncate" title={d.contractNumber}>{d.contractNumber}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Facturile se salveaza cu status "Neplatita" — le poti actualiza ulterior
              </p>
              <div className="flex gap-3">
                <button onClick={() => setBulkDrafts(null)} className="px-8 py-4 text-slate-500 font-black text-xs uppercase tracking-widest">Anuleaza</button>
                <button onClick={handleBulkSave} disabled={isBulkSaving || bulkDrafts.filter(d => d.include).length === 0}
                  className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition active:scale-95 disabled:opacity-50 flex items-center gap-2">
                  {isBulkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Salveaza {bulkDrafts.filter(d => d.include).length} facturi
                </button>
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* ============ INVOICE MODAL ============ */}
      {isEditing && (
        <Portal>
        <div className="fixed inset-0 z-[500] scrim flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl modal-shell overflow-hidden flex flex-col animate-fade-in">
            <div className="p-6 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">{editingId ? 'Editeaza Factura' : 'Factura Noua'}</h3>
                <p className="text-[11px] text-slate-500 font-black uppercase mt-1 tracking-widest">Asociaza cu contracte si dispozitive</p>
              </div>
              <button onClick={() => setIsEditing(false)} className="p-3 bg-white text-slate-500 rounded-2xl hover:text-slate-900 transition shadow-sm border border-slate-200"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
              {/* PDF upload / auto-detect */}
              <div className="bg-slate-900 p-6 rounded-3xl text-white">
                <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-600 rounded-xl"><FileText className="w-5 h-5" /></div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest">Import PDF factura</p>
                      <p className="text-[11px] text-white/50 font-bold mt-0.5">
                        {form.fileName || 'Detecteaza automat numarul, suma, dispozitivele si contractul'}
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={() => pdfInputRef.current?.click()} disabled={isExtracting}
                    className="px-6 py-3 bg-white text-slate-900 rounded-xl text-[11px] font-bold hover:bg-blue-50 transition flex items-center gap-2 disabled:opacity-50 shrink-0">
                    {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {isExtracting ? 'Se analizeaza...' : 'Incarca PDF'}
                  </button>
                </div>
                {extractNote && (
                  <div className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-[11px] font-bold text-emerald-300">{extractNote}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Numar factura" required>
                  <input required value={form.invoiceNumber} onChange={e => setForm(p => ({ ...p, invoiceNumber: e.target.value }))} placeholder="ex. FCT-2026-0042" className="fin-input" />
                </Field>
                <Field label="Furnizor" required>
                  <input required value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))} placeholder="ex. GE HealthCare" className="fin-input" />
                </Field>
                <Field label="Data emiterii" required>
                  <input required type="date" value={form.issueDate} onChange={e => setForm(p => ({ ...p, issueDate: e.target.value }))} className="fin-input" />
                </Field>
                <Field label="Data scadentei">
                  <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} className="fin-input" />
                </Field>
                <Field label="Suma" required>
                  <div className="flex gap-2">
                    <input required type="number" step="0.01" min="0" value={form.amount || ''} onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} placeholder="0.00" className="fin-input" style={{ flex: '1 1 auto', minWidth: 0 }} />
                    <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className="fin-input" style={{ flex: '0 0 auto', width: '6.5rem' }}>
                      <option>RON</option><option>EUR</option><option>USD</option>
                    </select>
                  </div>
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as InvoiceStatus }))} className="fin-input">
                    <option value={InvoiceStatus.UNPAID}>Neplatita</option>
                    <option value={InvoiceStatus.PAID}>Platita</option>
                    <option value={InvoiceStatus.OVERDUE}>Restanta</option>
                  </select>
                </Field>
                <Field label="Contract asociat">
                  <select value={form.contractNumber} onChange={e => setForm(p => ({ ...p, contractNumber: e.target.value }))} className="fin-input">
                    <option value="">— Fara contract —</option>
                    {globalContracts.map(c => (
                      <option key={c.contractNumber} value={c.contractNumber}>{c.contractNumber} · {c.provider}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Descriere">
                  <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="ex. Revizie anuala, piese schimb..." className="fin-input" />
                </Field>
              </div>

              {/* Device association */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-black text-slate-900 uppercase tracking-widest">Dispozitive asociate</p>
                  <span className="text-[11px] font-black text-blue-600 uppercase">{selectedDeviceIds.length} selectate</span>
                </div>
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <input value={deviceSearch} onChange={e => setDeviceSearch(e.target.value)} placeholder="Cauta dupa nume, serie sau departament..."
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none" />
                </div>
                <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                  {/* Selected devices pinned on top */}
                  {selectedDeviceIds.filter(id => !filteredFormDevices.some(d => d.id === id)).map(id => {
                    const d = devicesMap.get(id);
                    if (!d) return null;
                    return (
                      <DeviceRow key={id} device={d} selected onToggle={() => toggleDevice(id)} />
                    );
                  })}
                  {filteredFormDevices.map(d => (
                    <DeviceRow key={d.id} device={d} selected={selectedDeviceIds.includes(d.id)} onToggle={() => toggleDevice(d.id)} />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsEditing(false)} className="px-8 py-4 text-slate-500 font-black text-xs uppercase tracking-widest">Anuleaza</button>
                <button type="submit" className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition active:scale-95">
                  {editingId ? 'Salveaza modificarile' : 'Inregistreaza factura'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Stergi factura?"
        icon={<Trash2 className="w-8 h-8 sm:w-10 sm:h-10" />}
        body={<>
          Factura <span className="font-black text-slate-900">{pendingDelete?.invoiceNumber}</span>
          {pendingDelete?.supplier ? <> de la <span className="font-black text-slate-900">{pendingDelete.supplier}</span></> : null}
          {' '}se sterge definitiv din evidenta.
        </>}
        confirmLabel="Sterge factura"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) onDeleteInvoice(pendingDelete.id); setPendingDelete(null); }}
      />

      {/* Local input styling */}
      <style>{`.fin-input{width:100%;padding:0.85rem 1.1rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:1rem;font-size:0.85rem;font-weight:700;outline:none}.fin-input:focus{box-shadow:0 0 0 4px rgba(37,99,235,0.08)}`}</style>
    </div>
  );
};

const KpiCard = ({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'blue' | 'amber' | 'red' | 'indigo' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
      <div className={`inline-flex p-2.5 rounded-xl mb-4 ${tones[tone]}`}>{icon}</div>
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-black text-slate-900 mt-1 truncate">{value}</p>
    </div>
  );
};

const DeviceRow = ({ device, selected, onToggle }: { device: MedicalDevice; selected: boolean; onToggle: () => void }) => (
  <div onClick={onToggle}
    className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition ${selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-100 hover:border-blue-200'}`}>
    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${selected ? 'bg-white/20 border-white/40' : 'border-slate-200'}`}>
      {selected && <CheckCircle className="w-3.5 h-3.5" />}
    </div>
    <div className="flex-1 min-w-0">
      <p className={`text-xs font-black truncate ${selected ? 'text-white' : 'text-slate-900'}`}>{device.name}</p>
      <p className={`text-[11px] font-mono ${selected ? 'text-white/60' : 'text-slate-500'}`}>SN: {device.serialNumber} · {device.department}</p>
    </div>
  </div>
);

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}{required && ' *'}</label>
    {children}
  </div>
);

export default React.memo(FinanceManager);
