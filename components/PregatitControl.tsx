import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, ChevronDown, Download, FileSpreadsheet,
  FolderArchive, Loader2, UserCheck, CalendarRange, Building2, Save,
} from 'lucide-react';
import { MedicalDevice, MedicalTask, Contract, Referat, FoundationDoc, Invoice, getUniqueDepartments } from '../types';
import { pregatirea, StareaCerintei } from '../services/pregatitControl';
import { registruEvidentaExcel, numeleRegistrului } from '../services/registruEvidenta';
import { planulAnului, planVerificariExcel, numelePlanului, catePlanificate, cereriPeLuni, NUMELE_LUNILOR } from '../services/planVerificari';
import { dosarulDeControlZip, numeleDosarului } from '../services/dosarControl';
import { iaSetareLocal, iaSetareDinCloud, punSetare, PersoanaResponsabila } from '../services/setari';
import { antetInstitutiei } from '../services/antet';
import { scris } from '../services/loctiitori';
import { saveFileAs } from '../services/fileService';
import { notify } from '../services/notices';
import DepartmentPicker from './DepartmentPicker';
import CampData from './CampData';

/**
 * Pregatit pentru control.
 *
 * Inainte de un control, intrebarea nu e "cate aparate avem" — e "ce lipseste,
 * si cat timp am ca sa rezolv". Raspunsul statea imprastiat: buletinele pe
 * fisa fiecarui aparat, mentenanta in alt tab, hartiile intr-al treilea, iar
 * registrul si planul nu existau deloc ca documente. Se afla cu o zi inainte,
 * deschizand aparate unul cate unul — adica nu se afla.
 *
 * Ecranul asta pune verdictul in fata: cate cerinte sunt indeplinite din cate
 * se aplica, si sub fiecare cerinta neindeplinita lista aparatelor care o
 * strica, cu motivul scris. De aici se deschide aparatul si se rezolva.
 *
 * Si scoate dosarul: registrul, planul verificarilor, lista lipsurilor, si —
 * la cerere — fisele aparatelor, toate intr-un ZIP cu un cuprins care spune si
 * ce nu e in el.
 *
 * Verdictul nu e o garantie. Aplicatia stie ce s-a trecut in ea, nu ce exista
 * la dosar in realitate, si ecranul o spune apasat: altfel ar fi doar o cifra
 * verde care linisteste pe cine n-ar trebui linistit.
 */

interface Props {
  devices: MedicalDevice[];
  tasks?: MedicalTask[];
  contracte?: Contract[];
  referate?: Referat[];
  foundationDocs?: FoundationDoc[];
  invoices?: Invoice[];
  onSelectDevice: (id: string) => void;
}

const CHEIE_RESP = 'persoana_responsabila';

