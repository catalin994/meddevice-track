import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  X, Upload, Loader2, Trash2, FileText, Film, Eye, ExternalLink,
  FileSignature, FolderOpen, Receipt, Paperclip,
} from 'lucide-react';
import {
  MedicalTask, TaskAttachment, MedicalDevice, Referat, FoundationDoc, Invoice,
  FOUNDATION_DOC_RO, normaliseFoundationType, referatTotal,
} from '../types';
import Portal from './Portal';
import useEscape from './useEscape';
import ConfirmDialog from './ConfirmDialog';
import { buildPath, uploadDataUrl, resolveSource } from '../services/fileStorage';
import { dosarulAparatului } from '../services/dosarAparat';

/**
 * Hartiile unui tichet de service.
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

export type FelHartie = 'oferta' | 'referat' | 'fundamentare' | 'altul';

export const FELURI: { id: FelHartie; text: string; scurt: string }[] = [
  { id: 'oferta', text: 'Oferta de pret', scurt: 'Oferta' },
  { id: 'referat', text: 'Referat de necesitate', scurt: 'Referat' },
  { id: 'fundamentare', text: 'Document de fundamentare', scurt: 'Fundamentare' },
  { id: 'altul', text: 'Alt document', scurt: 'Document' },
];

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
  device?: MedicalDevice;
  referate?: Referat[];
  foundationDocs?: FoundationDoc[];
  invoices?: Invoice[];
  onSchimba: (atasamente: TaskAttachment[]) => void;
  onInchide: () => void;
  /** Deschide fisa aparatului, cand tichetul e legat de unul. */
  onVeziAparatul?: () => void;
}

const DocumenteTichet: React.FC<Props> = ({
  task, device, referate = [], foundationDocs = [], invoices = [],
  onSchimba, onInchide, onVeziAparatul,
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

  const scoate = useCallback((a: TaskAttachment) => {
    onSchimba(atasamente.filter(x => x.id !== a.id));
    setDeSters(null);
  }, [atasamente, onSchimba]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[620] scrim flex items-end sm:items-center justify-center p-0 sm:p-4"
        onMouseDown={e => { if (e.target === e.currentTarget) onInchide(); }}>
        <div role="dialog" aria-modal="true" aria-label="Documentele tichetului"
          className="hardware-card w-full sm:max-w-3xl max-h-[88vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-slide-up">

          <div className="shrink-0 p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Documentele tichetului</h3>
              <p className="text-[12px] font-semibold text-slate-500 mt-0.5 truncate">{task.title}</p>
              {device && (
                <button onClick={onVeziAparatul} disabled={!onVeziAparatul}
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition disabled:opacity-60">
                  <ExternalLink className="w-3 h-3" />
                  {device.name}
                  {device.serialNumber ? ` · ${device.serialNumber}` : ''}
                </button>
              )}
            </div>
            <button onClick={onInchide} aria-label="Inchide"
              className="p-2.5 bg-slate-50 text-slate-500 hover:text-slate-900 rounded-xl transition shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-6">
            {/* ── de pus ── */}
            <div className="p-4 sm:p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl space-y-3">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide">Adauga un document</p>
              <div className="flex flex-wrap gap-1.5">
                {FELURI.map(f => (
                  <button key={f.id} type="button" onClick={() => setFel(f.id)} aria-pressed={fel === f.id}
                    className={`px-3 py-1.5 rounded-xl border-2 text-[12px] font-bold transition ${
                      fel === f.id ? 'bg-slate-900 border-slate-900 text-white'
                                   : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}>
                    {f.text}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => alege.current?.click()} disabled={urc}
                  className="px-5 py-3 bg-blue-600 text-white rounded-xl text-[12px] font-black uppercase tracking-wide flex items-center gap-2 hover:bg-blue-700 transition disabled:opacity-50">
                  {urc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {urc ? 'Se incarca' : 'Alege fisierul'}
                </button>
                <p className="text-[11px] font-semibold text-slate-500">
                  Se pune ca {FELURI.find(f => f.id === fel)!.text.toLowerCase()}. Pana la {MAX_MB}MB.
                </p>
                <input ref={alege} type="file" multiple className="hidden"
                  onChange={e => { void primeste(e.target.files); }} />
              </div>
              {greseala && (
                <p className="text-[11px] font-bold text-red-600 break-words">{greseala}</p>
              )}
            </div>

            {/* ── ce e pus ── */}
            <div className="space-y-2">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide px-1">
                Pe tichet ({atasamente.length})
              </p>
              {atasamente.length === 0 ? (
                <p className="text-[13px] font-semibold text-slate-500 p-4 bg-slate-50 rounded-2xl">
                  Nicio hartie pusa inca pe tichet.
                </p>
              ) : atasamente.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 bg-white border-2 border-slate-100 rounded-2xl">
                  <span className="p-2.5 bg-slate-50 rounded-xl text-slate-500 shrink-0">
                    {a.kind === 'video' ? <Film className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-[4px] bg-slate-100 border border-slate-200 text-[10px] font-black uppercase tracking-wide text-slate-600">
                        {FELURI.find(f => f.id === a.category)?.scurt || (a.kind === 'image' ? 'Poza' : 'Document')}
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

            {/* ── ce are deja aparatul, din Financiar ── */}
            {device && dosar && (
              <div className="space-y-2">
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide px-1">
                  Din dosarul aparatului
                </p>
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
              </div>
            )}
          </div>

          <div className="shrink-0 px-5 sm:px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              <Paperclip className="w-3 h-3" /> Se salveaza pe loc, pe tichet.
            </p>
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

export default DocumenteTichet;
