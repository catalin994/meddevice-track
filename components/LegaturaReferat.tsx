import React, { useMemo, useState } from 'react';
import { Search, X, Link2, Unlink, Check, FileSignature, FolderOpen, Receipt } from 'lucide-react';
import Portal from './Portal';
import useEscape from './useEscape';
import { Referat, FoundationDoc, MedicalDevice, Invoice, FOUNDATION_DOC_RO, normaliseFoundationType } from '../types';

/**
 * Legatura dintre un document de fundamentare si referatul pe care il sustine.
 *
 * Legatura exista de mult in date — un camp pe document — si se putea pune
 * dintr-un singur loc: o lista derulanta in capul formularului de editare. Asta
 * inseamna ca un document care scria "Fara referat" in lista era o fundatura:
 * ca sa-l legi, trebuia deschis la editare, cautat referatul printre toate,
 * salvat. Iar din partea cealalta, de pe referat, nu se putea deloc — se vedea
 * doar cate documente il sustin.
 *
 * Aici se leaga din amandoua partile, cu cautare: de pe document se alege
 * referatul, de pe referat se bifeaza documentele. E acelasi camp, scris in
 * doua feluri, fiindca munca vine si intr-un fel, si in celalalt: uneori scrii
 * documentul si stii referatul, alteori aduni la urma documentele unui dosar.
 */

const cauta = (text: string, q: string) => text.toLowerCase().includes(q);

/* ── de pe document: care referat ── */

interface AlegeReferatProps {
  referate: Referat[];
  /** Referatul legat acum, ca sa se vada bifat. */
  valoare?: string;
  /** Ce document se leaga — numai pentru titlu. */
  numeDocument?: string;
  onAlege: (referatId: string) => void;
  onInchide: () => void;
}

