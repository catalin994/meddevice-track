import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ShoppingCart, Plus, X, Search, Loader2, FileText, Pencil, Trash2, Package,
  CheckCircle, Truck, Link2,
} from 'lucide-react';
import {
  Comanda, ComandaItem, ComandaStatus, COMANDA_STATUS_RO, normaliseComandaStatus,
  comandaValoare, comandaPrimit, Invoice, Referat, MedicalDevice,
} from '../types';
import Portal from './Portal';
import useEscape from './useEscape';
import ConfirmDialog from './ConfirmDialog';
import Pager, { usePagination, PageSizePicker } from './Pager';
import { citesteComandaPdf } from '../services/comandaParse';
import { buildPath, uploadDataUrl } from '../services/fileStorage';
import { notify } from '../services/notices';

/**
 * Comenzile catre furnizori.
 *
 * Comanda e actul pe care furnizorul il executa, si singurul loc din dosar unde
 * scrie ce anume s-a cerut, in cate bucati si la ce pret. Pana acum nu exista
 * nicaieri in aplicatie: se stia ca s-a facut un referat si ca a venit o
 * factura, dar nu si ce s-a comandat intre ele.
 *
 * Ce se urmareste aici nu e cati bani are comanda, ci ce se intampla cu ea: cat
 * a venit din fiecare pozitie, ce facturi au sosit pe ea, si de cate zile e
 * deschisa.
 */

const lei = (n: number) => n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_STYLES: Record<ComandaStatus, string> = {
  [ComandaStatus.EMISA]: 'bg-blue-50 text-blue-700 border-blue-200',
  [ComandaStatus.CONFIRMATA]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  [ComandaStatus.PARTIAL]: 'bg-amber-50 text-amber-700 border-amber-200',
  [ComandaStatus.LIVRATA]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [ComandaStatus.ANULATA]: 'bg-slate-100 text-slate-500 border-slate-200',
};

/** De cate zile e deschisa comanda. Numai pentru cele nelivrate. */
const zileDeschisa = (c: Comanda): number | null => {
  const s = normaliseComandaStatus(c.status);
  if (s === ComandaStatus.LIVRATA || s === ComandaStatus.ANULATA) return null;
  if (!c.date || Number.isNaN(Date.parse(c.date))) return null;
  const azi = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00');
  return Math.max(0, Math.round((azi.getTime() - Date.parse(`${c.date}T00:00:00`)) / 86400000));
};

const gol = () => ({
  number: '',
  date: new Date().toISOString().split('T')[0],
  supplier: '',
  supplierCui: '',
  referatNumber: '',
  offerNumber: '',
  contractNumber: '',
  frameworkContract: '',
  warehouse: '',
  paymentDays: 0,
  items: [] as ComandaItem[],
  currency: 'RON',
  status: ComandaStatus.EMISA,
  totalWithVat: 0,
  deliveredAt: '',
  notes: '',
  deviceIds: [] as string[],
  filePath: undefined as string | undefined,
  fileUrl: '',
  fileName: '',
  fileSize: 0,
});

interface Props {
  comenzi: Comanda[];
  invoices: Invoice[];
  referate: Referat[];
  devices: MedicalDevice[];
  onUpsert: (c: Comanda) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}

