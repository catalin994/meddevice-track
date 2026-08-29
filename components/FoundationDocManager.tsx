import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FolderOpen, Plus, Search, X, Pencil, Trash2, Download, Upload, Loader2,
  Paperclip, Link2, Unlink, FileDown, CalendarClock,
} from 'lucide-react';
import {
  FoundationDoc, FoundationDocType, FOUNDATION_DOC_RO, Referat,
  normaliseFoundationType, lunaRo, lunaAcum, lunaUrmatoare, luniIntre, schimbaLuna,
} from '../types';
import Portal from './Portal';
import useEscape from './useEscape';
import ConfirmDialog from './ConfirmDialog';
import Pager, { usePagination, PageSizePicker } from './Pager';
import SablonPanel from './SablonPanel';
import { saveFileAs } from '../services/fileService';
import { buildPath, uploadDataUrl, resolveSource } from '../services/fileStorage';
import { fundamentareDocx, numeFisier } from '../services/documenteAchizitie';
import { notify } from '../services/notices';

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

/**
 * Ce se repeta identic pe fiecare document al aceluiasi serviciu. Pe cele doua
 * documente reale compartimentul, programul si codul SSI sunt aceleasi cuvant
 * cu cuvant — tastate din nou de fiecare data.
 */
const RETINUTE = {
  compartment: 'meditrack_df_compartiment',
  program: 'meditrack_df_program',
  ssiCode: 'meditrack_df_ssi',
} as const;

const retinut = (cheie: keyof typeof RETINUTE) => {
  try { return localStorage.getItem(RETINUTE[cheie]) || ''; } catch { return ''; }
};

const gol = () => ({
  referatId: '',
  type: FoundationDocType.ACHIZITIE_DIRECTA,
  number: '',
  date: new Date().toISOString().split('T')[0],
  revision: 0,
  revisionDate: new Date().toISOString().split('T')[0],
  compartment: retinut('compartment'),
  subject: '',
  shortDescription: '',
  description: '',
  budgetArticle: '',
  ssiCode: retinut('ssiCode'),
  program: retinut('program'),
  element: '',
  parameters: '',
  previousValue: 0,
  influence: 0,
  remainingAmount: 0,
  currency: 'RON',
  supplier: '',
  referenceNumber: '',
  frameworkContract: '',
  frameworkTotal: 0,
  reference: '',
  recurring: false,
  seriesId: '',
  periodMonth: lunaAcum(),
  notes: '',
  filePath: undefined as string | undefined,
  fileUrl: '',
  fileName: '',
});

/**
 * Fraza care leaga documentul de oferta sau de contract.
 *
 * Se propune, nu se impune: pe DF 17835 scrie "Reparația se poate realiza
 * conform ofertei atasate de firma Deltamed...", iar pe DF 17979 e un paragraf
 * intreg despre acordul-cadru. Nicio formula fixa nu le acopera pe amandoua, si
 * o fraza compusa de aplicatie care nu seamana cu niciuna e mai rea decat una
 * scrisa de om.
 */
const frazaPropusa = (f: { type: FoundationDocType; supplier: string; referenceNumber: string; frameworkContract: string }) => {
  const firma = f.supplier.trim();
  const nr = f.referenceNumber.trim();
  const cadru = f.frameworkContract.trim();
  if (!firma && !nr && !cadru) return '';
  if (f.type === FoundationDocType.CONTRACT_SUBSECVENT || cadru) {
    return `Este necesară alocarea sumei aferente contractului subsecvent`
      + `${nr ? ` cu numărul ${nr}` : ''}${firma ? `, încheiat cu firma ${firma}` : ''}`
      + `${cadru ? `, în conformitate cu prevederile acordului-cadru ${cadru}` : ''}.`;
  }
  return `Achiziţia se poate realiza conform ofertei ataşate`
    + `${firma ? ` de firma ${firma}` : ''}${nr ? `, conform ofertei cu numărul ${nr}` : ''}.`;
};

