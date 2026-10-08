import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  X, Upload, Loader2, Trash2, FileText, Film, Eye, ExternalLink,
  FileSignature, FolderOpen, Receipt, Edit, Building, Calendar, MessageSquare, Clock,
  Paperclip, Wrench, Cpu,
} from 'lucide-react';
import {
  MedicalTask, TaskAttachment, MedicalDevice, Referat, FoundationDoc, Invoice,
  FOUNDATION_DOC_RO, normaliseFoundationType, referatTotal,
  TASK_STATUS_RO, TASK_PRIORITY_RO,
} from '../types';
import { getPriorityText, getStatusStyles, getStatusIcon } from './stilTichet';
import Portal from './Portal';
import useEscape from './useEscape';
import useTragere from './useTragere';
import ConfirmDialog from './ConfirmDialog';
import { buildPath, uploadDataUrl, resolveSource } from '../services/fileStorage';
import { dosarulAparatului } from '../services/dosarAparat';
import { FELURI, FelHartie, etichetaHartiei } from '../services/hartiiTichet';

/**
 * Fisa unui tichet de service: tot ce stie aplicatia despre o defectiune.
 *
 * Tichetul se putea citi numai din lista, pe cat incapea pe un rand — titlul,
 * doua randuri de descriere taiate, cateva insigne. Ca sa-l deschizi trebuia
 * apasat creionul, adica intrat in formularul de editare, de unde se iese cu
 * grija sa nu schimbi ceva. "Intra pe tichet" n-avea unde sa duca.
 *
 * Acum tichetul se deschide apasand pe el, ca aparatul din Inventar, si are o
 * fisa a lui: ce s-a stricat, la ce aparat, cine a cerut, ce stare are acum, si
 * hartiile adunate pe el.
 *
 * Tichetul tinea pana acum numai ce s-a fotografiat la fata locului, pus
 * odata cu raportarea incidentului si niciodata dupa. Dar o defectiune nu se
 * termina cu poza: vine oferta de pret a firmei, vine referatul de necesitate
 * scris pe baza ei, vine documentul de fundamentare care angajeaza banii. Toate
 * stateau prin mailuri si prin dosare, iar cine deschidea tichetul peste o luna
 * ca sa vada unde s-a ajuns nu gasea nimic.
 *
 * Aici se pun, fiecare cu felul ei scris pe ea, si tot aici se vede ce are deja
 * aparatul in evidenta — referatele si documentele din Financiar, facturile lui
 * — ca sa nu fie urcate a doua oara ce exista deja intr-un loc al lor.
 */

const MAX_MB = 50;

const citesteFisierul = (f: File): Promise<string> => new Promise((rez, nu) => {
  const r = new FileReader();
  r.onload = () => rez(String(r.result));
  r.onerror = () => nu(new Error('citire'));
  r.readAsDataURL(f);
});

/** Deschide o hartie, din stocare sau din copia ei din rand. */
export const deschideHartia = async (sursa: { path?: string; url?: string }) => {
  const s = await resolveSource(sursa);
  if (s.blob) { window.open(URL.createObjectURL(s.blob), '_blank'); return; }
  if (!s.dataUrl) return;
  try {
    const [meta, b64] = s.dataUrl.split(',');
    const mime = meta.match(/data:(.*?);/)?.[1] || 'application/octet-stream';
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    window.open(URL.createObjectURL(new Blob([bytes], { type: mime })), '_blank');
  } catch {
    window.open(s.dataUrl, '_blank');
  }
};

const fmt = (n: number) => n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  task: MedicalTask;
  /** Trece tichetul in starea urmatoare, din fisa. */
  onStatus?: () => void;
  onEditeaza?: () => void;
  onSterge?: () => void;
  device?: MedicalDevice;
  referate?: Referat[];
  foundationDocs?: FoundationDoc[];
  invoices?: Invoice[];
  onSchimba: (atasamente: TaskAttachment[]) => void;
  onInchide: () => void;
  /** Deschide fisa aparatului, cand tichetul e legat de unul. */
  onVeziAparatul?: () => void;
}

