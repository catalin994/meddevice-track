import React, { useCallback, useMemo, useState } from 'react';
import {
  FileSignature, Plus, Search, X, Pencil, Trash2, Download, Upload, Loader2,
  Paperclip, Building2, CheckCircle, FileDown,
} from 'lucide-react';
import {
  MedicalDevice, Referat, ReferatItem, ReferatStatus, REFERAT_STATUS_RO,
  FoundationDoc, referatTotal, getUniqueDepartments,
} from '../types';
import Portal from './Portal';
import useEscape from './useEscape';
import ConfirmDialog from './ConfirmDialog';
import DepartmentPicker from './DepartmentPicker';
import Pager, { usePagination, PageSizePicker } from './Pager';
import SablonPanel from './SablonPanel';
import { saveFileAs } from '../services/fileService';
import { buildPath, uploadDataUrl, resolveSource } from '../services/fileStorage';
import { referatDocx, numeFisier } from '../services/documenteAchizitie';
import { notify } from '../services/notices';

/**
 * Referatul de necesitate — inceputul dosarului unei achizitii.
 *
 * Sectia scrie ce ii trebuie si de ce; abia dupa aprobare urmeaza documentele
 * de fundamentare, contractul si factura. Aplicatia le avea pe ultimele doua
 * si nu avea de unde sa spuna carei cereri ii raspund.
 */

