import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FolderOpen, Plus, Search, X, Pencil, Trash2, Download, Upload, Loader2,
  Paperclip, Link2, Unlink,
} from 'lucide-react';
import {
  FoundationDoc, FoundationDocType, FOUNDATION_DOC_RO, Referat,
  normaliseFoundationType,
} from '../types';
import Portal from './Portal';
import useEscape from './useEscape';
import ConfirmDialog from './ConfirmDialog';
import Pager, { usePagination, PageSizePicker } from './Pager';
import { saveFileAs } from '../services/fileService';
import { buildPath, uploadDataUrl, resolveSource } from '../services/fileStorage';

/**
 * Documentul de fundamentare, in forma pe care o cere legea.
 *
 * Prima varianta il trata ca pe o anexa la referat — o oferta, un studiu de
 * piata. Documentele reale arata altceva: e actul care justifica angajamentul
 * bugetar, cu numar unic de inregistrare, cu revizii succesive ale aceluiasi
 * document, si cu valoarea in trei coloane — cat era la revizia precedenta,
 * cu cat se schimba, cat devine. Ofertele sunt anexe la referat, nu documente
 * de fundamentare.
 *
 * Fiecare stie carui referat ii apartine, cand porneste de la unul; alocarile
 * lunare pe un contract subsecvent nu pornesc, si raman nelegate.
 */

const TIP_STYLES: Record<FoundationDocType, string> = {
  [FoundationDocType.ACHIZITIE_DIRECTA]: 'bg-blue-50 text-blue-700 border-blue-200',
  [FoundationDocType.CONTRACT_SUBSECVENT]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  [FoundationDocType.ACORD_CADRU]: 'bg-purple-50 text-purple-700 border-purple-200',
  [FoundationDocType.CONTRACT]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [FoundationDocType.COMANDA]: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  [FoundationDocType.ALTUL]: 'bg-slate-100 text-slate-600 border-slate-200',
};

/** Compartimentul emitent se repeta pe fiecare document al aceluiasi serviciu. */
const CHEIE_COMPARTIMENT = 'meditrack_df_compartiment';

const gol = () => ({
  referatId: '',
  type: FoundationDocType.ACHIZITIE_DIRECTA,
  number: '',
  date: new Date().toISOString().split('T')[0],
  revision: 0,
  revisionDate: new Date().toISOString().split('T')[0],
  compartment: (() => { try { return localStorage.getItem(CHEIE_COMPARTIMENT) || ''; } catch { return ''; } })(),
  subject: '',
  description: '',
  budgetArticle: '',
  ssiCode: '',
  program: '',
  parameters: '',
  previousValue: 0,
  influence: 0,
  currency: 'RON',
  supplier: '',
  referenceNumber: '',
  notes: '',
  filePath: undefined as string | undefined,
  fileUrl: '',
  fileName: '',
});

const fmt = (n: number) => n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const descarcaPdf = async (d: FoundationDoc) => {
  const source = await resolveSource({ path: d.filePath, url: d.fileUrl });
  if (source.blob || source.dataUrl) {
    await saveFileAs(d.fileName || `${d.number || 'document'}.pdf`, source.blob || source.dataUrl!);
  }
};

interface Props {
  docs: FoundationDoc[];
  referate: Referat[];
  onUpsert: (d: FoundationDoc) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  /** Cand se vine dinspre un referat, lista porneste filtrata pe el. */
  filtruReferat: string | null;
  onClearFiltruReferat: () => void;
}