const PregatitControl: React.FC<Props> = ({
  devices, tasks = [], contracte = [], referate = [], foundationDocs = [], invoices = [], onSelectDevice,
}) => {
  const [resp, setResp] = useState<PersoanaResponsabila>(() => iaSetareLocal<PersoanaResponsabila>(CHEIE_RESP, {}));
  const [formResp, setFormResp] = useState<PersoanaResponsabila>(resp);
  const [salvezResp, setSalvezResp] = useState(false);
  const [sectie, setSectie] = useState('');
  const [an, setAn] = useState(() => new Date().getFullYear());
  const [deschisa, setDeschisa] = useState<string | null>(null);
  const [cuFise, setCuFise] = useState(false);
  const [doarCuLipsuri, setDoarCuLipsuri] = useState(true);
  const [lucreaza, setLucreaza] = useState<string | null>(null);

  /* Persoana responsabila e aceeasi pentru toata lumea, deci vine din cloud;
     pana raspunde, se arata copia locala, ca ecranul sa nu astepte reteaua. */
  useEffect(() => {
    let viu = true;
    iaSetareDinCloud<PersoanaResponsabila>(CHEIE_RESP).then(v => {
      if (!viu || !v) return;
      setResp(v);
      setFormResp(v);
    });
    return () => { viu = false; };
  }, []);

  const aleSectiei = useMemo(
    () => (sectie ? devices.filter(d => (d.department || '').trim().toLowerCase() === sectie.trim().toLowerCase()) : devices),
    [devices, sectie]);

  const p = useMemo(() => pregatirea(aleSectiei, contracte, resp), [aleSectiei, contracte, resp]);
  const plan = useMemo(() => planulAnului(aleSectiei, an), [aleSectiei, an]);
  const cereri = useMemo(() => cereriPeLuni(plan), [plan]);

  const sectii = useMemo(() => getUniqueDepartments(devices), [devices]);
  const cateAparate = useMemo(() => {
    const n: Record<string, number> = {};
    devices.forEach(d => { const k = (d.department || '').trim(); if (k) n[k] = (n[k] || 0) + 1; });
    return n;
  }, [devices]);

  const salveazaResp = useCallback(async () => {
    setSalvezResp(true);
    try {
      const { inCloud } = await punSetare(CHEIE_RESP, formResp);
      setResp(formResp);
      notify(inCloud ? 'Persoana responsabila a fost salvata.'
        : 'Salvata pe acest dispozitiv — fara semnal, ajunge in cloud la urmatoarea sincronizare.',
        inCloud ? 'success' : 'warning');
    } finally {
      setSalvezResp(false);
    }
  }, [formResp]);

  const scoate = useCallback(async (ce: 'registru' | 'plan' | 'dosar') => {
    setLucreaza(ce === 'dosar' ? 'Pregatesc dosarul...' : 'Scriu documentul...');
    try {
      const antet = antetInstitutiei();
      if (ce === 'registru') {
        const blob = await registruEvidentaExcel(devices, { sectie: sectie || undefined, faraCasate: true },
          { tasks, contracte, autoritate: antet.autoritate });
        await saveFileAs(numeleRegistrului(sectie || undefined), blob);
      } else if (ce === 'plan') {
        await saveFileAs(numelePlanului(an), await planVerificariExcel(plan, antet.autoritate));
      } else {
        const blob = await dosarulDeControlZip(devices, p,
          { sectie: sectie || undefined, an, cuFise, doarFiseleCuLipsuri: doarCuLipsuri },
          { tasks, contracte, referate, fundamentari: foundationDocs, facturi: invoices, antet, responsabil: resp },
          text => setLucreaza(text));
        await saveFileAs(numeleDosarului(sectie || undefined), blob);
      }
    } catch (err: any) {
      notify(`Nu am putut scoate documentul${err?.message ? `: ${err.message}` : ''}`, 'error');
    } finally {
      setLucreaza(null);
    }
  }, [devices, sectie, an, plan, p, cuFise, doarCuLipsuri, tasks, contracte, referate, foundationDocs, invoices, resp]);

  const procent = p.dinCate ? Math.round((p.gata / p.dinCate) * 100) : 100;
  const tonVerdict = procent === 100 ? 'emerald' : procent >= 70 ? 'amber' : 'red';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── verdictul ── */}
      <div className="hardware-card rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex items-center gap-5 min-w-0 flex-1">
            {/*
              Cifra e mare fiindca e singurul lucru care se citeste de la doi
              metri, iar intrebarea "suntem pregatiti" se pune de obicei in
              picioare, peste umarul cuiva.
            */}
            <div className={`shrink-0 w-24 h-24 rounded-3xl flex flex-col items-center justify-center text-white shadow-xl ${
              tonVerdict === 'emerald' ? 'bg-emerald-600 shadow-emerald-600/20'
              : tonVerdict === 'amber' ? 'bg-amber-500 shadow-amber-500/20'
              : 'bg-red-600 shadow-red-600/20'
            }`}>
              <span className="text-3xl font-black leading-none tabular-nums">{procent}%</span>
              <span className="text-[9px] font-black uppercase tracking-wide mt-1 opacity-90">pregatit</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Pregatit pentru control</h2>
              <p className="text-[13px] font-semibold text-slate-500 mt-1">
                {p.gata} din {p.dinCate} cerinte indeplinite · {p.aparateCuLipsuri.length} dispozitive cu lipsuri
                din {p.cateAparate} aflate in utilizare
              </p>
              {/*
                Avertismentul nu e un amanunt de subsol. Un procent verde care
                nu spune ce masoara e mai rau decat nicio cifra.
              */}
              <p className="text-[12px] font-semibold text-amber-700 mt-2 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Se verifica ce s-a trecut in aplicatie, nu ce exista la dosar. O cerinta indeplinita
                inseamna ca aplicatia nu vede nimic lipsa, nu ca actul exista si e valabil.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full lg:w-72 shrink-0">
            <DepartmentPicker
              value={sectie}
              onChange={setSectie}
              options={sectii}
              counts={cateAparate}
              label="Punctul de lucru"
              allowCreate={false}
              placeholder="Cauta sectia..."
            />
            {sectie && (
              <button onClick={() => setSectie('')}
                className="text-[11px] font-black uppercase tracking-wide text-slate-500 hover:text-slate-800 transition self-start ml-1">
                Vezi tot spitalul
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── persoana responsabila ── */}
      <div className="hardware-card rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl"><UserCheck className="w-5 h-5" /></div>
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold tracking-tight text-slate-900">Persoana responsabila</h3>
            <p className="text-[12px] font-semibold text-slate-500">
              Prima hartie ceruta la control. E singura din dosar care nu se poate deduce din evidenta.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="tech-label ml-1" htmlFor="resp-nume">Numele</label>
            <input id="resp-nume" value={formResp.nume || ''} onChange={e => setFormResp(v => ({ ...v, nume: e.target.value }))}
              placeholder="Nume si prenume"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" />
          </div>
          <div className="space-y-1">
            <label className="tech-label ml-1" htmlFor="resp-functie">Functia</label>
            <input id="resp-functie" value={formResp.functie || ''} onChange={e => setFormResp(v => ({ ...v, functie: e.target.value }))}
              placeholder="ex. inginer"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" />
          </div>
          <div className="space-y-1">
            <label className="tech-label ml-1" htmlFor="resp-decizie">Decizia de numire nr.</label>
            <input id="resp-decizie" value={formResp.decizieNumar || ''} onChange={e => setFormResp(v => ({ ...v, decizieNumar: e.target.value }))}
              placeholder="ex. 142"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" />
          </div>
          <div className="space-y-1">
            <label className="tech-label ml-1" htmlFor="resp-data">Din data de</label>
            <CampData id="resp-data" value={formResp.decizieData || ''} eticheta="Data deciziei"
              onChange={v => setFormResp(x => ({ ...x, decizieData: v }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" />
          </div>
        </div>
        <button onClick={salveazaResp} disabled={salvezResp}
          className="mt-4 flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase tracking-wide hover:bg-slate-800 transition active:scale-95 disabled:opacity-50">
          {salvezResp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salveaza
        </button>
      </div>

      {/* ── cerintele ── */}
      <div className="hardware-card rounded-3xl p-6 sm:p-8">
        <h3 className="text-lg font-extrabold tracking-tight text-slate-900 mb-1">Cerintele, una cate una</h3>
        <p className="text-[12px] font-semibold text-slate-500 mb-5">
          Deschide o cerinta neindeplinita ca sa vezi care aparate o strica si de ce.
        </p>
        <div className="space-y-2">
          {p.cerinte.map(c => (
            <Cerinta key={c.cerinta.cheie} stare={c}
              deschisa={deschisa === c.cerinta.cheie}
              onToggle={() => setDeschisa(d => d === c.cerinta.cheie ? null : c.cerinta.cheie)}
              onSelectDevice={onSelectDevice} />
          ))}
        </div>
      </div>

      {/* ── planul anului ── */}
      <div className="hardware-card rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-3 bg-blue-50 text-blue-700 rounded-2xl"><CalendarRange className="w-5 h-5" /></div>
            <div className="min-w-0">
              <h3 className="text-lg font-extrabold tracking-tight text-slate-900">Planul verificarilor periodice</h3>
              <p className="text-[12px] font-semibold text-slate-500">
                {catePlanificate(plan)} verificari in {an}
                {plan.faraTermen.length > 0 && ` · ${plan.faraTermen.length} aparate fara termen stiut`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {[an - 1, an, an + 1].map((a, i) => (
              <button key={a} onClick={() => setAn(a)}
                className={`px-3 py-2 rounded-xl text-[12px] font-black tabular-nums transition ${
                  i === 1 ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>{a}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 mt-5">
          {plan.peLuni.map((randuri, l) => (
            <div key={l} className={`rounded-2xl border p-3 ${
              randuri.length ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100'
            }`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 truncate">{NUMELE_LUNILOR[l]}</span>
                <span className={`text-lg font-black tabular-nums ${randuri.length ? 'text-slate-900' : 'text-slate-300'}`}>
                  {randuri.length || '—'}
                </span>
              </div>
              {randuri.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {randuri.slice(0, 3).map((r, k) => (
                    <li key={k}>
                      <button onClick={() => onSelectDevice(r.device.id)}
                        className="w-full text-left text-[11px] font-bold text-slate-600 hover:text-blue-700 truncate transition">
                        {r.device.name}
                      </button>
                    </li>
                  ))}
                  {randuri.length > 3 && (
                    <li className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      si inca {randuri.length - 3}
                    </li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/*
          Cealalta citire a aceluiasi plan, si cea care foloseste: nu "in
          martie expira patru", ci "in septembrie am de depus patru cereri".
        */}
        {cereri.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-wide mb-3">Cand se depun cererile</h4>
            <div className="flex flex-wrap gap-2">
              {cereri.map(c => {
                const trecuta = `${c.an}-${String(c.luna + 1).padStart(2, '0')}` < new Date().toISOString().slice(0, 7);
                return (
                  <span key={`${c.an}-${c.luna}`}
                    className={`px-3 py-2 rounded-xl border text-[12px] font-bold ${
                      trecuta ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                    {NUMELE_LUNILOR[c.luna]} {c.an} · {c.cate} {c.cate === 1 ? 'cerere' : 'cereri'}
                    {trecuta && ' · intarziate'}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── dosarul ── */}
      <div className="hardware-card rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-slate-900 text-white rounded-2xl"><FolderArchive className="w-5 h-5" /></div>
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold tracking-tight text-slate-900">Dosarul de control</h3>
            <p className="text-[12px] font-semibold text-slate-500">
              Registrul, planul si lista lipsurilor, intr-un singur fisier, cu un cuprins care spune si ce nu e in el.
            </p>
          </div>
        </div>

        <label className="flex items-start gap-3 px-4 py-3 rounded-2xl border-2 border-slate-200 bg-slate-50 cursor-pointer mb-2">
          <input type="checkbox" checked={cuFise} onChange={e => setCuFise(e.target.checked)}
            className="mt-0.5 w-4 h-4 shrink-0 accent-blue-600" />
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-slate-800">Si fisele dispozitivelor, fiecare in Word</span>
            <span className="block text-[11px] font-semibold text-slate-500">
              Se scriu pe loc, fara niciun drum la retea — dar la multe aparate dureaza si iese un fisier mare.
            </span>
          </span>
        </label>
        {cuFise && (
          <label className="flex items-start gap-3 px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white cursor-pointer ml-6 mb-2">
            <input type="checkbox" checked={doarCuLipsuri} onChange={e => setDoarCuLipsuri(e.target.checked)}
              className="mt-0.5 w-4 h-4 shrink-0 accent-blue-600" />
            <span className="text-[13px] font-bold text-slate-800">
              Numai ale celor cu lipsuri
              <span className="block text-[11px] font-semibold text-slate-500">
                {p.aparateCuLipsuri.length} in loc de {aleSectiei.length}
              </span>
            </span>
          </label>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={() => scoate('dosar')} disabled={!!lucreaza}
            className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase tracking-wide hover:bg-slate-800 transition active:scale-95 disabled:opacity-50">
            {lucreaza ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderArchive className="w-4 h-4" />}
            Descarca dosarul (ZIP)
          </button>
          <button onClick={() => scoate('registru')} disabled={!!lucreaza}
            className="flex items-center gap-2 px-5 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-[12px] hover:border-blue-300 hover:text-blue-700 transition active:scale-95 disabled:opacity-50">
            <FileSpreadsheet className="w-4 h-4" /> Doar registrul
          </button>
          <button onClick={() => scoate('plan')} disabled={!!lucreaza}
            className="flex items-center gap-2 px-5 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-[12px] hover:border-blue-300 hover:text-blue-700 transition active:scale-95 disabled:opacity-50">
            <Download className="w-4 h-4" /> Doar planul {an}
          </button>
        </div>
        {lucreaza && (
          <p className="mt-3 text-[12px] font-bold text-slate-500 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {lucreaza}
          </p>
        )}
      </div>
    </div>
  );
};

/** O cerinta: capul ei se citeste intotdeauna, lista se deschide la cerere. */
const Cerinta: React.FC<{
  stare: StareaCerintei;
  deschisa: boolean;
  onToggle: () => void;
  onSelectDevice: (id: string) => void;
}> = ({ stare, deschisa, onToggle, onSelectDevice }) => {
  const { cerinta, lipsuri, gata, cateIntrebate } = stare;
  const nuSeAplica = cateIntrebate === 0;
  const sePoateDeschide = !gata && lipsuri.length > 0;

  return (
    <div className={`rounded-2xl border overflow-hidden transition ${
      nuSeAplica ? 'bg-slate-50 border-slate-100'
      : gata ? 'bg-emerald-50/50 border-emerald-200'
      : 'bg-red-50/50 border-red-200'
    }`}>
      <button type="button" onClick={sePoateDeschide ? onToggle : undefined}
        aria-expanded={sePoateDeschide ? deschisa : undefined}
        className={`w-full flex items-start gap-3 px-4 py-4 text-left ${sePoateDeschide ? 'cursor-pointer' : 'cursor-default'}`}>
        <span className="shrink-0 mt-0.5">
          {nuSeAplica ? <ShieldCheck className="w-5 h-5 text-slate-300" />
            : gata ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            : <AlertTriangle className="w-5 h-5 text-red-600" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-black text-slate-900">{cerinta.titlu}</span>
          <span className="block text-[12px] font-semibold text-slate-600 mt-0.5">{cerinta.ce}</span>
          <span className="block text-[11px] font-semibold text-slate-400 mt-1 italic">{cerinta.temei}</span>
        </span>
        <span className="shrink-0 flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black whitespace-nowrap ${
            nuSeAplica ? 'bg-slate-100 text-slate-400'
            : gata ? 'bg-emerald-600 text-white'
            : 'bg-red-600 text-white'
          }`}>
            {nuSeAplica ? 'nu se aplica'
              : gata ? 'in regula'
              /* O cerinta a unitatii n-are aparate de numarat. */
              : cerinta.peUnitate ? 'lipseste'
              : `${lipsuri.length} din ${cateIntrebate}`}
          </span>
          {sePoateDeschide && (
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${deschisa ? 'rotate-180' : ''}`} />
          )}
        </span>
      </button>

      {deschisa && sePoateDeschide && (
        <ul className="px-3 pb-3 space-y-1.5">
          {lipsuri.map(l => (
            <li key={l.device.id}>
              <button onClick={() => onSelectDevice(l.device.id)}
                className="w-full flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-3 rounded-xl bg-white border border-slate-200 hover:border-blue-300 text-left transition">
                {/* Prin `scris`, nu campul: "N/A" si "Unassigned" sunt
                    locţiitori pusi de aplicatie, nu date, si tocmai lipsa lor
                    e ce arata lista. */}
                <span className="text-[13px] font-black text-slate-900">{scris(l.device.name) || 'Fara denumire'}</span>
                {scris(l.device.serialNumber) && (
                  <span className="text-[11px] font-bold text-slate-500 font-mono">{scris(l.device.serialNumber)}</span>
                )}
                {scris(l.device.department) && (
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />{scris(l.device.department)}
                  </span>
                )}
                <span className="w-full text-[12px] font-bold text-red-700">{l.deCe}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PregatitControl;
