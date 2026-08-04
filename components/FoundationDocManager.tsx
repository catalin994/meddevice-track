import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FolderOpen, Plus, Search, X, Pencil, Trash2, Download, Upload, Loader2,
  Paperclip, Link2, Unlink,
} from 'lucide-react';
import {
  FoundationDoc, FoundationDocType, FOUNDATION_DOC_RO, Referat,
} from '../types';
import Portal from './Portal';
import useEscape from './useEscape';
import ConfirmDialog from './ConfirmDialog';
import Pager, { usePagination, PageSizePicker } from './Pager';
import { saveFileAs } from '../services/fileService';
import { buildPath, uploadDataUrl, resolveSource } from '../services/fileStorage';

/**
 * Documentele care sustin valoarea estimata dintr-un referat.
 *
 * Nota justificativa, studiul de piata, ofertele — actele pe care le cere
 * dosarul achizitiei ca sa arate de unde vine suma. Fiecare stie carui referat
 * ii apartine, ca sa se poata deschide dosarul intr-un singur loc; unul
 * nelegat ramane valabil, doar ca se vede ca atare.
 */

const TIP_STYLES: Record<FoundationDocType, string> = {
  [FoundationDocType.NOTA_VALOARE]: 'bg-blue-50 text-blue-700 border-blue-200',
  [FoundationDocType.STUDIU_PIATA]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  [FoundationDocType.OFERTA]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [FoundationDocType.CAIET_SARCINI]: 'bg-amber-50 text-amber-700 border-amber-200',
  [FoundationDocType.NOTA_OPORTUNITATE]: 'bg-purple-50 text-purple-700 border-purple-200',
  [FoundationDocType.SPECIFICATII]: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  [FoundationDocType.ALTUL]: 'bg-slate-100 text-slate-600 border-slate-200',
};

const gol = () => ({
  referatId: '',
  type: FoundationDocType.OFERTA,
  number: '',
  date: new Date().toISOString().split('T')[0],
  supplier: '',
  amount: 0,
  currency: 'RON',
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
        || FOUNDATION_DOC_RO[d.type].toLowerCase().includes(q)
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
      referatId: d.referatId || '', type: d.type, number: d.number || '', date: d.date,
      supplier: d.supplier || '', amount: d.amount || 0, currency: d.currency || 'RON',
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
    onUpsert({
      id,
      referatId: form.referatId || undefined,
      type: form.type,
      number: form.number.trim() || undefined,
      date: form.date,
      supplier: form.supplier.trim() || undefined,
      amount: form.amount || undefined,
      currency: form.amount ? form.currency : undefined,
      notes: form.notes || undefined,
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
                      <span className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${TIP_STYLES[d.type]}`}>
                        {FOUNDATION_DOC_RO[d.type]}
                      </span>
                      {d.number && <p className="text-sm font-black text-slate-900">{d.number}</p>}
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
                    <p className="text-xs font-bold text-slate-500 mt-1.5">
                      {[d.supplier, d.date].filter(Boolean).join(' · ')}
                    </p>
                    {d.notes && <p className="text-[13px] font-semibold text-slate-600 mt-1 break-words">{d.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {!!d.amount && (
                    <p className="text-lg font-black text-slate-900">
                      {fmt(d.amount)} <span className="text-xs text-slate-500">{d.currency}</span>
                    </p>
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
                  <Camp eticheta="Tipul documentului" obligatoriu>
                    <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as FoundationDocType }))}
                      aria-label="Tipul documentului" className="camp">
                      {Object.values(FoundationDocType).map(t => (
                        <option key={t} value={t}>{FOUNDATION_DOC_RO[t]}</option>
                      ))}
                    </select>
                  </Camp>
                  <Camp eticheta="Data" obligatoriu>
                    <input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="camp" />
                  </Camp>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Camp eticheta="Numar inregistrare">
                    <input value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))}
                      placeholder="ex. 4471/2026" className="camp" />
                  </Camp>
                  <Camp eticheta="Emitent / furnizor">
                    <input value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}
                      placeholder="ex. Rafi Medical S.R.L" className="camp" />
                  </Camp>
                </div>

                <Camp eticheta="Valoare">
                  <div className="flex gap-2">
                    <input type="number" step="0.01" min="0" value={form.amount || ''}
                      onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                      placeholder="lasa gol daca documentul nu poarta o suma"
                      className="camp" style={{ flex: '1 1 auto', minWidth: 0 }} />
                    <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                      aria-label="Moneda" className="camp" style={{ flex: '0 0 auto', width: '6.5rem' }}>
                      <option>RON</option><option>EUR</option><option>USD</option>
                    </select>
                  </div>
                </Camp>

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
            {deSters ? FOUNDATION_DOC_RO[deSters.type] : ''}{deSters?.number ? ` ${deSters.number}` : ''}
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