const FoundationDocManager: React.FC<Props> = ({
  docs, referate, onUpsert, onDelete, canDelete, filtruReferat, onClearFiltruReferat,
}) => {
  const [cauta, setCauta] = useState('');
  const [filtruTip, setFiltruTip] = useState<'ALL' | FoundationDocType>('ALL');
  const [editez, setEditez] = useState(false);
  const [idEditat, setIdEditat] = useState<string | null>(null);
  const [form, setForm] = useState(gol());
  const [deSters, setDeSters] = useState<FoundationDoc | null>(null);
  const [seSalveaza, setSeSalveaza] = useState(false);
  useEscape(() => setEditez(false), editez);

  const referateDupaId = useMemo(() => new Map(referate.map(r => [r.id, r])), [referate]);
  const referatFiltrat = filtruReferat ? referateDupaId.get(filtruReferat) : null;

  // Venind dinspre un referat, cautarea libera ar restrange si mai mult fara
  // ca cineva sa fi cerut asta.
  useEffect(() => { if (filtruReferat) { setCauta(''); setFiltruTip('ALL'); } }, [filtruReferat]);

  const filtrate = useMemo(() => {
    const q = cauta.toLowerCase().trim();
    return docs
      .filter(d => !filtruReferat || d.referatId === filtruReferat)
      .filter(d => filtruTip === 'ALL' || d.type === filtruTip)
      .filter(d => !q
        || (d.number || '').toLowerCase().includes(q)
        || (d.supplier || '').toLowerCase().includes(q)
        || (d.notes || '').toLowerCase().includes(q)
        || (d.subject || '').toLowerCase().includes(q)
        || (d.description || '').toLowerCase().includes(q)
        || (d.budgetArticle || '').toLowerCase().includes(q)
        || (d.referenceNumber || '').toLowerCase().includes(q)
        || FOUNDATION_DOC_RO[normaliseFoundationType(d.type)].toLowerCase().includes(q)
        || (referateDupaId.get(d.referatId || '')?.number || '').toLowerCase().includes(q))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [docs, cauta, filtruTip, filtruReferat, referateDupaId]);

  const { pageItems, page, pageSize, setPageSize, pageCount, goToPage, topRef } =
    usePagination(filtrate, 'meditrack_fundamentare_page_size');

  const deschideNou = useCallback(() => {
    setForm({ ...gol(), referatId: filtruReferat || '' });
    setIdEditat(null); setEditez(true);
  }, [filtruReferat]);

  const deschideEditare = useCallback((d: FoundationDoc) => {
    setForm({
      referatId: d.referatId || '', type: normaliseFoundationType(d.type),
      number: d.number || '', date: d.date,
      revision: d.revision ?? 0, revisionDate: d.revisionDate || d.date,
      compartment: d.compartment || '',
      subject: d.subject || '', description: d.description || '',
      budgetArticle: d.budgetArticle || '', ssiCode: d.ssiCode || '', program: d.program || '',
      parameters: d.parameters || '',
      previousValue: d.previousValue || 0,
      influence: d.influence ?? ((d.amount || 0) - (d.previousValue || 0)),
      currency: d.currency || 'RON',
      supplier: d.supplier || '', referenceNumber: d.referenceNumber || '',
      notes: d.notes || '', filePath: d.filePath, fileUrl: d.fileUrl || '', fileName: d.fileName || '',
    });
    setIdEditat(d.id);
    setEditez(true);
  }, []);

  const ataseaza = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await new Promise<string>(res => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.readAsDataURL(file);
    });
    setForm(p => ({ ...p, fileUrl: dataUrl, fileName: file.name, filePath: undefined }));
    e.target.value = '';
  }, []);

  const salveaza = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSeSalveaza(true);
    const id = idEditat || crypto.randomUUID();
    let filePath = form.filePath;
    let inline: string | undefined = form.fileUrl || undefined;
    if (inline?.startsWith('data:')) {
      const urcat = await uploadDataUrl(buildPath('fundamentare', id, id, form.fileName || 'document.pdf'), inline);
      if (urcat.path) { filePath = urcat.path; inline = undefined; }
    }
    try { localStorage.setItem(CHEIE_COMPARTIMENT, form.compartment); } catch { /* comoditate */ }

    // Valoarea actualizata nu se tasteaza: e suma celorlalte doua, exact ca in
    // coloana "7 = 5 + 6" din formular.
    const actualizata = (form.previousValue || 0) + (form.influence || 0);

    onUpsert({
      id,
      referatId: form.referatId || undefined,
      type: form.type,
      number: form.number.trim() || undefined,
      date: form.date,
      revision: form.revision || 0,
      revisionDate: form.revisionDate || form.date,
      compartment: form.compartment.trim() || undefined,
      subject: form.subject.trim() || undefined,
      description: form.description.trim() || undefined,
      budgetArticle: form.budgetArticle.trim() || undefined,
      ssiCode: form.ssiCode.trim() || undefined,
      program: form.program.trim() || undefined,
      parameters: form.parameters.trim() || undefined,
      previousValue: form.previousValue || undefined,
      influence: form.influence || undefined,
      amount: actualizata || undefined,
      currency: actualizata ? form.currency : undefined,
      supplier: form.supplier.trim() || undefined,
      referenceNumber: form.referenceNumber.trim() || undefined,
      notes: form.notes.trim() || undefined,
      filePath,
      fileUrl: inline,
      fileName: form.fileName || undefined,
    });
    setSeSalveaza(false);
    setEditez(false);
  }, [idEditat, form, onUpsert]);

  return (
    <div className="space-y-4" ref={topRef}>
      {/* Venind dinspre un referat. Pe telefon textul si butonul nu incap unul
          langa altul: randul se rupe, si titlul se stramteaza intr-o coloana
          de trei cuvinte — de aceea se aseaza unul sub altul. */}
      {referatFiltrat && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 bg-indigo-50 border-2 border-indigo-100 rounded-2xl">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Link2 className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
            <p className="text-[13px] font-bold text-indigo-900 min-w-0">
              Dosarul referatului <span className="font-black">{referatFiltrat.number}</span> — {referatFiltrat.subject}
            </p>
          </div>
          <button
            onClick={onClearFiltruReferat}
            className="w-full sm:w-auto px-4 py-3 bg-white text-indigo-700 border border-indigo-200 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-100 transition shrink-0"
          >
            Vezi toate documentele
          </button>
        </div>
      )}

      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={cauta}
              onChange={e => setCauta(e.target.value)}
              placeholder="Cauta dupa numar, furnizor, tip sau referat..."
              aria-label="Cauta in documentele de fundamentare"
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-xl text-[15px] font-semibold outline-none"
            />
          </div>
          <button
            onClick={deschideNou}
            className="px-6 py-3.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition active:scale-95 flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" /> Document nou
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', ...Object.values(FoundationDocType)] as const).map(t => (
            <button
              key={t}
              onClick={() => setFiltruTip(t as 'ALL' | FoundationDocType)}
              className={`px-4 py-2.5 rounded-xl text-[11px] font-bold transition ${
                filtruTip === t ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t === 'ALL' ? 'Toate' : FOUNDATION_DOC_RO[t as FoundationDocType]}
            </button>
          ))}
          <div className="ml-auto"><PageSizePicker value={pageSize} onChange={setPageSize} /></div>
        </div>
      </div>

      {filtrate.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[2.5rem] border-4 border-dashed border-slate-50 flex flex-col items-center">
          <FolderOpen className="w-16 h-16 text-slate-100 mb-4" />
          <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">
            {docs.length === 0 ? 'Niciun document de fundamentare' : 'Niciun document gasit'}
          </p>
          <button onClick={deschideNou} className="mt-6 px-8 py-3.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest">
            + Adauga document
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {pageItems.map(d => {
            const ref = referateDupaId.get(d.referatId || '');
            return (
              <div key={d.id} className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="p-3 rounded-2xl shrink-0 bg-slate-50 text-slate-600">
                    <Paperclip className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${TIP_STYLES[normaliseFoundationType(d.type)]}`}>
                        {FOUNDATION_DOC_RO[normaliseFoundationType(d.type)]}
                      </span>
                      {d.number && <p className="text-sm font-black text-slate-900">{d.number}/{d.date}</p>}
                      {!!d.revision && (
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-bold"
                              title={`Revizuirea ${d.revision}${d.revisionDate ? ` din ${d.revisionDate}` : ''}`}>
                          rev. {d.revision}
                        </span>
                      )}
                      {ref ? (
                        <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[11px] font-bold flex items-center gap-1">
                          <Link2 className="w-3 h-3" />{ref.number}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-bold flex items-center gap-1"
                              title="Documentul nu e legat de niciun referat">
                          <Unlink className="w-3 h-3" />Fara referat
                        </span>
                      )}
                    </div>
                    {d.subject && <p className="text-[15px] font-bold text-slate-800 mt-1 break-words">{d.subject}</p>}
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      {[d.compartment, d.supplier, d.referenceNumber].filter(Boolean).join(' · ')}
                      {d.budgetArticle ? ` · art. ${d.budgetArticle}` : ''}
                    </p>
                    {d.notes && <p className="text-[13px] font-semibold text-slate-600 mt-1 break-words">{d.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {!!d.amount && (
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-900">
                        {fmt(d.amount)} <span className="text-xs text-slate-500">{d.currency}</span>
                      </p>
                      {!!d.influence && (
                        <p className={`text-[11px] font-bold ${d.influence > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {d.influence > 0 ? '+' : ''}{fmt(d.influence)} fata de rev. {Math.max(0, (d.revision || 1) - 1)}
                        </p>
                      )}
                    </div>
                  )}
                  {(d.filePath || d.fileUrl) && (
                    <button onClick={() => descarcaPdf(d)} className="p-3 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-xl transition" title="Descarca documentul" aria-label="Descarca documentul">
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => deschideEditare(d)} className="p-3 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-xl transition" title="Editeaza" aria-label="Editeaza documentul">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {canDelete && (
                    <button onClick={() => setDeSters(d)} className="p-3 bg-slate-50 text-slate-500 hover:text-red-600 rounded-xl transition" title="Sterge" aria-label="Sterge documentul">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <Pager page={page} pageCount={pageCount} pageSize={pageSize} total={filtrate.length} onGoTo={goToPage} />
        </div>
      )}

      {editez && (
        <Portal>
          <div className="fixed inset-0 z-[600] scrim flex items-start sm:items-center justify-center p-0 sm:p-6 overflow-y-auto">
            <form onSubmit={salveaza} className="modal-shell w-full max-w-2xl my-0 sm:my-8 rounded-none sm:rounded-[2.5rem] shadow-2xl animate-slide-up">
              <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-slate-100 sticky top-0 bg-white z-10">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    {idEditat ? 'Editeaza documentul' : 'Document de fundamentare'}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                    Justifica valoarea estimata dintr-un referat
                  </p>
                </div>
                <button type="button" onClick={() => setEditez(false)} aria-label="Inchide" className="p-3 bg-slate-50 text-slate-500 hover:text-slate-900 rounded-xl transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 sm:p-8 space-y-5">
                <Camp eticheta="Referatul sustinut">
                  <select value={form.referatId} onChange={e => setForm(p => ({ ...p, referatId: e.target.value }))}
                    aria-label="Referatul pe care il sustine documentul" className="camp">
                    <option value="">— Fara referat —</option>
                    {referate.map(r => (
                      <option key={r.id} value={r.id}>{r.number} · {r.subject.slice(0, 60)}</option>
                    ))}
                  </select>
                </Camp>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Camp eticheta="Element de fundamentare" obligatoriu>
                    <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as FoundationDocType }))}
                      aria-label="Elementul de fundamentare" className="camp">
                      {Object.values(FoundationDocType).map(t => (
                        <option key={t} value={t}>{FOUNDATION_DOC_RO[t]}</option>
                      ))}
                    </select>
                  </Camp>
                  <Camp eticheta="Compartiment de specialitate">
                    <input value={form.compartment} onChange={e => setForm(p => ({ ...p, compartment: e.target.value }))}
                      placeholder="ex. Serviciul Tehnic" className="camp" />
                  </Camp>
                </div>

                {/* "Numar unic de inregistrare: 17835/31.07.2026, revizuirea 7 / data 03.08.2026" */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Camp eticheta="Numar unic" obligatoriu>
                    <input required value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))}
                      placeholder="ex. 17835" className="camp" />
                  </Camp>
                  <Camp eticheta="Data" obligatoriu>
                    <input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="camp" />
                  </Camp>
                  <Camp eticheta="Revizuirea">
                    <input type="number" min="0" step="1" value={form.revision}
                      onChange={e => setForm(p => ({ ...p, revision: parseInt(e.target.value) || 0 }))}
                      aria-label="A cata revizuire" className="camp" />
                  </Camp>
                  <Camp eticheta="Data reviziei">
                    <input type="date" value={form.revisionDate}
                      onChange={e => setForm(p => ({ ...p, revisionDate: e.target.value }))} className="camp" />
                  </Camp>
                </div>

                <Camp eticheta="Descrierea pe scurt a obiectului" obligatoriu>
                  <input required value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                    placeholder="ex. Reparatie defibrilator Corpuls Elicopter 336" className="camp" />
                </Camp>

                <Camp eticheta="Descrierea pe larg a starii de fapt si de drept">
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Ce defectiuni are, de ce e necesara interventia, pe ce oferta sau contract se sprijina..."
                    className="camp min-h-[130px] resize-none" />
                </Camp>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Camp eticheta="Firma ofertanta / contractanta">
                    <input value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}
                      placeholder="ex. Deltamed" className="camp" />
                  </Camp>
                  <Camp eticheta="Nr. oferta / contract">
                    <input value={form.referenceNumber} onChange={e => setForm(p => ({ ...p, referenceNumber: e.target.value }))}
                      placeholder="ex. 17834/31.07.2026" className="camp" />
                  </Camp>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Camp eticheta="Articol bugetar">
                    <input value={form.budgetArticle} onChange={e => setForm(p => ({ ...p, budgetArticle: e.target.value }))}
                      placeholder="ex. 200109" className="camp" />
                  </Camp>
                  <Camp eticheta="Cod SSI">
                    <input value={form.ssiCode} onChange={e => setForm(p => ({ ...p, ssiCode: e.target.value }))}
                      placeholder="ex. 02F660601200109" className="camp" />
                  </Camp>
                  <Camp eticheta="Program">
                    <input value={form.program} onChange={e => setForm(p => ({ ...p, program: e.target.value }))}
                      placeholder="ex. 0000000000" className="camp" />
                  </Camp>
                </div>

                {/*
                  Valoarea, exact ca in tabelul din formular: coloana 5 e cat
                  era la revizia precedenta, 6 e influenta, iar 7 = 5 + 6 se
                  calculeaza — nu se tasteaza si nu se poate gresi.
                */}
                <div className="p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Valoarea angajamentelor legale</p>
                    <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                      aria-label="Moneda" className="camp bg-white" style={{ width: '6.5rem' }}>
                      <option>RON</option><option>EUR</option><option>USD</option>
                    </select>
                  </div>
                  <Camp eticheta="Parametrii de fundamentare">
                    <input value={form.parameters} onChange={e => setForm(p => ({ ...p, parameters: e.target.value }))}
                      placeholder="ex. 1x 3.226,67" className="camp bg-white" />
                  </Camp>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Camp eticheta="Revizia precedenta">
                      <input type="number" step="0.01" value={form.previousValue || ''}
                        onChange={e => setForm(p => ({ ...p, previousValue: parseFloat(e.target.value) || 0 }))}
                        placeholder="0.00" className="camp bg-white" />
                    </Camp>
                    <Camp eticheta="Influente +/−">
                      <input type="number" step="0.01" value={form.influence || ''}
                        onChange={e => setForm(p => ({ ...p, influence: parseFloat(e.target.value) || 0 }))}
                        placeholder="0.00" className="camp bg-white" />
                    </Camp>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Valoare actualizata</label>
                      <div className="px-4 py-3.5 bg-slate-900 text-white rounded-2xl text-[15px] font-black tabular-nums">
                        {fmt((form.previousValue || 0) + (form.influence || 0))}
                      </div>
                    </div>
                  </div>
                </div>

                <Camp eticheta="Observatii">
                  <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="ex. a treia oferta din studiul de piata"
                    className="camp min-h-[80px] resize-none" />
                </Camp>

                <div className="p-5 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-blue-600 rounded-xl shrink-0"><Paperclip className="w-5 h-5" /></div>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-widest">Documentul scanat</p>
                      <p className="text-[11px] text-white/50 font-bold mt-0.5 truncate">
                        {form.fileName || 'Ataseaza PDF-ul sau poza'}
                      </p>
                    </div>
                  </div>
                  <label className="px-5 py-3 bg-white text-slate-900 rounded-xl text-[11px] font-bold hover:bg-blue-50 transition flex items-center gap-2 shrink-0 cursor-pointer">
                    <Upload className="w-4 h-4" /> Incarca
                    <input type="file" accept="application/pdf,image/*" onChange={ataseaza} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="px-6 sm:px-8 py-5 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button type="button" onClick={() => setEditez(false)}
                  className="px-8 py-4 text-slate-600 font-black text-xs uppercase tracking-widest">Anuleaza</button>
                <button type="submit" disabled={seSalveaza}
                  className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition active:scale-95 flex items-center gap-2 disabled:opacity-60">
                  {seSalveaza && <Loader2 className="w-4 h-4 animate-spin" />}
                  {idEditat ? 'Salveaza modificarile' : 'Inregistreaza documentul'}
                </button>
              </div>
            </form>
          </div>
        </Portal>
      )}

      <ConfirmDialog
        open={!!deSters}
        title="Stergi documentul?"
        icon={<Trash2 className="w-8 h-8 sm:w-10 sm:h-10" />}
        body={<>
          <span className="font-black text-slate-900">
            {deSters ? FOUNDATION_DOC_RO[normaliseFoundationType(deSters.type)] : ''}{deSters?.number ? ` ${deSters.number}` : ''}
          </span>{' '}
          se sterge definitiv, impreuna cu fisierul atasat.
        </>}
        confirmLabel="Sterge documentul"
        onCancel={() => setDeSters(null)}
        onConfirm={() => { if (deSters) onDelete(deSters.id); setDeSters(null); }}
      />

      <style>{`.camp{width:100%;padding:0.85rem 1.1rem;background:#f8fafc;border:2px solid #e2e8f0;border-radius:1rem;font-size:0.9rem;font-weight:600;outline:none}.camp:focus{border-color:#3b82f6}`}</style>
    </div>
  );
};

const Camp = ({ eticheta, obligatoriu, children }: { eticheta: string; obligatoriu?: boolean; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
      {eticheta}{obligatoriu && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

export default React.memo(FoundationDocManager);