const fmt = (n: number) => n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Rotunjeste la ban.
 *
 * 19.360,02 + 3.226,67 da 22.586,690000000002 in virgula mobila. Pe hartie nu
 * se vede — se scrie cu doua zecimale — dar valoarea salvata devine punctul de
 * plecare al lunii urmatoare, si eroarea se aduna de douasprezece ori pe an.
 */
const bani = (n: number) => Math.round(n * 100) / 100;

/** O serie lunara: documentele aceluiasi contract, in ordinea lunilor. */
interface Serie {
  seriesId: string;
  documente: FoundationDoc[];
  /** Ultima luna facuta. */
  ultimul: FoundationDoc;
  /** Lunile care ar fi trebuit facute si nu sunt, de la cea mai veche. */
  restante: string[];
}

/**
 * Ce documente lunare mai sunt de facut.
 *
 * Contractele subsecvente cer cate un document pe luna, la nesfarsit, fiecare o
 * revizuire a celui dinainte. Tinut minte de om, se uita — si se uita tocmai
 * lunile in care s-a intamplat altceva. Aici se calculeaza din ce exista deja:
 * ultima luna facuta a fiecarei serii, fata de luna curenta.
 */
const seriiRestante = (docs: FoundationDoc[], pana = lunaAcum()): Serie[] => {
  const dupaSerie = new Map<string, FoundationDoc[]>();
  for (const d of docs) {
    if (!d.recurring) continue;
    const cheie = d.seriesId || d.id;
    (dupaSerie.get(cheie) || dupaSerie.set(cheie, []).get(cheie)!).push(d);
  }
  const serii: Serie[] = [];
  for (const [seriesId, lista] of dupaSerie) {
    const ordonate = [...lista].sort((a, b) =>
      (a.periodMonth || a.date || '').localeCompare(b.periodMonth || b.date || ''));
    const ultimul = ordonate[ordonate.length - 1];
    const facute = new Set(ordonate.map(d => d.periodMonth).filter(Boolean) as string[]);
    const start = ultimul.periodMonth;
    const restante: string[] = [];
    if (start) {
      // Numai lunile de dupa ultima facuta, pana la luna curenta inclusiv. O
      // serie oprita acum trei luni are trei documente de facut, nu unul.
      for (let i = 1; i <= Math.max(0, luniIntre(start, pana)); i++) {
        const luna = lunaUrmatoare(start, i);
        if (!facute.has(luna)) restante.push(luna);
      }
    }
    serii.push({ seriesId, documente: ordonate, ultimul, restante });
  }
  return serii.sort((a, b) => b.restante.length - a.restante.length);
};