const STATUS_STYLES: Record<ReferatStatus, string> = {
  [ReferatStatus.DRAFT]: 'bg-slate-100 text-slate-600 border-slate-200',
  [ReferatStatus.SUBMITTED]: 'bg-blue-50 text-blue-700 border-blue-200',
  [ReferatStatus.APPROVED]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [ReferatStatus.REJECTED]: 'bg-red-50 text-red-700 border-red-200',
  [ReferatStatus.CLOSED]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

/*
 * Antetul referatului se repeta identic pe fiecare hartie a aceluiasi birou:
 * compartimentul emitent, seful care aproba, persoana de contact. Se retin de
 * la ultimul referat, ca sa nu fie tastate din nou de fiecare data.
 */
const CHEIE_ANTET = 'meditrack_referat_antet';
const antetSalvat = () => {
  try { return JSON.parse(localStorage.getItem(CHEIE_ANTET) || '{}'); } catch { return {}; }
};

const pozitieNoua = (): ReferatItem => ({
  id: crypto.randomUUID(), name: '', unit: 'Buc', quantity: 1, unitPrice: 0, specs: '',
});

const gol = () => {
  const a = antetSalvat();
  return {
    number: '',
    date: new Date().toISOString().split('T')[0],
    autoritate: a.autoritate || '',
    manager: a.manager || '',
    issuedBy: a.issuedBy || '',
    approvedBy: a.approvedBy || '',
    department: '',
    subject: '',
    justification: '',
    budgetArticle: '',
    offerProvider: '',
    offerNumbers: '',
    currency: 'RON',
    status: ReferatStatus.DRAFT,
    contactName: a.contactName || '',
    contactRole: a.contactRole || '',
    contactEmail: a.contactEmail || '',
    contactPhone: a.contactPhone || '',
    filePath: undefined as string | undefined,
    fileUrl: '',
    fileName: '',
  };
};

const fmt = (n: number) => n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Referatul, ca document Word gata de tiparit si semnat.
 *
 * Pana acum aplicatia tinea datele si omul rescria hartia in Word. Acum e
 * invers: se completeaza o data, si actul iese cu tabelul, totalul si
 * semnaturile la locul lor.
 */
const descarcaWord = async (r: Referat) => {
  try {
    const antet = antetSalvat();
    const blob = await referatDocx(r, { autoritate: antet.autoritate, manager: antet.manager });
    await saveFileAs(numeFisier(['Referat', r.number, r.subject]), blob);
  } catch (err: any) {
    notify(`Generarea documentului a esuat${err?.message ? `: ${err.message}` : ''}`, 'error');
  }
};

const descarcaPdf = async (r: Referat) => {
  const source = await resolveSource({ path: r.filePath, url: r.fileUrl });
  if (source.blob || source.dataUrl) {
    await saveFileAs(r.fileName || `${r.number}.pdf`, source.blob || source.dataUrl!);
  }
};

interface Props {
  referate: Referat[];
  devices: MedicalDevice[];
  foundationDocs: FoundationDoc[];
  onUpsert: (r: Referat) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  /** Deschide tab-ul de documente, filtrat pe referatul cerut. */
  onShowDocs: (referatId: string) => void;
}

const ReferatManager: React.FC<Props> = ({
  referate, devices, foundationDocs, onUpsert, onDelete, canDelete, onShowDocs,
}) => {
  const [cauta, setCauta] = useState('');
  const [filtruStatus, setFiltruStatus] = useState<'ALL' | ReferatStatus>('ALL');
  const [editez, setEditez] = useState(false);
  const [idEditat, setIdEditat] = useState<string | null>(null);
  const [form, setForm] = useState(gol());
  const [pozitii, setPozitii] = useState<ReferatItem[]>([pozitieNoua()]);
  const [dispozitive, setDispozitive] = useState<string[]>([]);
  const [aratAntet, setAratAntet] = useState(false);
  const [cautaDispozitiv, setCautaDispozitiv] = useState('');
  const [deSters, setDeSters] = useState<Referat | null>(null);
  const [seSalveaza, setSeSalveaza] = useState(false);
  useEscape(() => setEditez(false), editez);

  const departamente = useMemo(() => getUniqueDepartments(devices), [devices]);
  const dispozitiveDupaId = useMemo(() => new Map(devices.map(d => [d.id, d])), [devices]);

  /** Cate documente sustin fiecare referat — se vede direct pe rand. */
  const documentePeReferat = useMemo(() => {
    const n = new Map<string, number>();
    foundationDocs.forEach(d => { if (d.referatId) n.set(d.referatId, (n.get(d.referatId) || 0) + 1); });
    return n;
  }, [foundationDocs]);

  const filtrate = useMemo(() => {
    const q = cauta.toLowerCase().trim();
    return referate
      .filter(r => filtruStatus === 'ALL' || r.status === filtruStatus)
      .filter(r => !q
        || r.number.toLowerCase().includes(q)
        || r.subject.toLowerCase().includes(q)
        || (r.department || '').toLowerCase().includes(q)
        || (r.justification || '').toLowerCase().includes(q)
        || (r.budgetArticle || '').toLowerCase().includes(q)
        || (r.items || []).some(it => it.name.toLowerCase().includes(q)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [referate, cauta, filtruStatus]);

  const { pageItems, page, pageSize, setPageSize, pageCount, goToPage, topRef } =
    usePagination(filtrate, 'meditrack_referate_page_size');

  const deschideNou = useCallback(() => {
    setForm(gol()); setPozitii([pozitieNoua()]); setDispozitive([]);
    setIdEditat(null); setEditez(true);
  }, []);

  const deschideEditare = useCallback((r: Referat) => {
    setForm({
      autoritate: antetSalvat().autoritate || '',
      manager: antetSalvat().manager || '',
      number: r.number, date: r.date,
      issuedBy: r.issuedBy || '', approvedBy: r.approvedBy || '',
      department: r.department, subject: r.subject,
      justification: r.justification || '',
      budgetArticle: r.budgetArticle || '',
      offerProvider: r.offerProvider || '', offerNumbers: r.offerNumbers || '',
      currency: r.currency, status: r.status,
      contactName: r.contactName || '', contactRole: r.contactRole || '',
      contactEmail: r.contactEmail || '', contactPhone: r.contactPhone || '',
      filePath: r.filePath, fileUrl: r.fileUrl || '', fileName: r.fileName || '',
    });
    // Referatele salvate inainte de tabel aveau o singura valoare; se deschid
    // cu ea pusa pe o pozitie, ca sa nu se piarda.
    setPozitii(r.items?.length ? r.items : [{
      ...pozitieNoua(), name: r.subject || '', unitPrice: r.estimatedValue || 0,
    }]);
    setDispozitive(r.deviceIds || []);
    setIdEditat(r.id);
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
    // Documentul urcat merge in Storage, ca la facturi: tinut inline ar trece
    // prin fiecare sincronizare odata cu randul.
    let filePath = form.filePath;
    let inline: string | undefined = form.fileUrl || undefined;
    if (inline?.startsWith('data:')) {
      const urcat = await uploadDataUrl(buildPath('referate', id, id, form.fileName || 'referat.pdf'), inline);
      if (urcat.path) { filePath = urcat.path; inline = undefined; }
    }
    try {
      localStorage.setItem(CHEIE_ANTET, JSON.stringify({
        autoritate: form.autoritate, manager: form.manager,
        issuedBy: form.issuedBy, approvedBy: form.approvedBy,
        contactName: form.contactName, contactRole: form.contactRole,
        contactEmail: form.contactEmail, contactPhone: form.contactPhone,
      }));
    } catch { /* antetul e o comoditate, nu o obligatie */ }

    onUpsert({
      id,
      number: form.number.trim(),
      date: form.date,
      issuedBy: form.issuedBy.trim(),
      approvedBy: form.approvedBy.trim() || undefined,
      department: form.department.trim(),
      subject: form.subject.trim(),
      items: pozitii.filter(p => p.name.trim()),
      justification: form.justification || undefined,
      budgetArticle: form.budgetArticle.trim() || undefined,
      offerProvider: form.offerProvider.trim() || undefined,
      offerNumbers: form.offerNumbers.trim() || undefined,
      currency: form.currency,
      status: form.status,
      deviceIds: dispozitive,
      contactName: form.contactName.trim() || undefined,
      contactRole: form.contactRole.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      filePath,
      fileUrl: inline,
      fileName: form.fileName || undefined,
    });
    setSeSalveaza(false);
    setEditez(false);
  }, [idEditat, form, pozitii, dispozitive, onUpsert]);

  const dispozitiveFiltrate = useMemo(() => {
    const q = cautaDispozitiv.toLowerCase();
    if (!q) return devices.slice(0, 30);
    return devices.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.serialNumber.toLowerCase().includes(q) ||
      (d.department || '').toLowerCase().includes(q)).slice(0, 30);
  }, [devices, cautaDispozitiv]);

  return (
    <div className="space-y-4" ref={topRef}>
      {/* ── cautare, filtre, adaugare ── */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={cauta}
              onChange={e => setCauta(e.target.value)}
              placeholder="Cauta dupa numar, obiect sau sectie..."
              aria-label="Cauta in referate"
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-xl text-[15px] font-semibold outline-none"
            />
          </div>
          <button
            onClick={deschideNou}
            className="px-6 py-3.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition active:scale-95 flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" /> Referat nou
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', ...Object.values(ReferatStatus)] as const).map(s => (
            <button
              key={s}
              onClick={() => setFiltruStatus(s as 'ALL' | ReferatStatus)}
              className={`px-4 py-2.5 rounded-xl text-[11px] font-bold transition ${
                filtruStatus === s ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s === 'ALL' ? 'Toate' : REFERAT_STATUS_RO[s as ReferatStatus]}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <SablonPanel fel="referat" titlu="Referat de necesitate" />
            <PageSizePicker value={pageSize} onChange={setPageSize} />
          </div>
        </div>
      </div>

      {/* ── lista ── */}
      {filtrate.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[2.5rem] border-4 border-dashed border-slate-50 flex flex-col items-center">
          <FileSignature className="w-16 h-16 text-slate-100 mb-4" />
          <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">
            {referate.length === 0 ? 'Niciun referat inregistrat' : 'Niciun referat gasit'}
          </p>
          {referate.length === 0 && (
            <button onClick={deschideNou} className="mt-6 px-8 py-3.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest">
              + Adauga primul referat
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {pageItems.map(r => {
            const nrDocs = documentePeReferat.get(r.id) || 0;
            return (
              <div key={r.id} className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="p-3 rounded-2xl shrink-0 bg-blue-50 text-blue-600">
                    <FileSignature className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-slate-900">{r.number}</p>
                      <span className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${STATUS_STYLES[r.status]}`}>
                        {REFERAT_STATUS_RO[r.status]}
                      </span>
                      {nrDocs > 0 && (
                        <button
                          onClick={() => onShowDocs(r.id)}
                          className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[11px] font-bold flex items-center gap-1 hover:bg-indigo-100 transition"
                          title="Vezi documentele de fundamentare ale acestui referat"
                        >
                          <Paperclip className="w-3 h-3" />{nrDocs} document{nrDocs === 1 ? '' : 'e'}
                        </button>
                      )}
                    </div>
                    <p className="text-[15px] font-bold text-slate-800 mt-1 break-words">{r.subject}</p>
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      {[r.issuedBy, r.department, r.date].filter(Boolean).join(' · ')}
                      {r.budgetArticle ? ` · art. ${r.budgetArticle}` : ''}
                    </p>
                    {r.items?.length > 1 && (
                      <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                        {r.items.length} pozitii
                      </p>
                    )}
                    {r.deviceIds?.length > 0 && (
                      <p className="text-[11px] font-bold text-slate-500 mt-0.5 truncate">
                        {r.deviceIds.slice(0, 3).map(id => dispozitiveDupaId.get(id)?.name || id).join(', ')}
                        {r.deviceIds.length > 3 ? ` +${r.deviceIds.length - 3}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-black text-slate-900">
                      {fmt(r.items?.length ? referatTotal(r.items) : (r.estimatedValue || 0))}{' '}
                      <span className="text-xs text-slate-500">{r.currency}</span>
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">estimat, fara TVA</p>
                  </div>
                  <button onClick={() => descarcaWord(r)}
                    className="p-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition"
                    title="Genereaza referatul in Word"
                    aria-label={`Genereaza referatul ${r.number} in Word`}>
                    <FileDown className="w-4 h-4" />
                  </button>
                  {(r.filePath || r.fileUrl) && (
                    <button onClick={() => descarcaPdf(r)} className="p-3 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-xl transition" title="Descarca documentul scanat" aria-label={`Descarca scanul referatului ${r.number}`}>
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => deschideEditare(r)} className="p-3 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-xl transition" title="Editeaza" aria-label={`Editeaza referatul ${r.number}`}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  {canDelete && (
                    <button onClick={() => setDeSters(r)} className="p-3 bg-slate-50 text-slate-500 hover:text-red-600 rounded-xl transition" title="Sterge" aria-label={`Sterge referatul ${r.number}`}>
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

      {/* ── formular ── */}
      {editez && (
        <Portal>
          {/*
            Invelisul are fundal propriu si deruleaza pe dinauntru. Fara
            bg-white se vedea pagina prin formular — titlul, tab-urile,
            butoanele — iar cu derularea pusa pe scrim antetul si subsolul
            "sticky" nu aveau fata de ce sa se lipeasca, si pluteau prin
            mijlocul paginii.
          */}
          <div className="fixed inset-0 z-[600] scrim flex items-center justify-center p-0 sm:p-6">
            <form onSubmit={salveaza}
              className="bg-white w-full max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] overflow-hidden flex flex-col rounded-none sm:rounded-[2.5rem] shadow-2xl animate-slide-up">
              <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-slate-100 bg-white shrink-0">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    {idEditat ? 'Editeaza referatul' : 'Referat de necesitate'}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                    Cererea care deschide achizitia
                  </p>
                </div>
                <button type="button" onClick={() => setEditez(false)} aria-label="Inchide" className="p-3 bg-slate-50 text-slate-500 hover:text-slate-900 rounded-xl transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar p-6 sm:p-8 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Camp eticheta="Numar referat" obligatoriu>
                    <input required value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))}
                      placeholder="ex. REF-142/2026" className="camp" />
                  </Camp>
                  <Camp eticheta="Data" obligatoriu>
                    <input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="camp" />
                  </Camp>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Camp eticheta="Emis de (compartiment)" obligatoriu>
                    <input required value={form.issuedBy} onChange={e => setForm(p => ({ ...p, issuedBy: e.target.value }))}
                      placeholder="ex. Birou Tehnic" className="camp" />
                  </Camp>
                  <Camp eticheta="Aprobat de (sef compartiment)">
                    <input value={form.approvedBy} onChange={e => setForm(p => ({ ...p, approvedBy: e.target.value }))}
                      placeholder="ex. Ing. Isopescu Liliana" className="camp" />
                  </Camp>
                </div>

                <DepartmentPicker
                  value={form.department}
                  onChange={v => setForm(p => ({ ...p, department: v }))}
                  options={departamente}
                  label="Sectia beneficiara"
                  required
                />

                <Camp eticheta="Obiectul achizitiei" obligatoriu>
                  <input required value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                    placeholder="ex. Reparatie aparatura medicala diversa" className="camp" />
                </Camp>

                {/*
                  Tabelul de pozitii. Referatul real are un rand pe fiecare
                  aparat, cu seria in denumire si cu pretul lui; totalul se
                  aduna singur, ca sa nu fie calculat pe hartie si apoi tastat.
                */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      Pozitii{pozitii.length > 1 && <span className="text-blue-600"> · {pozitii.length}</span>}
                    </label>
                    <button type="button" onClick={() => setPozitii(p => [...p, pozitieNoua()])}
                      className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition flex items-center gap-2">
                      <Plus className="w-3.5 h-3.5" /> Adauga pozitie
                    </button>
                  </div>

                  <div className="space-y-3">
                    {pozitii.map((it, i) => (
                      <div key={it.id} className="p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="mt-3.5 text-[11px] font-black text-slate-500 tabular-nums shrink-0 w-5">{i + 1}.</span>
                          <input
                            value={it.name}
                            onChange={e => setPozitii(p => p.map(x => x.id === it.id ? { ...x, name: e.target.value } : x))}
                            placeholder="Denumire produs / serviciu, cu seria aparatului"
                            aria-label={`Denumire pozitia ${i + 1}`}
                            className="camp bg-white flex-1 min-w-0" />
                          {pozitii.length > 1 && (
                            <button type="button" onClick={() => setPozitii(p => p.filter(x => x.id !== it.id))}
                              aria-label={`Sterge pozitia ${i + 1}`}
                              className="mt-1 p-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition shrink-0">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pl-0 sm:pl-8">
                          <MicCamp eticheta="U.M.">
                            <input value={it.unit}
                              onChange={e => setPozitii(p => p.map(x => x.id === it.id ? { ...x, unit: e.target.value } : x))}
                              aria-label={`Unitate de masura pozitia ${i + 1}`} className="camp bg-white" />
                          </MicCamp>
                          <MicCamp eticheta="Cant.">
                            <input type="number" min="0" step="1" value={it.quantity || ''}
                              onChange={e => setPozitii(p => p.map(x => x.id === it.id ? { ...x, quantity: parseFloat(e.target.value) || 0 } : x))}
                              aria-label={`Cantitate pozitia ${i + 1}`} className="camp bg-white" />
                          </MicCamp>
                          <MicCamp eticheta="Pret unitar">
                            <input type="number" min="0" step="0.01" value={it.unitPrice || ''}
                              onChange={e => setPozitii(p => p.map(x => x.id === it.id ? { ...x, unitPrice: parseFloat(e.target.value) || 0 } : x))}
                              aria-label={`Pret unitar pozitia ${i + 1}`} className="camp bg-white" />
                          </MicCamp>
                          <MicCamp eticheta="Valoare">
                            <div className="px-4 py-3 bg-slate-100 rounded-2xl text-[15px] font-black text-slate-900 tabular-nums truncate">
                              {fmt((it.quantity || 0) * (it.unitPrice || 0))}
                            </div>
                          </MicCamp>
                        </div>
                        <div className="pl-0 sm:pl-8">
                          <input value={it.specs || ''}
                            onChange={e => setPozitii(p => p.map(x => x.id === it.id ? { ...x, specs: e.target.value } : x))}
                            placeholder="Caracteristici tehnice (optional)"
                            aria-label={`Caracteristici tehnice pozitia ${i + 1}`}
                            className="camp bg-white" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white rounded-2xl">
                    <span className="text-[11px] font-black uppercase tracking-widest">Total estimat, fara TVA</span>
                    <span className="text-xl font-black tabular-nums">
                      {fmt(referatTotal(pozitii))} <span className="text-xs text-white/60">{form.currency}</span>
                    </span>
                  </div>
                </div>

                <Camp eticheta="Justificare">
                  <textarea value={form.justification} onChange={e => setForm(p => ({ ...p, justification: e.target.value }))}
                    placeholder="De ce e necesar: starea aparatului, riscul, consecinta lipsei..."
                    className="camp min-h-[90px] resize-none" />
                </Camp>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Camp eticheta="Articol bugetar">
                    <input value={form.budgetArticle} onChange={e => setForm(p => ({ ...p, budgetArticle: e.target.value }))}
                      placeholder="ex. 66100 UPU" className="camp" />
                  </Camp>
                  <Camp eticheta="Stare">
                    <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as ReferatStatus }))}
                      aria-label="Starea referatului" className="camp">
                      {Object.values(ReferatStatus).map(s => (
                        <option key={s} value={s}>{REFERAT_STATUS_RO[s]}</option>
                      ))}
                    </select>
                  </Camp>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Camp eticheta="Oferta de la firma">
                    <input value={form.offerProvider} onChange={e => setForm(p => ({ ...p, offerProvider: e.target.value }))}
                      placeholder="ex. Vamos" className="camp" />
                  </Camp>
                  <Camp eticheta="Numerele ofertelor">
                    <input value={form.offerNumbers} onChange={e => setForm(p => ({ ...p, offerNumbers: e.target.value }))}
                      placeholder="ex. 16694/17.07.2026; 17872/31.07.2026" className="camp" />
                  </Camp>
                </div>

                {/* documentul scanat */}
                <div className="p-5 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-blue-600 rounded-xl shrink-0"><Paperclip className="w-5 h-5" /></div>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-widest">Referatul scanat</p>
                      <p className="text-[11px] text-white/50 font-bold mt-0.5 truncate">
                        {form.fileName || 'Ataseaza PDF-ul semnat'}
                      </p>
                    </div>
                  </div>
                  <label className="px-5 py-3 bg-white text-slate-900 rounded-xl text-[11px] font-bold hover:bg-blue-50 transition flex items-center gap-2 shrink-0 cursor-pointer">
                    <Upload className="w-4 h-4" /> Incarca
                    <input type="file" accept="application/pdf,image/*" onChange={ataseaza} className="hidden" />
                  </label>
                </div>

                {/* dispozitivele vizate */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Dispozitive vizate {dispozitive.length > 0 && <span className="text-blue-600">· {dispozitive.length} selectate</span>}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input value={cautaDispozitiv} onChange={e => setCautaDispozitiv(e.target.value)}
                      placeholder="Cauta dupa nume, serie sau sectie..."
                      aria-label="Cauta dispozitive" className="camp" style={{ paddingLeft: '2.75rem' }} />
                  </div>
                  <div className="max-h-52 overflow-y-auto custom-scrollbar border-2 border-slate-100 rounded-2xl divide-y divide-slate-50">
                    {dispozitiveFiltrate.map(d => {
                      const ales = dispozitive.includes(d.id);
                      return (
                        <button key={d.id} type="button"
                          onClick={() => setDispozitive(p => ales ? p.filter(x => x !== d.id) : [...p, d.id])}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${ales ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                          <CheckCircle className={`w-4 h-4 shrink-0 ${ales ? 'text-blue-600' : 'text-slate-200'}`} />
                          <span className="flex-1 min-w-0 truncate text-[13px] font-bold text-slate-800">{d.name}</span>
                          <span className="text-[11px] font-mono font-bold text-slate-500 shrink-0">{d.serialNumber}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Se completeaza o data si se retine: acelasi birou, aceeasi
                    persoana de contact pe fiecare referat. */}
                <div className="border-2 border-slate-100 rounded-2xl overflow-hidden">
                  <button type="button" onClick={() => setAratAntet(v => !v)}
                    aria-expanded={aratAntet}
                    className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                      Antet si persoana de contact {form.contactName ? `· ${form.contactName}` : ''}
                    </span>
                    <span className="text-[11px] font-black text-slate-500">{aratAntet ? '−' : '+'}</span>
                  </button>
                  {aratAntet && (
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Camp eticheta="Autoritatea contractanta">
                        <input value={form.autoritate} onChange={e => setForm(p => ({ ...p, autoritate: e.target.value }))}
                          placeholder="ex. Spitalul Clinic Judetean de Urgenta Brasov" className="camp" />
                      </Camp>
                      <Camp eticheta="Manager">
                        <input value={form.manager} onChange={e => setForm(p => ({ ...p, manager: e.target.value }))}
                          placeholder="ex. Prof. Univ. Dr. ..." className="camp" />
                      </Camp>
                      <Camp eticheta="Nume si prenume">
                        <input value={form.contactName} onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))} className="camp" />
                      </Camp>
                      <Camp eticheta="Functia">
                        <input value={form.contactRole} onChange={e => setForm(p => ({ ...p, contactRole: e.target.value }))} placeholder="ex. inginer" className="camp" />
                      </Camp>
                      <Camp eticheta="Email">
                        <input type="email" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} className="camp" />
                      </Camp>
                      <Camp eticheta="Telefon">
                        <input value={form.contactPhone} onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} className="camp" />
                      </Camp>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 sm:px-8 py-4 sm:py-5 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 bg-white shrink-0">
                <button type="button" onClick={() => setEditez(false)}
                  className="w-full sm:w-auto px-8 py-4 text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition">Anuleaza</button>
                <button type="submit" disabled={seSalveaza}
                  className="w-full sm:w-auto px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 whitespace-nowrap">
                  {seSalveaza && <Loader2 className="w-4 h-4 animate-spin" />}
                  {idEditat ? 'Salveaza modificarile' : 'Inregistreaza referatul'}
                </button>
              </div>
            </form>
          </div>
        </Portal>
      )}

      <ConfirmDialog
        open={!!deSters}
        title="Stergi referatul?"
        icon={<Trash2 className="w-8 h-8 sm:w-10 sm:h-10" />}
        body={<>
          Referatul <span className="font-black text-slate-900">{deSters?.number}</span> se sterge definitiv.
          Documentele de fundamentare raman, dar isi pierd legatura cu el.
        </>}
        confirmLabel="Sterge referatul"
        onCancel={() => setDeSters(null)}
        onConfirm={() => { if (deSters) onDelete(deSters.id); setDeSters(null); }}
      />

      <style>{`.camp{width:100%;padding:0.85rem 1.1rem;background:#f8fafc;border:2px solid #e2e8f0;border-radius:1rem;font-size:0.9rem;font-weight:600;outline:none}.camp:focus{border-color:#3b82f6}`}</style>
    </div>
  );
};

const MicCamp = ({ eticheta, children }: { eticheta: string; children: React.ReactNode }) => (
  <div className="space-y-1 min-w-0">
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide ml-1">{eticheta}</label>
    {children}
  </div>
);

const Camp = ({ eticheta, obligatoriu, children }: { eticheta: string; obligatoriu?: boolean; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1">
      {eticheta}{obligatoriu && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

export default React.memo(ReferatManager);