export const AlegeReferat: React.FC<AlegeReferatProps> = ({
  referate, valoare, numeDocument, onAlege, onInchide,
}) => {
  const [q, setQ] = useState('');
  useEscape(onInchide);

  const gasite = useMemo(() => {
    const s = q.toLowerCase().trim();
    const lista = [...referate].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (!s) return lista;
    return lista.filter(r =>
      cauta(r.number || '', s) || cauta(r.subject || '', s)
      || cauta(r.department || '', s) || cauta(r.issuedBy || '', s));
  }, [referate, q]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[620] scrim flex items-end sm:items-center justify-center p-0 sm:p-4"
        onMouseDown={e => { if (e.target === e.currentTarget) onInchide(); }}>
        <div role="dialog" aria-modal="true" aria-label="Alege referatul"
          className="hardware-card w-full sm:max-w-2xl max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-slide-up">
          <div className="shrink-0 p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Leaga de un referat</h3>
              <p className="text-[12px] font-semibold text-slate-500 mt-0.5 truncate">
                {numeDocument || 'Documentul de fundamentare'}
              </p>
            </div>
            <button onClick={onInchide} aria-label="Inchide"
              className="p-2.5 bg-slate-50 text-slate-500 hover:text-slate-900 rounded-xl transition shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="shrink-0 p-5 sm:p-6 pb-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={q} onChange={e => setQ(e.target.value)} autoFocus
                placeholder="Cauta dupa numar, obiect sau sectie..."
                aria-label="Cauta referatul"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 pr-4 text-sm font-bold outline-none focus:border-blue-500 transition"
                style={{ paddingLeft: '2.75rem' }} />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 sm:px-6 pb-5 sm:pb-6 space-y-2">
            {/* Dezlegarea sta in capul listei: e tot un raspuns, nu o lipsa de raspuns. */}
            <button onClick={() => onAlege('')}
              className={`w-full text-left p-4 rounded-2xl border-2 transition flex items-center gap-3 ${
 !valoare ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}>
              <Unlink className="w-4 h-4 shrink-0" />
              <span className="text-[13px] font-bold">Fara referat</span>
              {!valoare && <Check className="w-4 h-4 ml-auto shrink-0" />}
            </button>

            {gasite.length === 0 ? (
              <p className="text-[13px] font-semibold text-slate-500 p-4">
                {referate.length === 0 ? 'Nu e niciun referat in evidenta.' : 'Niciun referat nu se potriveste.'}
              </p>
            ) : gasite.map(r => {
              const ales = r.id === valoare;
              return (
                <button key={r.id} onClick={() => onAlege(r.id)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition ${
 ales ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}>
                  <div className="flex items-center gap-2">
                    <FileSignature className="w-4 h-4 shrink-0" />
                    <span className="text-[13px] font-black">{r.number || 'fara numar'}</span>
                    <span className={`text-[11px] font-bold ${ales ? 'text-white/70' : 'text-slate-500'}`}>
                      {r.date}
                    </span>
                    {ales && <Check className="w-4 h-4 ml-auto shrink-0" />}
                  </div>
                  <p className={`text-[13px] font-bold mt-1 break-words ${ales ? 'text-white' : 'text-slate-800'}`}>
                    {r.subject || '—'}
                  </p>
                  {(r.department || r.issuedBy) && (
                    <p className={`text-[11px] font-semibold mt-0.5 truncate ${ales ? 'text-white/70' : 'text-slate-500'}`}>
                      {[r.issuedBy, r.department].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Portal>
  );
};

/* ── de pe referat: care documente ── */

interface AlegeDocumenteProps {
  docs: FoundationDoc[];
  referat: Referat;
  /** Leaga sau dezleaga un document de referatul asta. */
  onSchimba: (doc: FoundationDoc, legat: boolean) => void;
  onInchide: () => void;
}

export const AlegeDocumente: React.FC<AlegeDocumenteProps> = ({ docs, referat, onSchimba, onInchide }) => {
  const [q, setQ] = useState('');
  useEscape(onInchide);

  /*
   * Intai cele legate de referatul asta, apoi cele nelegate de niciunul, apoi
   * restul. Cine deschide fereastra vrea sa vada ce e deja pus si ce mai e de
   * pus; documentele altui dosar sunt ultimele care il intereseaza, dar raman
   * la vedere, fiindca uneori tocmai acolo e cel pus gresit.
   */
  const gasite = useMemo(() => {
    const s = q.toLowerCase().trim();
    const rang = (d: FoundationDoc) =>
      d.referatId === referat.id ? 0 : !d.referatId ? 1 : 2;
    return [...docs]
      .filter(d => !s || cauta(d.number || '', s) || cauta(d.subject || '', s)
        || cauta(d.compartment || '', s) || cauta(d.element || '', s))
      .sort((a, b) => rang(a) - rang(b) || (b.date || '').localeCompare(a.date || ''));
  }, [docs, referat.id, q]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[620] scrim flex items-end sm:items-center justify-center p-0 sm:p-4"
        onMouseDown={e => { if (e.target === e.currentTarget) onInchide(); }}>
        <div role="dialog" aria-modal="true" aria-label="Alege documentele"
          className="hardware-card w-full sm:max-w-2xl max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-slide-up">
          <div className="shrink-0 p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Documentele care sustin referatul</h3>
              <p className="text-[12px] font-semibold text-slate-500 mt-0.5 truncate">
                {referat.number} · {referat.subject}
              </p>
            </div>
            <button onClick={onInchide} aria-label="Inchide"
              className="p-2.5 bg-slate-50 text-slate-500 hover:text-slate-900 rounded-xl transition shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="shrink-0 p-5 sm:p-6 pb-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={q} onChange={e => setQ(e.target.value)} autoFocus
                placeholder="Cauta dupa numar, obiect sau compartiment..."
                aria-label="Cauta documentul"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 pr-4 text-sm font-bold outline-none focus:border-blue-500 transition"
                style={{ paddingLeft: '2.75rem' }} />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 sm:px-6 pb-5 sm:pb-6 space-y-2">
            {gasite.length === 0 ? (
              <p className="text-[13px] font-semibold text-slate-500 p-4">
                {docs.length === 0 ? 'Nu e niciun document de fundamentare in evidenta.' : 'Niciun document nu se potriveste.'}
              </p>
            ) : gasite.map(d => {
              const alAcestuia = d.referatId === referat.id;
              const alAltuia = !!d.referatId && !alAcestuia;
              return (
                <button key={d.id} onClick={() => onSchimba(d, !alAcestuia)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition ${
 alAcestuia ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <FolderOpen className="w-4 h-4 shrink-0" />
                    <span className="text-[13px] font-black">{d.number || 'fara numar'}</span>
                    <span className={`text-[11px] font-bold ${alAcestuia ? 'text-white/70' : 'text-slate-500'}`}>
                      {FOUNDATION_DOC_RO[normaliseFoundationType(d.type)]} · {d.date}
                    </span>
                    {/* Un document al altui referat se poate muta, dar se spune
                        limpede de unde — altfel s-ar rupe un dosar fara sa se vada. */}
                    {alAltuia && (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center gap-1">
                        <Link2 className="w-3 h-3" /> la alt referat
                      </span>
                    )}
                    {alAcestuia && <Check className="w-4 h-4 ml-auto shrink-0" />}
                  </div>
                  <p className={`text-[13px] font-bold mt-1 break-words ${alAcestuia ? 'text-white' : 'text-slate-800'}`}>
                    {d.subject || d.element || '—'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Portal>
  );
};

/* ── de pe aparat: care hartii il privesc ── */

interface AlegeHartiileProps {
  device: MedicalDevice;
  referate: Referat[];
  docs: FoundationDoc[];
  facturi?: Invoice[];
  /** Pune sau scoate aparatul din lista celor numite de referat. */
  onSchimbaReferat: (r: Referat, legat: boolean) => void;
  /** La fel, pentru un document legat de-a dreptul de aparat. */
  onSchimbaDocument: (d: FoundationDoc, legat: boolean) => void;
  /** Si pentru o factura: aceeasi legatura, la capatul celalalt al drumului. */
  onSchimbaFactura?: (f: Invoice, legat: boolean) => void;
  onInchide: () => void;
}

/**
 * Hartiile unui aparat, alese de pe el.
 *
 * Legatura se punea numai dinspre hartie: pe referat se bifau aparatele, iar
 * documentul nici atat — el nu stia nimic despre aparate. Dinspre aparat nu se
 * putea deloc, desi tocmai asa vine intrebarea de cele mai multe ori: uite
 * aparatul, unde e hartia lui?
 *
 * Documentele care sustin un referat al aparatului nu se bifeaza aici: ele
 * ajung in dosar prin referat, si bifate inca o data ar fi doua legaturi pentru
 * acelasi lucru. Se vad insa, ca sa se stie ca sunt deja acolo.
 */
export const AlegeHartiile: React.FC<AlegeHartiileProps> = ({
  device, referate, docs, facturi = [], onSchimbaReferat, onSchimbaDocument, onSchimbaFactura, onInchide,
}) => {
  const [q, setQ] = useState('');
  const [fila, setFila] = useState<'referate' | 'documente' | 'facturi'>('referate');
  useEscape(onInchide);

  const alLui = (r: Referat) => (r.deviceIds || []).includes(device.id);
  const idsAleLui = useMemo(
    () => new Set(referate.filter(alLui).map(r => r.id)),
    [referate, device.id]);

  const referateGasite = useMemo(() => {
    const s = q.toLowerCase().trim();
    return [...referate]
      .filter(r => !s || cauta(r.number || '', s) || cauta(r.subject || '', s) || cauta(r.department || '', s))
      .sort((a, b) => (alLui(b) ? 1 : 0) - (alLui(a) ? 1 : 0) || (b.date || '').localeCompare(a.date || ''));
  }, [referate, q, device.id]);

  const documenteGasite = useMemo(() => {
    const s = q.toLowerCase().trim();
    const rang = (d: FoundationDoc) =>
      (d.deviceIds || []).includes(device.id) ? 0
      : d.referatId && idsAleLui.has(d.referatId) ? 1 : 2;
    return [...docs]
      .filter(d => !s || cauta(d.number || '', s) || cauta(d.subject || '', s) || cauta(d.compartment || '', s))
      .sort((a, b) => rang(a) - rang(b) || (b.date || '').localeCompare(a.date || ''));
  }, [docs, q, device.id, idsAleLui]);

  const facturiGasite = useMemo(() => {
    const s = q.toLowerCase().trim();
    const alLui = (f: Invoice) => (f.deviceIds || []).includes(device.id);
    return [...facturi]
      .filter(f => !s || cauta(f.invoiceNumber || '', s) || cauta(f.supplier || '', s)
        || cauta(f.description || '', s))
      .sort((a, b) => (alLui(b) ? 1 : 0) - (alLui(a) ? 1 : 0)
        || (b.issueDate || '').localeCompare(a.issueDate || ''));
  }, [facturi, q, device.id]);

  const filaBtn = (care: 'referate' | 'documente' | 'facturi', text: string, n: number) => (
    <button onClick={() => setFila(care)}
      className={`flex-1 px-4 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-wide transition ${
 fila === care ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
      }`}>
      {text}{n > 0 ? ` · ${n}` : ''}
    </button>
  );

  return (
    <Portal>
      <div className="fixed inset-0 z-[620] scrim flex items-end sm:items-center justify-center p-0 sm:p-4"
        onMouseDown={e => { if (e.target === e.currentTarget) onInchide(); }}>
        <div role="dialog" aria-modal="true" aria-label="Alege hartiile aparatului"
          className="hardware-card w-full sm:max-w-2xl max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-slide-up">
          <div className="shrink-0 p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Hartiile aparatului</h3>
              <p className="text-[12px] font-semibold text-slate-500 mt-0.5 truncate">{device.name}</p>
            </div>
            <button onClick={onInchide} aria-label="Inchide"
              className="p-2.5 bg-slate-50 text-slate-500 hover:text-slate-900 rounded-xl transition shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="shrink-0 p-5 sm:p-6 pb-3 space-y-3">
            <div className="flex gap-2">
              {filaBtn('referate', 'Referate', idsAleLui.size)}
              {filaBtn('documente', 'Documente', docs.filter(d => (d.deviceIds || []).includes(device.id)).length)}
              {onSchimbaFactura && filaBtn('facturi', 'Facturi',
                facturi.filter(f => (f.deviceIds || []).includes(device.id)).length)}
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={q} onChange={e => setQ(e.target.value)} autoFocus
                placeholder="Cauta dupa numar sau obiect..."
                aria-label="Cauta"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 pr-4 text-sm font-bold outline-none focus:border-blue-500 transition"
                style={{ paddingLeft: '2.75rem' }} />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 sm:px-6 pb-5 sm:pb-6 space-y-2">
            {fila === 'facturi' ? (
              facturiGasite.length === 0 ? (
                <p className="text-[13px] font-semibold text-slate-500 p-4">
                  {facturi.length === 0 ? 'Nu e nicio factura in evidenta.' : 'Nicio factura nu se potriveste.'}
                </p>
              ) : facturiGasite.map(f => {
                const ales = (f.deviceIds || []).includes(device.id);
                const peCate = (f.deviceIds || []).length;
                return (
                  <button key={f.id} onClick={() => onSchimbaFactura?.(f, !ales)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition ${
 ales ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Receipt className="w-4 h-4 shrink-0" />
                      <span className="text-[13px] font-black">{f.invoiceNumber || 'fara numar'}</span>
                      <span className={`text-[11px] font-bold ${ales ? 'text-white/70' : 'text-slate-500'}`}>
                        {f.issueDate}
                      </span>
                      {/* Cate aparate imparte factura: suma ei se imparte intre
                          ele, deci se vede de la inceput pe cati se intinde. */}
                      {peCate > 1 && (
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide ${
 ales ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          pe {peCate} aparate
                        </span>
                      )}
                      {ales && <Check className="w-4 h-4 ml-auto shrink-0" />}
                    </div>
                    <p className={`text-[13px] font-bold mt-1 break-words ${ales ? 'text-white' : 'text-slate-800'}`}>
                      {f.supplier || '—'}
                      <span className={`ml-2 font-black ${ales ? 'text-white' : 'text-slate-900'}`}>
                        {(f.amount || 0).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} {f.currency || 'RON'}
                      </span>
                    </p>
                  </button>
                );
              })
            ) : fila === 'referate' ? (
              referateGasite.length === 0 ? (
                <p className="text-[13px] font-semibold text-slate-500 p-4">
                  {referate.length === 0 ? 'Nu e niciun referat in evidenta.' : 'Niciun referat nu se potriveste.'}
                </p>
              ) : referateGasite.map(r => {
                const ales = alLui(r);
                return (
                  <button key={r.id} onClick={() => onSchimbaReferat(r, !ales)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition ${
 ales ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileSignature className="w-4 h-4 shrink-0" />
                      <span className="text-[13px] font-black">{r.number || 'fara numar'}</span>
                      <span className={`text-[11px] font-bold ${ales ? 'text-white/70' : 'text-slate-500'}`}>{r.date}</span>
                      {ales && <Check className="w-4 h-4 ml-auto shrink-0" />}
                    </div>
                    <p className={`text-[13px] font-bold mt-1 break-words ${ales ? 'text-white' : 'text-slate-800'}`}>
                      {r.subject || '—'}
                    </p>
                  </button>
                );
              })
            ) : (
              documenteGasite.length === 0 ? (
                <p className="text-[13px] font-semibold text-slate-500 p-4">
                  {docs.length === 0 ? 'Nu e niciun document in evidenta.' : 'Niciun document nu se potriveste.'}
                </p>
              ) : documenteGasite.map(d => {
                const deADreptul = (d.deviceIds || []).includes(device.id);
                const prinReferat = !deADreptul && !!d.referatId && idsAleLui.has(d.referatId);
                return (
                  <button key={d.id} onClick={() => { if (!prinReferat) onSchimbaDocument(d, !deADreptul); }}
                    disabled={prinReferat}
                    title={prinReferat ? 'E deja in dosar, prin referatul lui' : undefined}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition ${
 deADreptul ? 'bg-indigo-600 border-indigo-600 text-white'
 : prinReferat ? 'bg-emerald-50 border-emerald-200 cursor-default'
 : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <FolderOpen className="w-4 h-4 shrink-0" />
                      <span className="text-[13px] font-black">{d.number || 'fara numar'}</span>
                      <span className={`text-[11px] font-bold ${deADreptul ? 'text-white/70' : 'text-slate-500'}`}>
                        {FOUNDATION_DOC_RO[normaliseFoundationType(d.type)]} · {d.date}
                      </span>
                      {/* Cele venite prin referat sunt deja in dosar: se vad, dar
                          nu se mai bifeaza, ca sa nu fie doua legaturi pentru
                          acelasi lucru. */}
                      {prinReferat && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> prin referat
                        </span>
                      )}
                      {deADreptul && <Check className="w-4 h-4 ml-auto shrink-0" />}
                    </div>
                    <p className={`text-[13px] font-bold mt-1 break-words ${deADreptul ? 'text-white' : 'text-slate-800'}`}>
                      {d.subject || d.element || '—'}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};