const FisaTichet: React.FC<Props> = ({
  task, device, referate = [], foundationDocs = [], invoices = [],
  onSchimba, onInchide, onVeziAparatul, onStatus, onEditeaza, onSterge,
}) => {
  const [fel, setFel] = useState<FelHartie>('oferta');
  const [urc, setUrc] = useState(false);
  const [greseala, setGreseala] = useState('');
  const [deSters, setDeSters] = useState<TaskAttachment | null>(null);
  const alege = useRef<HTMLInputElement>(null);
  useEscape(onInchide, !deSters);

  const atasamente = task.attachments || [];

  /* Ce are deja aparatul in evidenta: referate, fundamentari, facturi. */
  const dosar = useMemo(
    () => (device ? dosarulAparatului(device.id, referate, foundationDocs, invoices) : null),
    [device, referate, foundationDocs, invoices]);

  const primeste = useCallback(async (fisiere: FileList | null) => {
    if (!fisiere || fisiere.length === 0) return;
    setGreseala('');
    setUrc(true);
    const puse: TaskAttachment[] = [];
    const greseli: string[] = [];

    for (const f of Array.from(fisiere)) {
      try {
        if (f.size / (1024 * 1024) > MAX_MB) { greseli.push(`${f.name}: peste ${MAX_MB}MB`); continue; }
        const url = await citesteFisierul(f);
        const id = crypto.randomUUID();
        /*
         * Acelasi loc in stocare ca pozele de la raportare: sunt acelasi sir de
         * atasamente ale tichetului, doar ca aduse mai tarziu.
         */
        const { path, error } = await uploadDataUrl(buildPath('incidents', task.id, id, f.name), url);
        if (error) greseli.push(`${f.name}: a ramas doar pe dispozitiv (${error})`);
        puse.push({
          id,
          name: f.name,
          kind: f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : 'file',
          category: fel,
          ...(path ? { path } : { url }),
          size: f.size,
          dateAdded: new Date().toISOString().split('T')[0],
        });
      } catch {
        greseli.push(`${f.name}: eroare la citire`);
      }
    }

    setUrc(false);
    if (greseli.length) setGreseala(greseli.join(' · '));
    if (puse.length) onSchimba([...atasamente, ...puse]);
    if (alege.current) alege.current.value = '';
  }, [atasamente, fel, onSchimba, task.id]);

  /* Fisierul lasat cu mouse-ul peste caseta, nu numai ales din foldere. */
  const tragere = useTragere(useCallback((fisiere: File[]) => {
    const lista = new DataTransfer();
    for (const f of fisiere) lista.items.add(f);
    void primeste(lista.files);
  }, [primeste]));

  const scoate = useCallback((a: TaskAttachment) => {
    onSchimba(atasamente.filter(x => x.id !== a.id));
    setDeSters(null);
  }, [atasamente, onSchimba]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[620] scrim flex items-end sm:items-center justify-center p-0 sm:p-4"
        onMouseDown={e => { if (e.target === e.currentTarget) onInchide(); }}>
        <div role="dialog" aria-modal="true" aria-label="Fisa tichetului"
          className="hardware-card w-full sm:max-w-3xl max-h-[88vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-slide-up">

          <div className="shrink-0 p-5 sm:p-6 border-b border-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wide">Tichet de service</p>
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-snug break-words mt-0.5">
                  {task.title}
                </h3>
              </div>
              <button onClick={onInchide} aria-label="Inchide"
                className="p-2.5 bg-slate-50 text-slate-500 hover:text-slate-900 rounded-xl transition shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${getPriorityText(task.priority)}`}>
                {TASK_PRIORITY_RO[task.priority]}
              </span>
              {/* Starea se schimba de aici: altfel ar trebui inchisa fisa pentru ea. */}
              <button onClick={onStatus} disabled={!onStatus}
                title={onStatus ? 'Apasa ca sa treci tichetul mai departe' : undefined}
                className={`px-3 py-1.5 rounded-lg font-black text-[11px] uppercase tracking-wide border transition flex items-center gap-1.5 ${getStatusStyles(task.status)}`}>
                {getStatusIcon(task.status)}
                {TASK_STATUS_RO[task.status]}
              </button>
              <span className="text-[12px] font-semibold text-slate-600 flex items-center gap-1.5">
                <Building className="w-3 h-3 text-slate-400" /> {task.department}
              </span>
              <span className="text-[12px] font-semibold text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-slate-400" /> Deschis {task.createdAt}
              </span>
              {task.dueDate && (
                <span className={`text-[12px] font-bold flex items-center gap-1.5 ${
                  task.dueDate < new Date().toISOString().split('T')[0] && task.status !== 'Completed'
                    ? 'text-red-600' : 'text-slate-500'
                }`}>
                  <Clock className="w-3 h-3" /> Scadent {task.dueDate}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-6">
            {/*
              Problema si aparatul, umar la umar, pe jumatati egale.
              Descrierea tinea toata latimea ferestrei, iar aparatul era o
              insigna in capul ei: ochiul citea un paragraf lat de trei randuri
              si abia dupa aceea afla la ce aparat. Sunt doua fete ale aceluiasi
              lucru — ce s-a stricat si la ce — si acum cantaresc la fel.
            */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:items-start">
              <Sectiune icon={<Wrench className="w-4 h-4" />} titlu="Problema">
                <div className="space-y-3">
                  {task.description ? (
                    <p className="text-[13px] font-medium text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                      {task.description}
                    </p>
                  ) : (
                    <p className="text-[13px] font-semibold text-slate-400">
                      Nu s-a scris nimic la deschiderea tichetului.
                    </p>
                  )}
                  {task.notes && (
                    <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl">
                      <p className="text-[10px] font-black text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3" /> Note tehnice
                      </p>
                      <p className="text-[13px] font-medium text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                        {task.notes}
                      </p>
                    </div>
                  )}
                </div>
              </Sectiune>

              <Sectiune icon={<Cpu className="w-4 h-4" />} titlu="Aparatul">
                {device ? (
                  <div className="space-y-3">
                    <p className="text-[14px] font-black text-slate-900 leading-snug break-words">{device.name}</p>
                    <dl className="space-y-1.5">
                      {[
                        ['Serie', device.serialNumber],
                        ['Inventar', device.inventoryNumber],
                        ['Producator', device.manufacturer],
                        ['Model', device.model],
                        ['Sectia', device.department],
                      ].filter(([, v]) => !!v).map(([k, v]) => (
                        <div key={k as string} className="flex items-baseline gap-2">
                          <dt className="text-[10px] font-black text-slate-400 uppercase tracking-wide w-[86px] pr-2 shrink-0">{k}</dt>
                          <dd className="text-[12px] font-bold text-slate-700 break-words min-w-0">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <button onClick={onVeziAparatul} disabled={!onVeziAparatul}
                      className="w-full mt-1 px-3 py-2.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-[12px] font-bold hover:bg-blue-100 transition disabled:opacity-60 flex items-center justify-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" /> Deschide fisa aparatului
                    </button>
                  </div>
                ) : (
                  <p className="text-[13px] font-semibold text-slate-400">
                    Tichetul nu e legat de un aparat anume.
                  </p>
                )}
              </Sectiune>
            </div>

            {/* ── 2. hartiile tichetului ── */}
            <Sectiune icon={<Paperclip className="w-4 h-4" />} titlu="Documentele tichetului"
              numar={atasamente.length}>
              {/*
                Doi pasi numerotati, nu o insiruire de butoane. Inainte, felul
                hartiei si alegerea fisierului stateau unul langa altul, la fel
                de apasat scrise, si nu se vedea ca primul il schimba pe al
                doilea: se alegea fisierul si abia dupa aceea se baga de seama ca
                s-a pus ca oferta, cand era referat.
              */}
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-black text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center shrink-0">1</span>
                    Ce fel de document pui?
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {FELURI.map(f => (
                      <button key={f.id} type="button" onClick={() => setFel(f.id)} aria-pressed={fel === f.id}
                        className={`px-3 py-2 rounded-xl border-2 text-[12px] font-bold transition ${
                          fel === f.id ? 'bg-slate-900 border-slate-900 text-white'
                                       : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}>
                        {f.text}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-black text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center shrink-0">2</span>
                    Alege fisierul
                  </p>
                  <button
                    type="button"
                    {...tragere.proprietati}
                    onClick={() => alege.current?.click()}
                    disabled={urc}
                    aria-label="Alege sau trage fisierul aici"
                    className={`w-full p-6 rounded-2xl border-2 border-dashed transition flex flex-col items-center justify-center gap-2 text-center ${
                      tragere.peDeasupra ? 'border-blue-500 bg-blue-50'
                                         : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40'
                    } disabled:opacity-60`}>
                    {urc
                      ? <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
                      : <Upload className="w-7 h-7 text-slate-400" />}
                    <span className="text-[13px] font-black text-slate-800">
                      {urc ? 'Se incarca...'
                           : tragere.peDeasupra ? 'Lasa fisierul aici'
                           : 'Trage fisierul aici sau apasa ca sa-l cauti'}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Se pune ca <strong className="text-slate-700">{FELURI.find(f => f.id === fel)!.text}</strong> · cel mult {MAX_MB}MB
                    </span>
                  </button>
                  <input ref={alege} type="file" multiple className="hidden"
                    onChange={e => { void primeste(e.target.files); }} />
                  {greseala && (
                    <p className="text-[11px] font-bold text-red-600 break-words mt-2">{greseala}</p>
                  )}
                </div>

                <div className="pt-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">
                    Puse pe tichet ({atasamente.length})
                  </p>
                  {atasamente.length === 0 ? (
                    <p className="text-[13px] font-semibold text-slate-400 py-3">
                      Nicio hartie pusa inca.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {atasamente.map(a => (
                        <div key={a.id} className="flex items-center gap-3 p-3 bg-white border-2 border-slate-100 rounded-xl">
                          <span className="p-2.5 bg-slate-50 rounded-xl text-slate-500 shrink-0">
                            {a.kind === 'video' ? <Film className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-[4px] bg-slate-100 border border-slate-200 text-[10px] font-black uppercase tracking-wide text-slate-600">
                                {etichetaHartiei(a)}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-400">{a.dateAdded}</span>
                            </span>
                            <span className="block text-[13px] font-bold text-slate-800 truncate mt-0.5" title={a.name}>{a.name}</span>
                          </span>
                          <button onClick={() => deschideHartia(a)} title="Deschide" aria-label={`Deschide ${a.name}`}
                            className="p-2.5 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-xl transition shrink-0">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeSters(a)} title="Scoate de pe tichet" aria-label={`Scoate ${a.name}`}
                            className="p-2.5 bg-slate-50 text-slate-500 hover:text-red-600 rounded-xl transition shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Sectiune>

            {/* ── ce are deja aparatul, din Financiar ── */}
            {device && dosar && (
              <Sectiune icon={<FolderOpen className="w-4 h-4" />} titlu="Dosarul aparatului"
                sub="Ce are deja aparatul in Financiar">
                {dosar.referate.length === 0 && dosar.fundamentari.length === 0 && dosar.facturi.length === 0 ? (
                  <p className="text-[13px] font-semibold text-slate-500 p-4 bg-slate-50 rounded-2xl">
                    Aparatul n-are inca referate sau documente de fundamentare in evidenta.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dosar.referate.map(r => (
                      <RandDosar key={r.id} icon={<FileSignature className="w-4 h-4" />}
                        fel="Referat" numar={r.number} data={r.date} ce={r.subject}
                        suma={`${fmt(referatTotal(r.items))} ${r.currency}`}
                        sursa={{ path: r.filePath, url: r.fileUrl }} />
                    ))}
                    {dosar.fundamentari.map(d => (
                      <RandDosar key={d.id} icon={<FolderOpen className="w-4 h-4" />}
                        fel={FOUNDATION_DOC_RO[normaliseFoundationType(d.type)]}
                        numar={d.number} data={d.date} ce={d.subject}
                        suma={d.amount ? `${fmt(d.amount)} ${d.currency || 'RON'}` : ''}
                        sursa={{ path: d.filePath, url: d.fileUrl }} />
                    ))}
                    {dosar.facturi.map(f => (
                      <RandDosar key={f.id} icon={<Receipt className="w-4 h-4" />}
                        fel="Factura" numar={f.invoiceNumber} data={f.issueDate} ce={f.supplier}
                        suma={`${fmt(f.amount || 0)} ${f.currency || 'RON'}`}
                        sursa={{ path: f.filePath, url: f.fileUrl }} />
                    ))}
                  </div>
                )}
              </Sectiune>
            )}
          </div>

          <div className="shrink-0 px-5 sm:px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {onEditeaza && (
                <button onClick={onEditeaza}
                  className="px-4 py-3 bg-slate-50 border-2 border-slate-200 text-slate-700 rounded-xl text-[12px] font-bold hover:border-slate-300 transition flex items-center gap-2">
                  <Edit className="w-4 h-4" /> Editeaza
                </button>
              )}
              {onSterge && (
                <button onClick={onSterge}
                  className="px-4 py-3 bg-slate-50 border-2 border-slate-200 text-slate-500 rounded-xl text-[12px] font-bold hover:border-red-200 hover:text-red-600 transition flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Sterge
                </button>
              )}
            </div>
            <button onClick={onInchide}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[12px] font-black uppercase tracking-wide hover:bg-slate-800 transition">
              Gata
            </button>
          </div>
        </div>
      </div>

      {deSters && (
        <ConfirmDialog
          open
          title="Scoti documentul de pe tichet?"
          body={<>Hartia <strong>{deSters.name}</strong> nu se mai vede pe tichet.</>}
          confirmLabel="Scoate"
          onConfirm={() => scoate(deSters)}
          onCancel={() => setDeSters(null)}
        />
      )}
    </Portal>
  );
};

/**
 * O sectiune a fisei: un titlu scris apasat si ce tine de el, intr-un chenar.
 *
 * Fara ele, fisa era un sir de bucati despartite numai prin aer, cu titluri
 * mici si cenusii — se vedea ca scrie ceva, nu se vedea unde se termina un
 * lucru si incepe altul.
 */
const Sectiune: React.FC<{
  icon: React.ReactNode; titlu: string; sub?: string; numar?: number; children: React.ReactNode;
}> = ({ icon, titlu, sub, numar, children }) => (
  <section className="border-2 border-slate-100 rounded-2xl overflow-hidden">
    <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2.5">
      <span className="text-slate-500 shrink-0">{icon}</span>
      <h4 className="text-[12px] font-black text-slate-800 uppercase tracking-wide">{titlu}</h4>
      {typeof numar === 'number' && (
        <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-[11px] font-black text-slate-600">
          {numar}
        </span>
      )}
      {sub && <span className="text-[11px] font-semibold text-slate-400 truncate ml-auto hidden sm:block">{sub}</span>}
    </div>
    <div className="p-4 sm:p-5">{children}</div>
  </section>
);

/** Un rand din dosarul aparatului, asa cum arata in fereastra tichetului. */
const RandDosar: React.FC<{
  icon: React.ReactNode; fel: string; numar?: string; data?: string; ce?: string; suma?: string;
  sursa: { path?: string; url?: string };
}> = ({ icon, fel, numar, data, ce, suma, sursa }) => {
  const are = !!(sursa.path || sursa.url);
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
      <span className="p-2.5 bg-white rounded-xl text-slate-500 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{fel}</span>
          <span className="text-[12px] font-black text-slate-900">{numar || 'fara numar'}</span>
          <span className="text-[10px] font-mono font-bold text-slate-400">{data}</span>
        </span>
        {ce && <span className="block text-[12px] font-bold text-slate-700 truncate mt-0.5" title={ce}>{ce}</span>}
      </span>
      {suma && <span className="text-[12px] font-black text-slate-900 shrink-0 hidden sm:block">{suma}</span>}
      <button onClick={() => deschideHartia(sursa)} disabled={!are}
        title={are ? 'Deschide documentul scanat' : 'Nu are document scanat'}
        aria-label={`Deschide ${fel} ${numar || ''}`}
        className="p-2.5 bg-white text-slate-500 hover:text-blue-600 rounded-xl transition shrink-0 disabled:opacity-30">
        <Eye className="w-4 h-4" />
      </button>
    </div>
  );
};

export default FisaTichet;
