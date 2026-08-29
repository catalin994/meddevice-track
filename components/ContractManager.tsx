
import React, { useRef, useState, Suspense } from 'react';
import { notify } from '../services/notices';
import { Contract, MedicalDevice, Invoice, InvoiceStatus, DeviceFile, normaliseInvoiceStatus } from '../types';
import { ShieldCheck, Plus, X, Wand2, Search, Check, Info, Calendar, DollarSign, Phone, FileText, ChevronRight, Loader2, Pencil, Eye } from 'lucide-react';
import { analyzeContractText } from '../services/geminiService';
import { citesteContractPdf } from '../services/contractParse';
import { buildPath, uploadDataUrl, resolveSource } from '../services/fileStorage';
import { marime } from '../services/spatiu';
import { saveFileAs } from '../services/fileService';

import Portal from './Portal';
const FileViewer = React.lazy(() => import('./FileViewer'));
interface ContractManagerProps {
  devices: MedicalDevice[];
  /** Facturile: pe fisa unui contract se vede ce a venit pe el si ce a ramas. */
  invoices?: Invoice[];
  /** Contractele din tabelul lor, inclusiv cele care n-au niciun aparat. */
  contracte?: Contract[];
  onSaveContract: (contract: Contract, deviceIds: string[]) => void;
}

const lei = (n: number) => n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * PDF-ul contractului, in forma pe care o intelege vizualizatorul de fisiere.
 *
 * Campurile citite din contract sunt bune ca sa stii ce contract e, dar nu si
 * ce scrie in el. Intrebarile care se pun cu adevarat — ce intra la obiect,
 * ce se plateste pentru deplasare, cine semneaza receptia — se citesc doar de
 * pe pagina scanata, asa ca ea trebuie sa se deschida de aici.
 */
const pdfulContractului = (c: {
  contractNumber?: string; filePath?: string; fileUrl?: string;
  fileName?: string; fileSize?: number; startDate?: string;
}): DeviceFile | null => {
  if (!c.filePath && !c.fileUrl) return null;
  return {
    id: `CTR-${c.contractNumber || 'pdf'}`,
    name: c.fileName || `Contract ${c.contractNumber || ''}.pdf`.replace(/\s+/g, ' ').trim(),
    type: 'achizitie',
    path: c.filePath,
    url: c.fileUrl,
    size: c.fileSize,
    dateAdded: c.startDate || '',
  };
};

/** Descarcarea: din Storage cand e urcat, din copia locala cand n-a apucat. */
const descarcaPdf = async (f: DeviceFile) => {
  const sursa = await resolveSource({ path: f.path, url: f.url });
  if (sursa.blob || sursa.dataUrl) await saveFileAs(f.name, sursa.blob || sursa.dataUrl!);
  else notify(sursa.error || 'Fisierul nu a putut fi descarcat.', 'warning');
};