/** Documentul de fundamentare, in Word, cu tabelul de valori si semnaturile. */
const descarcaWord = async (d: FoundationDoc, referat?: Referat) => {
  try {
    const blob = await fundamentareDocx(d, referat);
    await saveFileAs(numeFisier(['DF', d.number, d.subject]), blob);
  } catch (err: any) {
    notify(`Generarea documentului a esuat${err?.message ? `: ${err.message}` : ''}`, 'error');
  }
};

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
  /** Cat timp nimeni n-a scris in ea, fraza se recompune singura. */
  const [frazaAtinsa, setFrazaAtinsa] = useState(false);
  /** La fel, data reviziei o urmeaza pe cea a documentului pana e schimbata. */
  const [dataRevizieiAtinsa, setDataRevizieiAtinsa] = useState(false);
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
        || (d.frameworkContract || '').toLowerCase().includes(q)
        || (d.element || '').toLowerCase().includes(q)
        || FOUNDATION_DOC_RO[normaliseFoundationType(d.type)].toLowerCase().includes(q)
        || (referateDupaId.get(d.referatId || '')?.number || '').toLowerCase().includes(q))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [docs, cauta, filtruTip, filtruReferat, referateDupaId]);

  const { pageItems, page, pageSize, setPageSize, pageCount, goToPage, topRef } =
    usePagination(filtrate, 'meditrack_fundamentare_page_size');

  const deschideNou = useCallback(() => {
    setForm({ ...gol(), referatId: filtruReferat || '' });
    setFrazaAtinsa(false); setDataRevizieiAtinsa(false);
    setIdEditat(null); setEditez(true);
  }, [filtruReferat]);

  const deschideEditare = useCallback((d: FoundationDoc) => {
    setForm({
      referatId: d.referatId || '', type: normaliseFoundationType(d.type),
      number: d.number || '', date: d.date,
      revision: d.revision ?? 0, revisionDate: d.revisionDate || d.date,
      compartment: d.compartment || '',
      subject: d.subject || '', shortDescription: d.shortDescription || '',
      description: d.description || '',
      budgetArticle: d.budgetArticle || '', ssiCode: d.ssiCode || '', program: d.program || '',
      element: d.element || '',
      parameters: d.parameters || '',
      previousValue: d.previousValue || 0,
      influence: d.influence ?? ((d.amount || 0) - (d.previousValue || 0)),
      remainingAmount: d.remainingAmount || 0,
      currency: d.currency || 'RON',
      supplier: d.supplier || '', referenceNumber: d.referenceNumber || '',
      frameworkContract: d.frameworkContract || '', frameworkTotal: d.frameworkTotal || 0,
      reference: d.reference || '',
      recurring: !!d.recurring, seriesId: d.seriesId || '', periodMonth: d.periodMonth || lunaAcum(),
      notes: d.notes || '', filePath: d.filePath, fileUrl: d.fileUrl || '', fileName: d.fileName || '',
    });
    // Fraza scrisa deja nu se mai rescrie de la sine cand se schimba firma.
    setFrazaAtinsa(!!d.reference);
    setDataRevizieiAtinsa(!!d.revisionDate && d.revisionDate !== d.date);
    setIdEditat(d.id);
    setEditez(true);
  }, []);

  const serii = useMemo(() => seriiRestante(docs), [docs]);
  const deFacut = useMemo(() => serii.filter(s => s.restante.length > 0), [serii]);
  const restanteTotal = useMemo(() => deFacut.reduce((n, s) => n + s.restante.length, 0), [deFacut]);

  /**
   * Deschide documentul lunii urmatoare, gata completat din cel dinainte.
   *
   * Ce se schimba de la o luna la alta: revizuirea creste cu unu, valoarea de
   * la revizia precedenta devine cat era totalul, influenta ramane rata lunara,
   * si numele lunii se schimba peste tot unde apare. Ce nu se schimba, ramane.
   *
   * Numarul unic ramane gol intentionat: il da registratura, nu aplicatia.
   */
  const faLunaUrmatoare = useCallback((s: Serie, luna: string) => {
    const p = s.ultimul;
    const precedenta = p.amount || 0;
    const influenta = p.influence || 0;
    const lunaVeche = p.periodMonth || '';
    const azi = new Date().toISOString().split('T')[0];
    // Documentul se dateaza in luna pe care o acopera; daca luna a trecut, in
    // prima ei zi, ca sa nu iasa un act din august datat in octombrie.
    const data = luna === lunaAcum() ? azi : `${luna}-01`;
    const schimba = (t?: string) => schimbaLuna(t || '', lunaVeche, luna);

    setForm({
      ...gol(),
      referatId: p.referatId || '',
      type: normaliseFoundationType(p.type),
      number: '',
      date: data,
      revision: (p.revision ?? 0) + 1,
      revisionDate: data,
      compartment: p.compartment || '',
      subject: schimba(p.subject),
      shortDescription: schimba(p.shortDescription),
      description: schimba(p.description),
      budgetArticle: p.budgetArticle || '',
      ssiCode: p.ssiCode || '',
      program: p.program || '',
      element: p.element || '',
      parameters: p.parameters || '',
      previousValue: precedenta,
      influence: influenta,
      remainingAmount: p.remainingAmount || 0,
      currency: p.currency || 'RON',
      supplier: p.supplier || '',
      referenceNumber: p.referenceNumber || '',
      frameworkContract: p.frameworkContract || '',
      frameworkTotal: p.frameworkTotal || 0,
      reference: schimba(p.reference),
      recurring: true,
      seriesId: s.seriesId,
      periodMonth: luna,
      notes: schimba(p.notes),
      filePath: undefined,
      fileUrl: '',
      fileName: '',
    });
    setFrazaAtinsa(true);          // fraza vine din luna trecuta, nu se rescrie
    setDataRevizieiAtinsa(true);
    setIdEditat(null);
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
    try {
      for (const c of Object.keys(RETINUTE) as (keyof typeof RETINUTE)[]) {
        localStorage.setItem(RETINUTE[c], form[c]);
      }
    } catch { /* comoditate */ }

    // Valoarea actualizata nu se tasteaza: e suma celorlalte doua, exact ca in
    // coloana "7 = 5 + 6" din formular.
    const actualizata = bani((form.previousValue || 0) + (form.influence || 0));

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
      shortDescription: form.shortDescription.trim() || undefined,
      description: form.description.trim() || undefined,
      budgetArticle: form.budgetArticle.trim() || undefined,
      ssiCode: form.ssiCode.trim() || undefined,
      program: form.program.trim() || undefined,
      element: form.element.trim() || undefined,
      parameters: form.parameters.trim() || undefined,
      previousValue: form.previousValue || undefined,
      influence: form.influence || undefined,
      amount: actualizata || undefined,
      remainingAmount: form.remainingAmount || undefined,
      currency: actualizata ? form.currency : undefined,
      supplier: form.supplier.trim() || undefined,
      referenceNumber: form.referenceNumber.trim() || undefined,
      frameworkContract: form.frameworkContract.trim() || undefined,
      frameworkTotal: form.frameworkTotal || undefined,
      reference: form.reference.trim() || undefined,
      recurring: form.recurring || undefined,
      // Prima luna a unei serii isi da numele seriei; urmatoarele il mostenesc.
      seriesId: form.recurring ? (form.seriesId || id) : undefined,
      periodMonth: form.recurring ? form.periodMonth : undefined,
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

      {/*
        Documentele lunare care n-au fost facute inca. Contractele subsecvente
        cer cate unul pe luna; tinut minte de om, se uita — si se uita tocmai in
        lunile aglomerate. Aici sunt scrise, cu butonul care le face.
      */}
      {serii.length > 0 && (
        <div className={`p-5 border-2 rounded-[2rem] space-y-3 ${
          deFacut.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <CalendarClock className={`w-5 h-5 shrink-0 ${deFacut.length > 0 ? 'text-amber-700' : 'text-slate-500'}`} />
            <p className={`text-[13px] font-black uppercase tracking-wide ${deFacut.length > 0 ? 'text-amber-900' : 'text-slate-600'}`}>
              {restanteTotal === 0
                ? `${serii.length} contract${serii.length === 1 ? '' : 'e'} lunar${serii.length === 1 ? '' : 'e'} — la zi`
                : `${restanteTotal} document${restanteTotal === 1 ? '' : 'e'} lunar${restanteTotal === 1 ? '' : 'e'} de facut`}
            </p>
          </div>
          {serii.map(s => {
            const plafon = s.ultimul.frameworkTotal || 0;
            const consumat = s.ultimul.amount || 0;
            const rata = s.ultimul.influence || 0;
            const ramas = plafon ? plafon - consumat : 0;
            // Cate luni mai incap la rata de acum. Zero inseamna ca urmatoarea
            // alocare nu mai are din ce sa fie facuta.
            const luniRamase = plafon && rata > 0 ? Math.floor(ramas / rata) : null;
            const procent = plafon ? Math.min(100, Math.round((consumat / plafon) * 100)) : 0;
            const strans = plafon > 0 && luniRamase !== null && luniRamase <= 2;
            return (
              <div key={s.seriesId} className="px-4 py-3 bg-white border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-slate-900 break-words">{s.ultimul.subject || 'Fara obiect'}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                      {[s.ultimul.supplier, s.ultimul.referenceNumber].filter(Boolean).join(' · ')}
                      {' · ultimul: '}{lunaRo(s.ultimul.periodMonth || '')}
                      {s.restante.length > 1 && <span className="text-amber-700"> · {s.restante.length} luni in urma</span>}
                    </p>
                  </div>
                  {s.restante.length > 0 ? (
                    <button
                      onClick={() => faLunaUrmatoare(s, s.restante[0])}
                      className="w-full sm:w-auto px-5 py-3 bg-amber-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-amber-700 transition active:scale-95 shrink-0 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Fa documentul pe {lunaRo(s.restante[0])}
                    </button>
                  ) : (
                    <span className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-black uppercase tracking-widest shrink-0 text-center">
                      La zi
                    </span>
                  )}
                </div>

                {/* Cat s-a consumat din acordul-cadru. */}
                {plafon > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[11px] font-bold">
                      <span className="text-slate-500">
                        Acord-cadru{s.ultimul.frameworkContract ? ` ${s.ultimul.frameworkContract}` : ''}
                      </span>
                      <span className={strans ? 'text-red-700' : 'text-slate-600'}>
                        {fmt(consumat)} din {fmt(plafon)} · raman {fmt(Math.max(0, ramas))}
                        {luniRamase !== null && (
                          <span className={strans ? 'text-red-700' : 'text-slate-500'}>
                            {' '}({luniRamase === 0 ? 'nu mai incape o luna' : `inca ${luniRamase} lun${luniRamase === 1 ? 'a' : 'i'}`})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${
                        procent >= 100 ? 'bg-red-600' : strans ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} style={{ width: `${procent}%` }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
          <div className="ml-auto flex items-center gap-2">
            <SablonPanel fel="fundamentare" titlu="Document de fundamentare" />
            <PageSizePicker value={pageSize} onChange={setPageSize} />
          </div>
        </div>
      </div>

      {filtrate.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[2rem] border-4 border-dashed border-slate-50 flex flex-col items-center">
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
                      {d.recurring && (
                        <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-bold flex items-center gap-1"
                              title={`Document lunar${d.periodMonth ? ` pe ${lunaRo(d.periodMonth)}` : ''}`}>
                          <CalendarClock className="w-3 h-3" />
                          {d.periodMonth ? lunaRo(d.periodMonth) : 'lunar'}
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
                  <button onClick={() => descarcaWord(d, ref)}
                    className="p-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition"
                    title="Genereaza documentul in Word"
                    aria-label="Genereaza documentul de fundamentare in Word">
                    <FileDown className="w-4 h-4" />
                  </button>
                  {(d.filePath || d.fileUrl) && (
                    <button onClick={() => descarcaPdf(d)} className="p-3 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-xl transition" title="Descarca documentul scanat" aria-label="Descarca scanul documentului">
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
          {/*
            Invelisul are fundal propriu si deruleaza pe dinauntru. Fara
            bg-white se vedea pagina prin formular — titlul, tab-urile,
            butoanele — iar cu derularea pusa pe scrim antetul si subsolul
            "sticky" nu aveau fata de ce sa se lipeasca, si pluteau prin
            mijlocul paginii.
          */}
          <div className="fixed inset-0 z-[600] scrim flex items-center justify-center p-0 sm:p-6">
            <form onSubmit={salveaza}
              className="bg-white w-full max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] overflow-hidden flex flex-col rounded-none sm:rounded-3xl shadow-2xl animate-slide-up">
              <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-slate-100 bg-white shrink-0">
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

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar p-6 sm:p-8 space-y-5">
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
                  {/*
                    Data reviziei o urmeaza pe cea a documentului cat timp
                    nimeni n-a schimbat-o: pe amandoua documentele reale sunt
                    aceeasi zi, si o data ramasa in urma trece neobservata.
                  */}
                  <Camp eticheta="Data" obligatoriu>
                    <input required type="date" value={form.date}
                      onChange={e => setForm(p => ({ ...p, date: e.target.value,
                        revisionDate: dataRevizieiAtinsa ? p.revisionDate : e.target.value }))}
                      className="camp" />
                  </Camp>
                  <Camp eticheta="Revizuirea">
                    <input type="number" min="0" step="1" value={form.revision}
                      onChange={e => setForm(p => ({ ...p, revision: parseInt(e.target.value) || 0 }))}
                      aria-label="A cata revizuire" className="camp" />
                  </Camp>
                  <Camp eticheta="Data reviziei">
                    <input type="date" value={form.revisionDate}
                      onChange={e => { setDataRevizieiAtinsa(true); setForm(p => ({ ...p, revisionDate: e.target.value })); }}
                      className="camp" />
                  </Camp>
                </div>

                {/* Titlul de pe prima pagina. */}
                <Camp eticheta="Obiectul documentului (titlul)" obligatoriu>
                  <input required value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                    placeholder="ex. Reparatie defibrilator Corpuls Elicopter 336" className="camp" />
                </Camp>

                {/*
                  Punctul 2 nu e mereu titlul. Pe DF 17979 titlul e "Contract
                  subsecvent Papapostolul", iar punctul 2 spune "Servicii de
                  intretinere preventiva si reparatii aparatura medicala...".
                  Lasat gol, se ia titlul — ca pe DF 17835, unde sunt la fel.
                */}
                <Camp eticheta="2. Descrierea pe scurt / motivul revizuirii">
                  <textarea value={form.shortDescription} onChange={e => setForm(p => ({ ...p, shortDescription: e.target.value }))}
                    placeholder={form.subject ? `Gol, se scrie: ${form.subject}` : 'Gol, se scrie titlul de mai sus'}
                    aria-label="Descrierea pe scurt a obiectului sau motivul revizuirii"
                    className="camp min-h-[70px] resize-none" />
                </Camp>

                <Camp eticheta="3. Descrierea pe larg a starii de fapt si de drept">
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Ce defectiuni are, de ce e necesara interventia, pe ce oferta sau contract se sprijina..."
                    className="camp min-h-[130px] resize-none" />
                </Camp>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Camp eticheta="Firma ofertanta / contractanta">
                    <input value={form.supplier}
                      onChange={e => setForm(p => ({ ...p, supplier: e.target.value,
                        reference: frazaAtinsa ? p.reference : frazaPropusa({ ...p, supplier: e.target.value }) }))}
                      placeholder="ex. Deltamed" className="camp" />
                  </Camp>
                  <Camp eticheta="Nr. oferta / contract">
                    <input value={form.referenceNumber}
                      onChange={e => setForm(p => ({ ...p, referenceNumber: e.target.value,
                        reference: frazaAtinsa ? p.reference : frazaPropusa({ ...p, referenceNumber: e.target.value }) }))}
                      placeholder="ex. 17834/31.07.2026" className="camp" />
                  </Camp>
                  <Camp eticheta="Nr. acord-cadru">
                    <input value={form.frameworkContract}
                      onChange={e => setForm(p => ({ ...p, frameworkContract: e.target.value,
                        reference: frazaAtinsa ? p.reference : frazaPropusa({ ...p, frameworkContract: e.target.value }) }))}
                      placeholder="ex. 3467/09.02.2024" className="camp" />
                  </Camp>
                </div>

                {/*
                  Fraza se propune din campurile de mai sus, dar ramane a lor:
                  pe cele doua documente reale nu seamana una cu alta.
                */}
                <Camp eticheta="Fraza cu oferta / contractul, asa cum apare in document">
                  <textarea value={form.reference}
                    onChange={e => { setFrazaAtinsa(true); setForm(p => ({ ...p, reference: e.target.value })); }}
                    placeholder="Se completeaza singura din firma si numerele de mai sus. Se poate rescrie."
                    aria-label="Fraza cu oferta sau contractul"
                    className="camp min-h-[80px] resize-none" />
                </Camp>

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
                  {/*
                    Coloana 1 nu e tipul documentului. Pe DF 17979 scrie
                    "Contract subsecvent", dar pe DF 17835 scrie obiectul —
                    "Reparație defibrilator Corpuls Elicopter 336". Gol, se ia
                    tipul, fiindca asa e mai des.
                  */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Camp eticheta="Element de fundamentare (coloana 1)">
                      <input value={form.element} onChange={e => setForm(p => ({ ...p, element: e.target.value }))}
                        placeholder={`Gol, se scrie: ${FOUNDATION_DOC_RO[form.type]}`}
                        aria-label="Elementul de fundamentare din coloana 1" className="camp bg-white" />
                    </Camp>
                    <Camp eticheta="Parametrii de fundamentare">
                      <input value={form.parameters} onChange={e => setForm(p => ({ ...p, parameters: e.target.value }))}
                        placeholder="ex. 1x 3.226,67" className="camp bg-white" />
                    </Camp>
                  </div>
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
                        {fmt(bani((form.previousValue || 0) + (form.influence || 0)))}
                      </div>
                    </div>
                  </div>
                  {/* Randul de bifat de sub tabel, completat pe amandoua documentele reale. */}
                  <Camp eticheta="Ramane in suma de ___ lei (randul de sub tabel)">
                    <input type="number" step="0.01" value={form.remainingAmount || ''}
                      onChange={e => setForm(p => ({ ...p, remainingAmount: parseFloat(e.target.value) || 0 }))}
                      placeholder="Gol, randul ramane cu puncte"
                      aria-label="Suma de pe randul ramane in suma de" className="camp bg-white" />
                  </Camp>
                </div>

                {/*
                  Contractele cer cate un document pe luna. Bifat aici, tab-ul
                  stie sa spuna cand a venit luna urmatoare si sa il faca din
                  cel de acum, in loc sa fie tastat de la zero de doisprezece
                  ori pe an.
                */}
                <div className={`p-5 rounded-2xl border-2 transition ${form.recurring ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.recurring}
                      onChange={e => setForm(p => ({ ...p, recurring: e.target.checked }))}
                      className="mt-0.5 w-5 h-5 accent-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-slate-900">Se face lunar, pe contract</p>
                      <p className="text-[11px] font-semibold text-slate-500 mt-0.5 leading-relaxed">
                        Aplicatia va cere documentul lunii urmatoare si il va completa din acesta —
                        revizuirea creste, valoarea precedenta devine totalul de acum, iar numele lunii
                        se schimba peste tot unde apare.
                      </p>
                    </div>
                  </label>
                  {form.recurring && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Camp eticheta="Luna acoperita">
                        <input type="month" value={form.periodMonth}
                          onChange={e => setForm(p => ({ ...p, periodMonth: e.target.value }))}
                          aria-label="Luna pe care o acopera documentul" className="camp bg-white" />
                      </Camp>
                      {/* Plafonul din care trag alocarile lunare. */}
                      <Camp eticheta="Valoarea acordului-cadru">
                        <input type="number" step="0.01" value={form.frameworkTotal || ''}
                          onChange={e => setForm(p => ({ ...p, frameworkTotal: parseFloat(e.target.value) || 0 }))}
                          placeholder="Gol, nu se urmareste epuizarea"
                          aria-label="Valoarea totala a acordului-cadru" className="camp bg-white" />
                      </Camp>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Seria</label>
                        <div className="px-4 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-[13px] font-bold text-slate-600 truncate">
                          {form.seriesId
                            ? `Luna ${docs.filter(d => (d.seriesId || d.id) === form.seriesId).length + (idEditat ? 0 : 1)} a acestui contract`
                            : 'Prima luna a unei serii noi'}
                        </div>
                      </div>
                    </div>
                  )}
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

              <div className="px-6 sm:px-8 py-4 sm:py-5 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 bg-white shrink-0">
                <button type="button" onClick={() => setEditez(false)}
                  className="w-full sm:w-auto px-8 py-4 text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition">Anuleaza</button>
                <button type="submit" disabled={seSalveaza}
                  className="w-full sm:w-auto px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 whitespace-nowrap">
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
    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1">
      {eticheta}{obligatoriu && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

export default React.memo(FoundationDocManager);