const ComenziManager: React.FC<Props> = ({ comenzi, invoices, referate, devices, onUpsert, onDelete, canDelete }) => {
  const [cauta, setCauta] = useState('');
  const [filtruStatus, setFiltruStatus] = useState<'ALL' | ComandaStatus>('ALL');
  const [editez, setEditez] = useState(false);
  const [idEditat, setIdEditat] = useState<string | null>(null);
  const [form, setForm] = useState(gol());
  const [deSters, setDeSters] = useState<Comanda | null>(null);
  const [deschis, setDeschis] = useState<string | null>(null);
  const [citeste, setCiteste] = useState(false);
  const [notaPdf, setNotaPdf] = useState('');
  const [randuriCitite, setRanduriCitite] = useState<string[]>([]);
  const [aratRanduri, setAratRanduri] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);
  useEscape(() => setEditez(false), editez);

  /** Facturile unei comenzi: numarul comenzii e tiparit pe ele. */
  const facturileComenzii = useCallback((c: Comanda) => invoices.filter(i =>
    (i.orderNumber || '').trim() === (c.number || '').trim() && !!c.number), [invoices]);

  const filtrate = useMemo(() => {
    const q = cauta.toLowerCase().trim();
    return comenzi
      .filter(c => filtruStatus === 'ALL' || normaliseComandaStatus(c.status) === filtruStatus)
      .filter(c => !q
        || (c.number || '').toLowerCase().includes(q)
        || (c.supplier || '').toLowerCase().includes(q)
        || (c.referatNumber || '').toLowerCase().includes(q)
        || (c.warehouse || '').toLowerCase().includes(q)
        || (c.items || []).some(it => (it.name || '').toLowerCase().includes(q)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [comenzi, cauta, filtruStatus]);

  const { pageItems, page, pageSize, setPageSize, pageCount, goToPage, topRef } =
    usePagination(filtrate, 'meditrack_comenzi_page_size');

  const deschideNou = useCallback(() => {
    setForm(gol()); setIdEditat(null); setNotaPdf(''); setRanduriCitite([]); setEditez(true);
  }, []);

  const deschideEditarea = useCallback((c: Comanda) => {
    setForm({
      ...gol(),
      number: c.number || '', date: c.date || new Date().toISOString().split('T')[0],
      supplier: c.supplier || '', supplierCui: c.supplierCui || '',
      referatNumber: c.referatNumber || '', offerNumber: c.offerNumber || '',
      contractNumber: c.contractNumber || '', frameworkContract: c.frameworkContract || '',
      warehouse: c.warehouse || '', paymentDays: c.paymentDays || 0,
      items: (c.items || []).map(it => ({ ...it })),
      currency: c.currency || 'RON', status: normaliseComandaStatus(c.status),
      totalWithVat: c.totalWithVat || 0, deliveredAt: c.deliveredAt || '',
      notes: c.notes || '', deviceIds: c.deviceIds || [],
      filePath: c.filePath, fileUrl: c.fileUrl || '', fileName: c.fileName || '', fileSize: c.fileSize || 0,
    });
    setIdEditat(c.id); setNotaPdf(''); setRanduriCitite([]); setEditez(true);
  }, []);

  /**
   * Comanda in PDF: se ataseaza si isi da datele.
   *
   * Pozitiile sunt partea care conteaza — tastate de mana, o comanda cu zece
   * repere ia mai mult decat merita, si greselile de cantitate nu se vad decat
   * cand vine marfa.
   */
  const incarcaPdf = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setCiteste(true); setNotaPdf('');
    try {
      const c = await citesteComandaPdf(f, (pag, din, proc) =>
        setNotaPdf(`Comanda scanata — se citeste cu OCR: pagina ${pag} din ${din}, ${proc}%`));
      setRanduriCitite(c.lines);
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(f);
      });
      const id = idEditat || `COM-${crypto.randomUUID()}`;
      const urcat = await uploadDataUrl(buildPath('comenzi', id, id, f.name), dataUrl);

      setForm(prev => ({
        ...prev,
        number: c.number || prev.number,
        date: c.date || prev.date,
        supplier: c.supplier || prev.supplier,
        supplierCui: c.supplierCui || prev.supplierCui,
        referatNumber: c.referatNumber || prev.referatNumber,
        offerNumber: c.offerNumber || prev.offerNumber,
        contractNumber: c.contractNumber || prev.contractNumber,
        frameworkContract: c.frameworkContract || prev.frameworkContract,
        warehouse: c.warehouse || prev.warehouse,
        paymentDays: c.paymentDays || prev.paymentDays,
        items: c.items.length ? c.items : prev.items,
        totalWithVat: c.totalCuTva || prev.totalWithVat,
        filePath: urcat.path || undefined,
        fileUrl: urcat.path ? '' : dataUrl,
        fileName: f.name,
        fileSize: f.size,
      }));

      const gasit = [
        c.number && `nr. ${c.number}`,
        c.supplier,
        c.items.length && `${c.items.length} pozi${c.items.length === 1 ? 'tie' : 'tii'}`,
        c.totalCuTva && `${lei(c.totalCuTva)} lei cu TVA`,
        c.referatNumber && `referat ${c.referatNumber}`,
      ].filter(Boolean);
      const lipsa = [
        !c.number && 'numarul',
        !c.supplier && 'furnizorul',
        !c.items.length && 'pozitiile',
      ].filter(Boolean);
      setNotaPdf((gasit.length ? `Citit din comanda: ${gasit.join(' · ')}` : 'PDF atasat, dar n-am recunoscut niciun camp')
        + (lipsa.length ? ` — completeaza ${lipsa.join(', ')}` : '')
        + (c.prinOcr ? ' · citit cu OCR' : '')
        + (urcat.path ? '' : ' · fisierul a ramas doar pe acest aparat'));
    } catch (err: any) {
      setNotaPdf(`PDF-ul nu a putut fi citit${err?.message ? `: ${err.message}` : ''}`);
    } finally {
      setCiteste(false);
    }
  }, [idEditat]);

  const salveaza = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!form.number.trim()) { notify('Comanda are nevoie de un numar.', 'warning'); return; }
    onUpsert({
      id: idEditat || `COM-${crypto.randomUUID()}`,
      number: form.number.trim(),
      date: form.date,
      supplier: form.supplier.trim(),
      supplierCui: form.supplierCui.trim() || undefined,
      referatNumber: form.referatNumber.trim() || undefined,
      offerNumber: form.offerNumber.trim() || undefined,
      contractNumber: form.contractNumber.trim() || undefined,
      frameworkContract: form.frameworkContract.trim() || undefined,
      warehouse: form.warehouse.trim() || undefined,
      paymentDays: form.paymentDays || undefined,
      items: form.items,
      currency: form.currency,
      status: form.status,
      totalWithVat: form.totalWithVat || undefined,
      deliveredAt: form.deliveredAt || undefined,
      notes: form.notes.trim() || undefined,
      deviceIds: form.deviceIds,
      filePath: form.filePath,
      fileUrl: form.fileUrl || undefined,
      fileName: form.fileName || undefined,
      fileSize: form.fileSize || undefined,
    });
    setEditez(false);
    notify(idEditat ? 'Comanda actualizata' : 'Comanda salvata', 'success');
  }, [form, idEditat, onUpsert]);

  const schimbaPozitia = (id: string, ce: Partial<ComandaItem>) =>
    setForm(p => ({ ...p, items: p.items.map(it => it.id === id ? { ...it, ...ce } : it) }));

  /**
   * Formularul se randeaza si pe pagina unei comenzi, nu doar in lista:
   * butonul Modifica de acolo altfel deschidea o fereastra care nu exista.
   */
  const formularul = editez && (
    <Portal>
      <div className="fixed inset-0 z-[600] scrim flex items-center justify-center p-0 sm:p-6">
        <div className="bg-white w-full max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] overflow-hidden flex flex-col rounded-none sm:rounded-[2.5rem] shadow-2xl animate-slide-up">
          <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-slate-100 shrink-0">
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                {idEditat ? 'Modifica comanda' : 'Comanda noua'}
              </h3>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                {idEditat ? `Nr. com. ${form.number}` : 'Catre furnizor'}
              </p>
            </div>
            <button onClick={() => setEditez(false)} aria-label="Inchide"
              className="p-3 bg-slate-50 text-slate-500 hover:text-slate-900 rounded-xl transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={salveaza} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-5">
            <div className="bg-slate-900 p-5 rounded-2xl text-white">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h4 className="text-sm font-black uppercase tracking-widest">Comanda in PDF</h4>
              </div>
              <p className="text-[12px] font-semibold text-slate-300 leading-relaxed mb-4">
                Se ataseaza si se citesc din ea numarul, data, furnizorul, referatul, gestiunea,
                termenul de plata si pozitiile cu cantitati si preturi.
              </p>
              <input ref={pdfRef} type="file" accept="application/pdf" onChange={incarcaPdf} className="hidden" />
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => pdfRef.current?.click()} disabled={citeste}
                  className="px-5 py-3 bg-blue-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2">
                  {citeste ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {citeste ? 'Se citeste...' : form.fileName ? 'Alege alt PDF' : 'Incarca PDF-ul comenzii'}
                </button>
                {form.fileName && <span className="text-[12px] font-bold text-emerald-300 truncate max-w-[220px]">{form.fileName}</span>}
              </div>
              {notaPdf && <p className="mt-3 text-[12px] font-bold text-blue-200 leading-relaxed">{notaPdf}</p>}
              {randuriCitite.length > 0 && (
                <div className="mt-3">
                  <button type="button" onClick={() => setAratRanduri(v => !v)}
                    className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition">
                    {aratRanduri ? 'Ascunde' : 'Vezi'} textul citit ({randuriCitite.length} randuri)
                  </button>
                  {aratRanduri && (
                    <pre className="mt-2 max-h-56 overflow-y-auto bg-black/40 rounded-xl p-3 text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
                      {randuriCitite.join('\n')}
                    </pre>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Camp eticheta="Nr. comanda" obligatoriu>
                <input required value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))}
                  name="number" placeholder="ex. 1984" className="camp" />
              </Camp>
              <Camp eticheta="Data comenzii" obligatoriu>
                <input required type="date" name="date" value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="camp" />
              </Camp>
              <Camp eticheta="Furnizor">
                <input value={form.supplier} name="supplier" onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}
                  placeholder="ex. MED4LIFE SUPPLIER S.R.L." className="camp" />
              </Camp>
              <Camp eticheta="Cod fiscal furnizor">
                <input value={form.supplierCui} name="supplierCui" onChange={e => setForm(p => ({ ...p, supplierCui: e.target.value }))}
                  placeholder="ex. 42196701" className="camp" />
              </Camp>
              <Camp eticheta="Numar referat">
                <input value={form.referatNumber} name="referatNumber" onChange={e => setForm(p => ({ ...p, referatNumber: e.target.value }))}
                  placeholder="ex. 14/24389/24.07.26" className="camp" />
              </Camp>
              <Camp eticheta="Numar oferta">
                <input value={form.offerNumber} name="offerNumber" onChange={e => setForm(p => ({ ...p, offerNumber: e.target.value }))}
                  className="camp" />
              </Camp>
              <Camp eticheta="Contract">
                <input value={form.contractNumber} name="contractNumber" onChange={e => setForm(p => ({ ...p, contractNumber: e.target.value }))}
                  className="camp" />
              </Camp>
              <Camp eticheta="Acord-cadru">
                <input value={form.frameworkContract} name="frameworkContract" onChange={e => setForm(p => ({ ...p, frameworkContract: e.target.value }))}
                  className="camp" />
              </Camp>
              <Camp eticheta="Gestiunea">
                <input value={form.warehouse} name="warehouse" onChange={e => setForm(p => ({ ...p, warehouse: e.target.value }))}
                  placeholder="ex. G10 / PIESE SCHIMB DIVERSE" className="camp" />
              </Camp>
              <Camp eticheta="Termen de plata (zile)">
                <input type="number" value={form.paymentDays || ''} name="paymentDays"
                  onChange={e => setForm(p => ({ ...p, paymentDays: parseInt(e.target.value, 10) || 0 }))}
                  placeholder="60" className="camp" />
              </Camp>
              <Camp eticheta="Starea comenzii">
                <select value={form.status} name="status" aria-label="Starea comenzii"
                  onChange={e => setForm(p => ({ ...p, status: e.target.value as ComandaStatus }))} className="camp">
                  {Object.values(ComandaStatus).map(st => (
                    <option key={st} value={st}>{COMANDA_STATUS_RO[st]}</option>
                  ))}
                </select>
              </Camp>
              <Camp eticheta="Data livrarii">
                <input type="date" value={form.deliveredAt} name="deliveredAt"
                  onChange={e => setForm(p => ({ ...p, deliveredAt: e.target.value }))} className="camp" />
              </Camp>
            </div>

            {/* ── pozitiile, cu ce a venit din fiecare ── */}
            <div className="p-4 sm:p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                  Pozitiile comenzii ({form.items.length})
                </p>
                <button type="button"
                  onClick={() => setForm(p => ({ ...p, items: [...p.items,
                    { id: `P-${Date.now()}`, name: '', unit: 'BUC', quantity: 1, unitPrice: 0 }] }))}
                  className="px-4 py-2 bg-white border-2 border-slate-200 text-slate-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:border-blue-200 hover:text-blue-600 transition">
                  + Adauga pozitie
                </button>
              </div>
              {form.items.length === 0 && (
                <p className="text-[12px] font-bold text-slate-500">
                  Nicio pozitie. Incarca PDF-ul comenzii sau adauga-le de mana.
                </p>
              )}
              {form.items.map((it, i) => (
                <div key={it.id} className="grid grid-cols-2 sm:grid-cols-[1fr_70px_80px_100px_90px_40px] gap-2 items-center">
                  <input value={it.name} onChange={e => schimbaPozitia(it.id, { name: e.target.value })}
                    placeholder="Denumire articol" aria-label={`Denumire pozitia ${i + 1}`}
                    className="col-span-2 sm:col-span-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none" />
                  <input value={it.unit} onChange={e => schimbaPozitia(it.id, { unit: e.target.value })}
                    aria-label={`U.M. pozitia ${i + 1}`}
                    className="px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none text-center" />
                  <input type="number" step="0.001" value={it.quantity}
                    onChange={e => schimbaPozitia(it.id, { quantity: parseFloat(e.target.value) || 0 })}
                    aria-label={`Cantitate pozitia ${i + 1}`}
                    className="px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none text-right" />
                  <input type="number" step="0.01" value={it.unitPrice}
                    onChange={e => schimbaPozitia(it.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                    aria-label={`Pret pozitia ${i + 1}`}
                    className="px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none text-right" />
                  <input type="number" step="0.001" value={it.received ?? ''}
                    onChange={e => schimbaPozitia(it.id, { received: parseFloat(e.target.value) || 0 })}
                    placeholder="primit" aria-label={`Primit pozitia ${i + 1}`}
                    title="Cate bucati au venit din pozitia asta"
                    className="px-2 py-2 bg-white border border-emerald-200 rounded-lg text-xs font-bold outline-none text-right" />
                  <button type="button" onClick={() => setForm(p => ({ ...p, items: p.items.filter(x => x.id !== it.id) }))}
                    aria-label={`Sterge pozitia ${i + 1}`}
                    className="p-2 text-slate-400 hover:text-red-600 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {form.items.length > 0 && (
                <div className="flex justify-between pt-2 border-t border-slate-200 text-[13px] font-black text-slate-900">
                  <span>Total fara TVA</span>
                  <span className="tabular-nums">{lei(comandaValoare(form.items))} lei</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Camp eticheta="Total cu TVA (de pe comanda)">
                <input type="number" step="0.01" value={form.totalWithVat || ''} name="totalWithVat"
                  onChange={e => setForm(p => ({ ...p, totalWithVat: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00" className="camp" />
              </Camp>
              <Camp eticheta="Observatii">
                <input value={form.notes} name="notes" onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="camp" />
              </Camp>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button type="button" onClick={() => setEditez(false)}
                className="px-6 py-4 text-slate-500 font-black text-xs uppercase tracking-widest">Renunta</button>
              <button type="submit"
                className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {idEditat ? 'Salveaza modificarile' : 'Inregistreaza comanda'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );

  // ══════════════════ pagina unei comenzi ══════════════════
  const comandaDeschisa = comenzi.find(c => c.id === deschis);
  if (comandaDeschisa) {
    const c = comandaDeschisa;
    const items = c.items || [];
    const valoare = comandaValoare(items);
    const primit = comandaPrimit(items);
    const facturi = facturileComenzii(c);
    const facturat = facturi.reduce((s, i) => s + (i.amount || 0), 0);
    const plafon = c.totalWithVat || valoare;
    const referat = referate.find(r => (r.number || '').trim() === (c.referatNumber || '').trim() && !!c.referatNumber);
    const zile = zileDeschisa(c);
    const procLivrat = valoare > 0 ? Math.min(100, (primit / valoare) * 100) : 0;
    const procFacturat = plafon > 0 ? Math.min(100, (facturat / plafon) * 100) : 0;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-xl border border-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <button onClick={() => setDeschis(null)}
                className="text-[11px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition mb-3">
                ← Inapoi la comenzi
              </button>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight break-words">
                  {c.supplier || 'Comanda'}
                </h2>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Nr. com.</span>
                  <span className="text-[15px] font-black font-mono">{c.number}</span>
                </span>
                <span className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest border ${STATUS_STYLES[normaliseComandaStatus(c.status)]}`}>
                  {COMANDA_STATUS_RO[normaliseComandaStatus(c.status)]}
                </span>
              </div>
              <p className="text-sm text-slate-500 font-bold mt-1">
                {c.date}
                {c.warehouse && ` · ${c.warehouse}`}
                {!!c.paymentDays && ` · termen de plata ${c.paymentDays} zile`}
                {zile !== null && ` · deschisa de ${zile} ${zile === 1 ? 'zi' : 'zile'}`}
              </p>
            </div>
            <button onClick={() => deschideEditarea(c)}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Modifica
            </button>
          </div>

          {/* Trimiterile de pe comanda: de unde vine si pe ce se sprijina. */}
          <div className="flex flex-wrap gap-2 mt-5">
            {referat && (
              <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-[11px] font-bold flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> Referat {referat.number} · {referat.subject}
              </span>
            )}
            {!referat && c.referatNumber && (
              <span className="px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-[11px] font-bold">
                Referat {c.referatNumber} (negasit in aplicatie)
              </span>
            )}
            {c.offerNumber && (
              <span className="px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-[11px] font-bold">
                Oferta {c.offerNumber}
              </span>
            )}
            {c.contractNumber && (
              <span className="px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-[11px] font-bold">
                Contract {c.contractNumber}
              </span>
            )}
            {c.frameworkContract && (
              <span className="px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-[11px] font-bold">
                Acord-cadru {c.frameworkContract}
              </span>
            )}
          </div>
        </div>

        {/* ── ce se intampla cu comanda ── */}
        <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Valoarea comenzii</p>
              <p className="text-xl font-black text-slate-900 tabular-nums mt-1">{lei(valoare)} lei</p>
              <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                fara TVA{c.totalWithVat ? ` · ${lei(c.totalWithVat)} cu TVA` : ''}
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-2xl">
              <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Primit</p>
              <p className="text-xl font-black text-amber-700 tabular-nums mt-1">{lei(primit)} lei</p>
              <p className="text-[11px] font-bold text-amber-600/80 mt-0.5">
                {items.filter(it => (it.received ?? 0) >= (it.quantity || 0) && (it.quantity || 0) > 0).length} din {items.length} pozitii complete
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-2xl">
              <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Facturat</p>
              <p className="text-xl font-black text-blue-700 tabular-nums mt-1">{lei(facturat)} lei</p>
              <p className="text-[11px] font-bold text-blue-600/80 mt-0.5">
                {facturi.length} factur{facturi.length === 1 ? 'a' : 'i'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">
                <span>Livrat</span><span>{Math.round(procLivrat)}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${procLivrat}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">
                <span>Facturat{c.totalWithVat ? ' (fata de valoarea cu TVA)' : ''}</span>
                <span>{Math.round(procFacturat)}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${procFacturat}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── pozitiile ── */}
          <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">
              Ce s-a comandat ({items.length})
            </h3>
            {items.length === 0 ? (
              <p className="text-[13px] font-bold text-slate-500">Nicio pozitie trecuta pe comanda.</p>
            ) : (
              <div className="space-y-2">
                {items.map(it => {
                  const primite = it.received ?? 0;
                  const complet = primite >= (it.quantity || 0) && (it.quantity || 0) > 0;
                  return (
                    <div key={it.id} className={`px-4 py-3 rounded-2xl border ${complet ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold text-slate-900 break-words">{it.name}</p>
                          <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                            {it.quantity} {it.unit} × {lei(it.unitPrice)}
                            {it.account && ` · cont ${it.account}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[14px] font-black text-slate-900 tabular-nums">
                            {lei((it.quantity || 0) * (it.unitPrice || 0))}
                          </p>
                          <p className={`text-[10px] font-black uppercase tracking-wide ${complet ? 'text-emerald-600' : primite > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {complet ? 'primit' : primite > 0 ? `primit ${primite}/${it.quantity}` : 'in asteptare'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── facturile ── */}
          <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">
              Facturi pe aceasta comanda ({facturi.length})
            </h3>
            {facturi.length === 0 ? (
              <p className="text-[13px] font-bold text-slate-500 leading-relaxed">
                Nicio factura sosita inca. Facturile se leaga singure, dupa numarul comenzii tiparit pe ele.
              </p>
            ) : (
              <div className="space-y-2">
                {facturi.map(i => (
                  <div key={i.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-slate-900 truncate">
                        {i.invoiceNumber} <span className="text-[11px] font-bold text-slate-500">· {i.issueDate}</span>
                      </p>
                      <p className="text-[11px] font-bold text-slate-500 truncate">{i.description || i.supplier}</p>
                    </div>
                    <p className="text-[14px] font-black text-slate-900 tabular-nums shrink-0">{lei(i.amount || 0)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {formularul}
      </div>
    );
  }

  // ══════════════════ lista ══════════════════
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={cauta} onChange={e => setCauta(e.target.value)}
              placeholder="Cauta dupa numar, furnizor, referat sau articol..."
              aria-label="Cauta in comenzi"
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-xl text-[15px] font-semibold outline-none" />
          </div>
          <button onClick={deschideNou}
            className="px-6 py-3.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Comanda noua
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['ALL', ...Object.values(ComandaStatus)] as ('ALL' | ComandaStatus)[]).map(st => (
            <button key={st} onClick={() => setFiltruStatus(st)}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition ${
                filtruStatus === st ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-600 hover:text-slate-900'
              }`}>
              {st === 'ALL' ? 'Toate' : COMANDA_STATUS_RO[st]}
            </button>
          ))}
        </div>
      </div>

      <div ref={topRef} className="scroll-mt-4" />
      {filtrate.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[2.5rem] border-4 border-dashed border-slate-50 flex flex-col items-center">
          <ShoppingCart className="w-16 h-16 text-slate-100 mb-4" />
          <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">
            {comenzi.length === 0 ? 'Nicio comanda inregistrata' : 'Nicio comanda gasita'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pageItems.map(c => {
            const st = normaliseComandaStatus(c.status);
            const valoare = comandaValoare(c.items || []);
            const facturi = facturileComenzii(c);
            const zile = zileDeschisa(c);
            return (
              <button key={c.id} onClick={() => setDeschis(c.id)}
                aria-label={`Deschide comanda ${c.number}`}
                className="w-full text-left bg-white p-4 sm:p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl shrink-0">
                  <Package className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black text-white bg-slate-900 px-2 py-0.5 rounded-md">
                      Nr. com. {c.number}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide border ${STATUS_STYLES[st]}`}>
                      {COMANDA_STATUS_RO[st]}
                    </span>
                    {facturi.length > 0 && (
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-black uppercase tracking-wide">
                        {facturi.length} factur{facturi.length === 1 ? 'a' : 'i'}
                      </span>
                    )}
                    {zile !== null && zile > 30 && (
                      <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-black uppercase tracking-wide">
                        deschisa de {zile} zile
                      </span>
                    )}
                  </div>
                  <p className="text-[15px] font-bold text-slate-900 mt-1 truncate">{c.supplier || 'Fara furnizor'}</p>
                  <p className="text-[11px] font-bold text-slate-500 truncate">
                    {c.date}
                    {(c.items || []).length > 0 && ` · ${(c.items || []).length} pozitii · ${(c.items || [])[0].name}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[16px] font-black text-slate-900 tabular-nums">{lei(valoare)}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">fara TVA</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span onClick={e => { e.stopPropagation(); deschideEditarea(c); }}
                    role="button" tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); deschideEditarea(c); } }}
                    aria-label={`Modifica comanda ${c.number}`}
                    className="p-2.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:text-blue-600 hover:border-blue-200 transition">
                    <Pencil className="w-4 h-4" />
                  </span>
                  {canDelete && (
                    <span onClick={e => { e.stopPropagation(); setDeSters(c); }}
                      role="button" tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setDeSters(c); } }}
                      aria-label={`Sterge comanda ${c.number}`}
                      className="p-2.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:text-red-600 hover:border-red-200 transition">
                      <Trash2 className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <PageSizePicker value={pageSize} onChange={setPageSize} />
            <Pager page={page} pageCount={pageCount} pageSize={pageSize} total={filtrate.length} onGoTo={goToPage} />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deSters}
        title="Stergi comanda?"
        icon={<Trash2 className="w-8 h-8" />}
        body={<>Comanda <span className="font-black text-slate-900">{deSters?.number}</span> catre{' '}
          {deSters?.supplier} se sterge definitiv.</>}
        confirmLabel="Sterge comanda"
        onCancel={() => setDeSters(null)}
        onConfirm={() => { if (deSters) onDelete(deSters.id); setDeSters(null); }}
      />

      {formularul}

      <style>{`.camp{width:100%;padding:0.85rem 1.1rem;background:#f8fafc;border:2px solid #e2e8f0;border-radius:1rem;font-size:0.9rem;font-weight:600;outline:none}.camp:focus{border-color:#3b82f6}`}</style>
    </div>
  );
};

const Camp: React.FC<{ eticheta: string; obligatoriu?: boolean; children: React.ReactNode }> = ({ eticheta, obligatoriu, children }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1">
      {eticheta}{obligatoriu && <span className="text-red-500"> *</span>}
    </label>
    {children}
  </div>
);

export default ComenziManager;