const ContractManager: React.FC<ContractManagerProps> = ({ devices, invoices = [], contracte = [], onSaveContract }) => {
  const [isAdding, setIsAdding] = useState(false);
  /** Numarul contractului aflat in editare. Gol cand se adauga unul nou. */
  const [editez, setEditez] = useState<string | null>(null);
  /** Ce fise de contract au lista de aparate desfasurata. */
  const [aratAparate, setAratAparate] = useState<Record<string, boolean>>({});
  /** Contractul deschis pe pagina lui. */
  const [deschis, setDeschis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiText, setAiText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  /** Contractul al carui PDF se citeste acum pe ecran. */
  const [vadPdf, setVadPdf] = useState<DeviceFile | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    provider: '',
    contractNumber: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    coverageDetails: '',
    contactPhone: '',
    annualCost: 0,
    annualCostWithVat: 0,
    filePath: undefined as string | undefined,
    fileUrl: '',
    fileName: '',
    fileSize: 0,
  });
  const pdfRef = useRef<HTMLInputElement>(null);
  const [citeste, setCiteste] = useState(false);
  /** Ce a gasit si ce n-a gasit in PDF — un camp gol nu se vede intr-un formular. */
  const [notaPdf, setNotaPdf] = useState('');
  /** Textul citit efectiv. Cand un camp iese gresit, asta e diferenta dintre
   *  "textul e bun, tiparul a gresit" si "pagina n-are text". */
  const [randuriCitite, setRanduriCitite] = useState<string[]>([]);
  const [aratRanduri, setAratRanduri] = useState(false);

  /**
   * Contractul PDF: se ataseaza, si din el se completeaza campurile.
   *
   * Ce nu s-a putut citi ramane gol si se scrie de mana — asa se vede exact
   * unde a dat gres, in loc sa para ca aplicatia a inteles tot.
   */
  const incarcaPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setCiteste(true);
    setNotaPdf('');
    try {
      const c = await citesteContractPdf(f, (pag, din, proc) =>
        setNotaPdf(`Contract scanat — se citeste cu OCR: pagina ${pag} din ${din}, ${proc}%`));
      setRanduriCitite(c.lines);
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(f);
      });
      const id = `CON-${crypto.randomUUID()}`;
      const urcat = await uploadDataUrl(buildPath('contracts', id, id, f.name), dataUrl);

      setFormData(prev => ({
        ...prev,
        name: c.name || prev.name,
        provider: c.provider || prev.provider,
        contractNumber: c.contractNumber || prev.contractNumber,
        startDate: c.startDate || prev.startDate,
        endDate: c.endDate || prev.endDate,
        coverageDetails: c.coverageDetails || prev.coverageDetails,
        annualCost: c.annualCost || prev.annualCost,
        annualCostWithVat: c.annualCostWithVat || prev.annualCostWithVat,
        filePath: urcat.path || undefined,
        fileUrl: urcat.path ? '' : dataUrl,
        fileName: f.name,
        fileSize: f.size,
      }));

      const gasit = [
        c.contractNumber && `nr. ${c.contractNumber}`,
        c.provider && c.provider,
        c.startDate && c.endDate && `${c.startDate} — ${c.endDate}`,
        c.annualCost && `${c.annualCost.toLocaleString('ro-RO')} lei fara TVA`,
        c.annualCostWithVat && `${c.annualCostWithVat.toLocaleString('ro-RO')} lei cu TVA`,
        c.coverageDetails && 'obiectul',
      ].filter(Boolean);
      const lipsa = [
        !c.contractNumber && 'numarul',
        !c.provider && 'firma',
        !(c.startDate && c.endDate) && 'perioada',
        !c.coverageDetails && 'obiectul',
      ].filter(Boolean);
      setNotaPdf(
        (gasit.length ? `Citit din contract: ${gasit.join(' · ')}` : 'PDF atasat, dar nu am recunoscut niciun camp')
        + (lipsa.length ? ` — completeaza ${lipsa.join(', ')}` : '')
        + (c.prinOcr ? ' · citit cu OCR (contract scanat)' : '')
        + (urcat.path ? '' : ' · fisierul a ramas doar pe acest aparat')
      );
    } catch (err: any) {
      setNotaPdf(`PDF-ul nu a putut fi citit${err?.message ? `: ${err.message}` : ''}`);
    } finally {
      setCiteste(false);
    }
  };

  /*
   * Toate contractele, din amandoua locurile.
   *
   * Copia din randul aparatelor a ramas — de ea atarna ce se vede pe fisa
   * fiecarui aparat — dar lista se face acum si din tabelul contractelor, unde
   * stau si cele care nu se leaga de niciun aparat. Cand acelasi numar apare in
   * amandoua, tabelul are ultimul cuvant: acolo se scrie la salvare.
   */
  const globalContracts = React.useMemo(() => {
    const map = new Map<string, Contract>();
    devices.flatMap(d => d.contracts || []).forEach(c => map.set(c.contractNumber, c));
    contracte.forEach(c => map.set(c.contractNumber, c));
    return Array.from(map.values());
  }, [devices, contracte]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const eSuma = name === 'annualCost' || name === 'annualCostWithVat';
    setFormData(prev => ({ ...prev, [name]: eSuma ? parseFloat(value) || 0 : value }));
  };

  const toggleDevice = (id: string) => {
    setSelectedDevices(prev => 
      prev.includes(id) ? prev.filter(did => did !== id) : [...prev, id]
    );
  };

  const handleAiExtract = async () => {
    if (!aiText) return;
    setIsAnalyzing(true);
    try {
      const extracted = await analyzeContractText(aiText);
      setFormData(prev => ({
        ...prev,
        ...extracted,
        annualCost: extracted.annualCost || prev.annualCost
      }));
      setAiText('');
    } catch (err) {
      notify('Extragerea automata din PDF a esuat. Completeaza campurile manual.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Deschide un contract existent, cu tot cu aparatele pe care e trecut.
   *
   * Pana acum contractele se puteau doar adauga. Ce iesea gresit din PDF ramanea
   * gresit, si singura scapare era sa fie facut altul cu acelasi numar.
   */
  const deschideEditarea = (c: Contract) => {
    setFormData({
      name: c.name || '',
      provider: c.provider || '',
      contractNumber: c.contractNumber || '',
      startDate: c.startDate || new Date().toISOString().split('T')[0],
      endDate: c.endDate || '',
      coverageDetails: c.coverageDetails || '',
      contactPhone: c.contactPhone || '',
      annualCost: c.annualCost || 0,
      annualCostWithVat: c.annualCostWithVat || 0,
      filePath: c.filePath,
      fileUrl: c.fileUrl || '',
      fileName: c.fileName || '',
      fileSize: c.fileSize || 0,
    });
    setSelectedDevices(devices.filter(d => (d.contracts || [])
      .some(x => x.contractNumber === c.contractNumber)).map(d => d.id));
    setNotaPdf('');
    setRanduriCitite([]);
    setEditez(c.contractNumber);
    setIsAdding(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    /*
     * Fara aparate se poate. Un contract de consumabile sau de service general
     * nu se leaga de un aparat anume, si pana acum nu se putea salva deloc:
     * ecranul cerea o bifa care n-avea ce sa insemne.
     */
    const vechi = globalContracts.find(c => c.contractNumber === editez);
    const newContract: Contract = {
      // La editare se pastreaza id-ul: e acelasi contract, nu altul.
      id: vechi?.id || `CON-${crypto.randomUUID()}`,
      ...formData,
    };
    onSaveContract(newContract, selectedDevices);
    notify(editez ? 'Contract actualizat' : 'Contract salvat', 'success');
    setIsAdding(false);
    resetForm();
  };

  const resetForm = () => {
    setEditez(null);
    setRanduriCitite([]);
    setNotaPdf('');
    setFormData({
      name: '',
      provider: '',
      contractNumber: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      coverageDetails: '',
      contactPhone: '',
      annualCost: 0,
      annualCostWithVat: 0,
      filePath: undefined,
      fileUrl: '',
      fileName: '',
      fileSize: 0,
    });
    setSelectedDevices([]);
  };

  const filteredDevices = devices.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /**
   * Pagina unui contract: ce acopera, ce s-a facturat pe el, si cat a ramas.
   *
   * Intrebarea nu e cati bani are contractul, ci cati mai are. Pana acum
   * raspunsul se aduna de mana din tab-ul de facturi, cautand dupa numarul
   * contractului — deci de obicei nu se aduna deloc.
   */
  /*
   * Vizualizatorul se randeaza si pe pagina unui contract, si in lista: sunt
   * doua randari diferite ale aceleiasi componente, si pus intr-una singura
   * butonul din cealalta n-ar deschide nimic.
   */
  const vizualizatorul = vadPdf && (
    <Suspense fallback={null}>
      <FileViewer file={vadPdf} onDownload={descarcaPdf} onClose={() => setVadPdf(null)} />
    </Suspense>
  );

  const contractDeschis = globalContracts.find(c => c.contractNumber === deschis);
  if (contractDeschis) {
    const c = contractDeschis;
    const acoperite = devices.filter(d =>
      (d.contracts || []).some(x => x.contractNumber === c.contractNumber));
    const aleLui = invoices
      .filter(i => (i.contractNumber || '').trim() === c.contractNumber.trim())
      .sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
    const facturat = aleLui.reduce((s2, i) => s2 + (i.amount || 0), 0);
    // Facturile poarta suma cu TVA, deci se compara cu valoarea cu TVA a
    // contractului. Cand contractul n-o are scrisa, se spune fata de ce se
    // masoara, in loc sa se compare doua lucruri diferite pe tacute.
    const plafon = c.annualCostWithVat || c.annualCost || 0;
    const cuTva = !!c.annualCostWithVat;
    const ramas = Math.max(0, plafon - facturat);
    const procent = plafon > 0 ? Math.min(100, (facturat / plafon) * 100) : 0;
    const depasit = plafon > 0 && facturat > plafon;

    // Cate o bara pe luna, din facturile lui — cat s-a facturat si cand.
    const peLuni = new Map<string, number>();
    for (const i of aleLui) {
      const luna = (i.issueDate || '').slice(0, 7);
      if (luna) peLuni.set(luna, (peLuni.get(luna) || 0) + (i.amount || 0));
    }
    const luni = [...peLuni.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const maxLuna = Math.max(1, ...luni.map(l => l[1]));

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <button onClick={() => setDeschis(null)}
                className="text-[11px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition mb-3">
                ← Inapoi la contracte
              </button>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight break-words">
                  {c.name || c.provider}
                </h2>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Nr. ctr.</span>
                  <span className="text-[15px] font-black font-mono">{c.contractNumber}</span>
                </span>
              </div>
              <p className="text-sm text-slate-500 font-bold mt-1">
                {c.provider} · {c.startDate} — {c.endDate}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {pdfulContractului(c) && (
                <button onClick={() => setVadPdf(pdfulContractului(c))}
                  className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-600/20">
                  <Eye className="w-4 h-4" /> Vezi contractul
                </button>
              )}
              <button onClick={() => deschideEditarea(c)}
                className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition flex items-center gap-2">
                <Pencil className="w-4 h-4" /> Modifica
              </button>
            </div>
          </div>
          {/*
            Numele fisierului si marimea lui. Intrebarea "unde e si cat ocupa"
            se punea si nu avea raspuns nicaieri in aplicatie.
          */}
          {pdfulContractului(c) && (
            <p className="mt-4 text-[12px] font-bold text-slate-500 break-words">
              {c.fileName || 'contract.pdf'}
              {!!c.fileSize && <> · {marime(c.fileSize)}</>}
              {' · '}
              {c.filePath ? 'in spatiul de fisiere din cloud' : 'doar pe acest aparat, inca neurcat'}
            </p>
          )}
          {!pdfulContractului(c) && (
            <p className="mt-4 text-[12px] font-bold text-slate-500">
              Contractul n-are PDF atasat. Apasa Modifica si incarca-l — de acolo isi ia si datele.
            </p>
          )}
          {c.coverageDetails && (
            <p className="mt-5 text-[14px] font-semibold text-slate-600 leading-relaxed">{c.coverageDetails}</p>
          )}
        </div>

        {/* ── cat s-a facturat, cat a ramas ── */}
        <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Valoarea contractului{cuTva ? ' (cu TVA)' : ' (fara TVA)'}
              </p>
              <p className="text-xl font-black text-slate-900 tabular-nums mt-1">{lei(plafon)} lei</p>
              {cuTva && (
                <p className="text-[11px] font-bold text-slate-500 mt-0.5 tabular-nums">
                  {lei(c.annualCost)} fara TVA
                </p>
              )}
            </div>
            <div className="p-4 bg-blue-50 rounded-2xl">
              <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Facturat</p>
              <p className="text-xl font-black text-blue-700 tabular-nums mt-1">{lei(facturat)} lei</p>
              <p className="text-[11px] font-bold text-blue-600/70 mt-0.5">
                {aleLui.length} factur{aleLui.length === 1 ? 'a' : 'i'}
              </p>
            </div>
            <div className={`p-4 rounded-2xl ${depasit ? 'bg-red-50' : 'bg-emerald-50'}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest ${depasit ? 'text-red-700' : 'text-emerald-700'}`}>
                {depasit ? 'Facturat peste contract' : 'Ramas de facturat'}
              </p>
              <p className={`text-xl font-black tabular-nums mt-1 ${depasit ? 'text-red-700' : 'text-emerald-700'}`}>
                {lei(depasit ? facturat - plafon : ramas)} lei
              </p>
            </div>
          </div>

          <div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${depasit ? 'bg-red-600' : 'bg-blue-600'}`}
                style={{ width: `${Math.max(procent, facturat > 0 ? 2 : 0)}%` }} />
            </div>
            <p className="text-[11px] font-bold text-slate-500 mt-2">
              {plafon > 0
                ? `${Math.round(procent)}% din valoarea contractului`
                : 'Contractul n-are valoare trecuta — completeaz-o ca sa se vada cat a ramas.'}
            </p>
          </div>

          {/* ── cate o bara pe luna ── */}
          {luni.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Facturat pe luni</p>
              <div className="space-y-2">
                {luni.map(([luna, suma]) => (
                  <div key={luna} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-[11px] font-black text-slate-500 tabular-nums">{luna}</span>
                    <div className="flex-1 h-6 bg-slate-50 rounded-lg overflow-hidden">
                      <div className="h-full bg-blue-600/80 rounded-lg" style={{ width: `${(suma / maxLuna) * 100}%` }} />
                    </div>
                    <span className="w-28 shrink-0 text-right text-[12px] font-black text-slate-900 tabular-nums">{lei(suma)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── aparatele ── */}
          <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">
              Aparate care fac obiectul contractului ({acoperite.length})
            </h3>
            {acoperite.length === 0 ? (
              <p className="text-[13px] font-bold text-slate-500">Niciun aparat legat de acest contract.</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                {acoperite.map(d => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="h-9 w-9 shrink-0 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
                      {d.image
                        ? <img src={d.image} alt="" className="h-full w-full object-cover" />
                        : <span className="text-[11px] font-black text-slate-500">{d.name.charAt(0)}</span>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-slate-900 truncate">{d.name}</p>
                      <p className="text-[11px] font-bold text-slate-500 truncate">
                        {[d.serialNumber, d.department, d.model].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── facturile ── */}
          <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">
              Facturi pe acest contract ({aleLui.length})
            </h3>
            {aleLui.length === 0 ? (
              <p className="text-[13px] font-bold text-slate-500 leading-relaxed">
                Nicio factura legata de contract. Facturile se leaga prin numarul contractului,
                din fisa fiecareia.
              </p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                {aleLui.map(i => {
                  const urcata = normaliseInvoiceStatus(i.status) === InvoiceStatus.UPLOADED;
                  return (
                    <div key={i.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-slate-900 truncate">
                          {i.invoiceNumber}
                          <span className="text-[11px] font-bold text-slate-500"> · {i.issueDate}</span>
                        </p>
                        <p className="text-[11px] font-bold text-slate-500 truncate">
                          {i.description || i.supplier}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[14px] font-black text-slate-900 tabular-nums">{lei(i.amount || 0)}</p>
                        <p className={`text-[10px] font-black uppercase tracking-wide ${urcata ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {urcata ? 'in ConectX' : 'neincarcata'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {vizualizatorul}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <ShieldCheck className="w-8 h-8" />
            </div>
            Registru Contracte
          </h2>
          <p className="text-sm text-slate-500 font-bold uppercase mt-1 tracking-widest">Contracte de service</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition shadow-xl active:scale-95 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Adauga Contract
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {globalContracts.map(contract => (
          <div key={contract.contractNumber}
            onClick={() => setDeschis(contract.contractNumber)}
            role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDeschis(contract.contractNumber); } }}
            aria-label={`Deschide contractul ${contract.contractNumber}`}
            className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-sm transition-all group relative overflow-hidden cursor-pointer text-left">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
               <ShieldCheck className="w-32 h-32 text-indigo-900" />
            </div>
            
            {/*
              Se infasoara: cu doua butoane langa insigna, valoarea ramanea pe
              trei randuri intr-o coloana din trei, si nu se mai citea.
            */}
            <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest">Contract Valid</span>
                {/* Se vede din lista care contracte au hartia scanata si care nu. */}
                {pdfulContractului(contract) && (
                  <button onClick={e => { e.stopPropagation(); setVadPdf(pdfulContractului(contract)); }}
                    title="Vezi contractul scanat"
                    aria-label={`Vezi PDF-ul contractului ${contract.contractNumber}`}
                    className="relative z-10 p-2 bg-white border border-slate-200 text-slate-500 rounded-lg hover:text-blue-600 hover:border-blue-200 transition">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); deschideEditarea(contract); }}
                  title="Modifica datele contractului"
                  aria-label={`Modifica contractul ${contract.contractNumber}`}
                  className="relative z-10 p-2 bg-white border border-slate-200 text-slate-500 rounded-lg hover:text-blue-600 hover:border-blue-200 transition">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">Valoare fara TVA</p>
                <p className="text-lg font-black text-indigo-600 tabular-nums">
                  {contract.annualCost.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei
                </p>
                {!!contract.annualCostWithVat && contract.annualCostWithVat > contract.annualCost && (
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5 tabular-nums">
                    TVA {(contract.annualCostWithVat - contract.annualCost).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {' · '}
                    {contract.annualCostWithVat.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cu TVA
                  </p>
                )}
              </div>
            </div>

            <h3 className="text-xl font-black text-slate-900 leading-none">{contract.provider}</h3>
            {/* "Ref:" nu spune nimic. Pe hartie scrie nr. ctr., asa se cauta. */}
            <p className="mt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 text-white rounded-lg">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Nr. ctr.</span>
                <span className="text-[13px] font-black font-mono">{contract.contractNumber}</span>
              </span>
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>{contract.startDate} — {contract.endDate}</span>
              </div>
              {/* Randul cu telefonul apare doar cand exista unul. */}
              {!!contract.contactPhone && (
                <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <span>{contract.contactPhone}</span>
                </div>
              )}
            </div>

            {/*
              Care aparate, nu cate. Erau patru cerculete cu initiala numelui —
              din ele nu se putea afla daca sterilizatorul cutare e sau nu pe
              contract, si asta e chiar intrebarea care se pune.
            */}
            {(() => {
              const acoperite = devices.filter(d =>
                (d.contracts || []).some(c => c.contractNumber === contract.contractNumber));
              const desfasurat = !!aratAparate[contract.contractNumber];
              const aratate = desfasurat ? acoperite : acoperite.slice(0, 3);
              return (
                <div className="mt-8 pt-6 border-t border-slate-50 relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Aparate acoperite ({acoperite.length})
                    </span>
                    {acoperite.length > 3 && (
                      <button
                        onClick={e => { e.stopPropagation(); setAratAparate(p => ({ ...p, [contract.contractNumber]: !desfasurat })); }}
                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition">
                        {desfasurat ? 'Arata mai putine' : `Vezi toate ${acoperite.length}`}
                      </button>
                    )}
                  </div>
                  {acoperite.length === 0 ? (
                    <p className="text-[12px] font-bold text-slate-500">Niciun aparat legat de acest contract.</p>
                  ) : (
                    <div className={`space-y-1.5 ${desfasurat ? 'max-h-56 overflow-y-auto custom-scrollbar pr-1' : ''}`}>
                      {aratate.map(d => (
                        <div key={d.id} className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl">
                          <div className="h-7 w-7 shrink-0 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
                            {d.image
                              ? <img src={d.image} alt="" className="h-full w-full object-cover" />
                              : <span className="text-[10px] font-black text-slate-500">{d.name.charAt(0)}</span>}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-slate-900 truncate">{d.name}</p>
                            <p className="text-[10px] font-bold text-slate-500 truncate">
                              {[d.serialNumber, d.department].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </div>
                      ))}
                      {!desfasurat && acoperite.length > 3 && (
                        <p className="text-[11px] font-bold text-slate-500 pl-1">
                          si inca {acoperite.length - 3}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ))}
        {globalContracts.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-50 flex flex-col items-center">
            <FileText className="w-16 h-16 text-slate-100 mb-4" />
            <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Niciun contract activ</p>
          </div>
        )}
      </div>

      {isAdding && (
        <Portal>
        <div className="fixed inset-0 z-[100] scrim flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-6xl modal-shell overflow-hidden flex flex-col animate-fade-in border border-white">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                    {editez ? 'Modifica Contractul' : 'Adauga Contract'}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-black uppercase mt-1 tracking-widest">
                    {editez ? `Nr. ${editez}` : 'Asociaza contractul cu dispozitivele'}
                  </p>
               </div>
               <button onClick={() => { setIsAdding(false); resetForm(); }} className="p-3 bg-white text-slate-500 rounded-2xl hover:text-slate-900 transition shadow-sm border border-slate-200"><X className="w-6 h-6" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 lg:p-12">
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  <div className="lg:col-span-7 space-y-10">
                     <div className="space-y-6">
                        {/*
                          Contractul e deja scris. Se ataseaza PDF-ul, si din el
                          se completeaza numarul, firma, obiectul, perioada si
                          valoarea — de verificat, nu de crezut pe cuvant.
                        */}
                        <div className="bg-slate-900 p-5 sm:p-8 rounded-2xl sm:rounded-[2rem] text-white shadow-xl">
                           <div className="flex items-center gap-3 mb-3">
                              <FileText className="w-6 h-6 text-blue-400" />
                              <h4 className="text-sm font-black uppercase tracking-widest">Contractul in PDF</h4>
                           </div>
                           <p className="text-[13px] font-semibold text-slate-300 leading-relaxed mb-5">
                              Se ataseaza la contract si se citesc din el denumirea, numarul, firma,
                              obiectul, perioada si valoarea. Ce nu se poate citi ramane de completat.
                           </p>
                           <input ref={pdfRef} type="file" accept="application/pdf" onChange={incarcaPdf} className="hidden" />
                           <div className="flex flex-wrap items-center gap-3">
                             <button type="button" onClick={() => pdfRef.current?.click()} disabled={citeste}
                               className="px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2">
                               {citeste ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                               {citeste ? 'Se citeste...' : formData.fileName ? 'Alege alt PDF' : 'Incarca PDF-ul contractului'}
                             </button>
                             {formData.fileName && (
                               <>
                                 <span className="text-[12px] font-bold text-emerald-300 truncate max-w-[240px]" title={formData.fileName}>
                                   {formData.fileName}
                                 </span>
                                 {/* Ce s-a atasat se poate citi pe loc, inainte de salvare. */}
                                 <button type="button" onClick={() => setVadPdf(pdfulContractului(formData))}
                                   className="px-4 py-3 bg-white/10 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-white/20 transition flex items-center gap-2">
                                   <Eye className="w-4 h-4" /> Deschide
                                 </button>
                               </>
                             )}
                           </div>
                           {notaPdf && (
                             <p className="mt-4 text-[12px] font-bold text-blue-200 leading-relaxed">{notaPdf}</p>
                           )}
                           {randuriCitite.length > 0 && (
                             <div className="mt-3">
                               <button type="button" onClick={() => setAratRanduri(v => !v)}
                                 className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition">
                                 {aratRanduri ? 'Ascunde' : 'Vezi'} textul citit din contract ({randuriCitite.length} randuri)
                               </button>
                               {aratRanduri && (
                                 <pre data-text-contract className="mt-2 max-h-64 overflow-y-auto bg-black/40 rounded-xl p-4 text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
                                   {randuriCitite.join('\n')}
                                 </pre>
                               )}
                             </div>
                           )}
                        </div>

                        <div className="bg-violet-900 p-5 sm:p-8 rounded-2xl sm:rounded-[2rem] text-white shadow-xl">
                           <div className="flex items-center gap-3 mb-6">
                              <Wand2 className="w-6 h-6 text-violet-400" />
                              <h4 className="text-sm font-black uppercase tracking-widest">Extragere Inteligenta AI</h4>
                           </div>
                           <textarea 
                              className="w-full bg-white/10 border border-white/20 rounded-2xl p-6 text-sm font-medium outline-none focus:bg-white/20 transition-all placeholder:text-violet-300/50 min-h-[120px]" 
                              placeholder="Lipeste aici textul contractului, date OCR sau rezumatul PDF..."
                              value={aiText}
                              onChange={(e) => setAiText(e.target.value)}
                           />
                           <button 
                              onClick={handleAiExtract}
                              disabled={isAnalyzing || !aiText}
                              className="mt-6 w-full py-4 bg-white text-violet-900 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-violet-50 transition flex items-center justify-center gap-2 disabled:opacity-50"
                           >
                              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Extrage Datele Contractului"}
                           </button>
                        </div>

                        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                           <div className="sm:col-span-2">
                             <FormInput label="Denumirea contractului" name="name" value={formData.name} onChange={handleInputChange} placeholder="ex: Contract de prestari servicii mentenanta" />
                           </div>
                           <FormInput label="Furnizor Service" name="provider" value={formData.provider} onChange={handleInputChange} placeholder="ex: GE HealthCare" required />
                           <FormInput label="Nr. contract" name="contractNumber" value={formData.contractNumber} onChange={handleInputChange} placeholder="MSLA-992-00" required />
                           <FormInput label="Data Inceput" name="startDate" type="date" value={formData.startDate} onChange={handleInputChange} required />
                           <FormInput label="Data Expirare" name="endDate" type="date" value={formData.endDate} onChange={handleInputChange} required />
                           <FormInput label="Valoare fara TVA (lei)" name="annualCost" type="number" value={formData.annualCost.toString()} onChange={handleInputChange} placeholder="0.00" required />
                           <FormInput label="Valoare cu TVA (lei)" name="annualCostWithVat" type="number" value={formData.annualCostWithVat.toString()} onChange={handleInputChange} placeholder="0.00" />
                           {/* TVA-ul nu se tasteaza: e diferenta celor doua, si asa nu poate iesi altceva. */}
                           <div className="sm:col-span-2 px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-baseline justify-between gap-2">
                             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TVA</span>
                             <span className="text-[15px] font-black text-slate-900 tabular-nums">
                               {formData.annualCostWithVat > formData.annualCost
                                 ? `${(formData.annualCostWithVat - formData.annualCost).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`
                                 : '—'}
                             </span>
                           </div>
                           {/*
                             Nu mai e obligatoriu. Contractele nu poarta un
                             telefon de suport, deci un contract incarcat din
                             PDF nu se putea salva pana nu se inventa unul.
                           */}
                           <FormInput label="Telefon Suport" name="contactPhone" type="tel" value={formData.contactPhone} onChange={handleInputChange} placeholder="optional" />
                           <div className="sm:col-span-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Obiectul contractului</label>
                              <textarea 
                                 name="coverageDetails"
                                 value={formData.coverageDetails}
                                 onChange={handleInputChange}
                                 className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold min-h-[100px] outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                 placeholder="Piese incluse, manopera, actualizari software, timp de raspuns 4h..."
                                 required
                              />
                           </div>
                           <button type="submit" className="hidden" id="main-submit-btn"></button>
                        </form>
                     </div>
                  </div>

                  <div className="lg:col-span-5 space-y-6">
                     <div className="bg-slate-50 p-5 sm:p-8 rounded-3xl border border-slate-100 h-full flex flex-col">
                        <div className="mb-6">
                           <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                              <Plus className="w-5 h-5 text-indigo-600" /> Asociaza Dispozitive
                           </h4>
                           <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Selectate: {selectedDevices.length}</p>
                        </div>

                        <div className="relative mb-6">
                           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                           <input 
                              type="text" 
                              placeholder="Cauta in inventar..."
                              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                           />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                           {filteredDevices.map(device => (
                              <div 
                                 key={device.id}
                                 onClick={() => toggleDevice(device.id)}
                                 className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${
                                    selectedDevices.includes(device.id) 
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' 
                                    : 'bg-white border-slate-100 hover:border-indigo-200'
                                 }`}
                              >
                                 <div className={`p-2 rounded-lg ${selectedDevices.includes(device.id) ? 'bg-white/20' : 'bg-slate-50 text-slate-500'}`}>
                                    {selectedDevices.includes(device.id) ? <Check className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                                 </div>
                                 <div className="truncate flex-1">
                                    <p className={`text-[11px] font-black truncate ${selectedDevices.includes(device.id) ? 'text-white' : 'text-slate-900'}`}>{device.name}</p>
                                    <p className={`text-[10px] font-bold uppercase tracking-tighter ${selectedDevices.includes(device.id) ? 'text-white/60' : 'text-slate-500'}`}>{device.serialNumber}</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
               <button onClick={() => setIsAdding(false)} className="px-8 py-4 text-slate-500 font-black text-xs uppercase tracking-widest">Renunta</button>
               <button 
                  onClick={() => document.getElementById('main-submit-btn')?.click()}
                  className="px-12 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-indigo-700 transition active:scale-95 flex items-center gap-3"
               >
                  <ShieldCheck className="w-5 h-5" /> {editez ? 'Salveaza modificarile' : 'Salveaza Contract'}
               </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {vizualizatorul}
    </div>
  );
};

const FormInput = ({ label, name, value, onChange, placeholder, type = "text", required = false }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
    <input 
      required={required}
      name={name} 
      type={type} 
      value={value} 
      onChange={onChange} 
      placeholder={placeholder} 
      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
    />
  </div>
);

export default ContractManager;
