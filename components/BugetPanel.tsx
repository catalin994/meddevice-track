import React, { useMemo, useState } from 'react';
import { Landmark, AlertTriangle, Search } from 'lucide-react';
import { FoundationDoc, Invoice } from '../types';

/**
 * Cat s-a angajat si cat s-a facturat, pe fiecare articol bugetar.
 *
 * Documentul de fundamentare exista tocmai ca sa raspunda la intrebarea asta:
 * cat se angajeaza bugetar si pe ce pozitie. Aplicatia tinea deja si
 * angajamentul, si plata — documentul de fundamentare cu valoarea actualizata,
 * factura cu suma — dar raspunsul se aduna de mana din doua tab-uri, si de
 * obicei nu se aduna deloc.
 *
 * Doua reguli fac cifrele sa fie corecte:
 *
 * 1. Pe o serie lunara conteaza doar ultima luna. Valoarea de pe documentul de
 *    fundamentare e cumulata — 22.586,69 devine 25.813,36 luna urmatoare — deci
 *    adunarea tuturor lunilor ar numara acelasi angajament de douasprezece ori.
 * 2. Factura care n-are articol bugetar scris pe ea il mosteneste de la
 *    documentul de fundamentare cu acelasi numar de contract, iar daca nici
 *    asta nu exista, de la unul al aceluiasi furnizor — dar numai cand toate
 *    documentele acelui furnizor arata acelasi articol. Altfel ramane
 *    neatribuita, si se vede ca atare.
 */

const fmt = (n: number) => n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Rand {
  articol: string;
  coduriSSI: string[];
  angajat: number;
  facturat: number;
  nrAngajamente: number;
  nrFacturi: number;
  /** Facturi carora nu li s-a putut gasi articolul. */
  ghicit: number;
}

/** Angajamentele care conteaza: cate unul pe serie lunara, plus cele singulare. */
export const angajamenteleCurente = (docs: FoundationDoc[]): FoundationDoc[] => {
  const ultimulDinSerie = new Map<string, FoundationDoc>();
  const singulare: FoundationDoc[] = [];
  for (const d of docs) {
    if (!d.recurring) { singulare.push(d); continue; }
    const cheie = d.seriesId || d.id;
    const p = ultimulDinSerie.get(cheie);
    const luna = (x: FoundationDoc) => x.periodMonth || x.date || '';
    if (!p || luna(d) > luna(p)) ultimulDinSerie.set(cheie, d);
  }
  return [...singulare, ...ultimulDinSerie.values()];
};

/** Articolul bugetar al unei facturi: scris pe ea, sau dedus din documente. */
export const articolulFacturii = (
  f: Invoice,
  dupaContract: Map<string, string>,
  dupaFurnizor: Map<string, string | null>,
): { articol: string; ghicit: boolean } => {
  if (f.budgetArticle?.trim()) return { articol: f.budgetArticle.trim(), ghicit: false };
  const dinContract = f.contractNumber && dupaContract.get(f.contractNumber.trim().toLowerCase());
  if (dinContract) return { articol: dinContract, ghicit: true };
  const dinFurnizor = f.supplier && dupaFurnizor.get(f.supplier.trim().toLowerCase());
  if (dinFurnizor) return { articol: dinFurnizor, ghicit: true };
  return { articol: '', ghicit: false };
};

export const construiesteBugetul = (docs: FoundationDoc[], invoices: Invoice[], an: string): Rand[] => {
  const inAn = (data?: string) => an === 'TOT' || (data || '').startsWith(an);

  const angajamente = angajamenteleCurente(docs).filter(d => inAn(d.date));

  // Din ce document se poate afla articolul unei facturi.
  const dupaContract = new Map<string, string>();
  const furnizorArticole = new Map<string, Set<string>>();
  for (const d of docs) {
    const art = (d.budgetArticle || '').trim();
    if (!art) continue;
    for (const nr of [d.referenceNumber, d.frameworkContract]) {
      if (nr?.trim()) dupaContract.set(nr.trim().toLowerCase(), art);
    }
    if (d.supplier?.trim()) {
      const k = d.supplier.trim().toLowerCase();
      (furnizorArticole.get(k) || furnizorArticole.set(k, new Set()).get(k)!).add(art);
    }
  }
  // Un furnizor care apare pe doua articole diferite nu poate dezlega nimic.
  const dupaFurnizor = new Map<string, string | null>();
  for (const [k, set] of furnizorArticole) dupaFurnizor.set(k, set.size === 1 ? [...set][0] : null);

  const randuri = new Map<string, Rand>();
  const ia = (articol: string): Rand => {
    const k = articol || '—';
    if (!randuri.has(k)) {
      randuri.set(k, { articol: k, coduriSSI: [], angajat: 0, facturat: 0, nrAngajamente: 0, nrFacturi: 0, ghicit: 0 });
    }
    return randuri.get(k)!;
  };

  for (const d of angajamente) {
    const r = ia((d.budgetArticle || '').trim());
    r.angajat += d.amount || 0;
    r.nrAngajamente += 1;
    const ssi = (d.ssiCode || '').trim();
    if (ssi && !r.coduriSSI.includes(ssi)) r.coduriSSI.push(ssi);
  }

  for (const f of invoices) {
    if (!inAn(f.issueDate)) continue;
    const { articol, ghicit } = articolulFacturii(f, dupaContract, dupaFurnizor);
    const r = ia(articol);
    r.facturat += f.amount || 0;
    r.nrFacturi += 1;
    if (ghicit) r.ghicit += 1;
  }

  return [...randuri.values()].sort((a, b) => (b.angajat + b.facturat) - (a.angajat + a.facturat));
};

interface Props {
  docs: FoundationDoc[];
  invoices: Invoice[];
  moneda: string;
}

const BugetPanel: React.FC<Props> = ({ docs, invoices, moneda }) => {
  const aniDisponibili = useMemo(() => {
    const ani = new Set<string>();
    docs.forEach(d => { if (d.date) ani.add(d.date.slice(0, 4)); });
    invoices.forEach(f => { if (f.issueDate) ani.add(f.issueDate.slice(0, 4)); });
    return [...ani].sort().reverse();
  }, [docs, invoices]);

  const [an, setAn] = useState(() => String(new Date().getFullYear()));
  const [cauta, setCauta] = useState('');

  const randuri = useMemo(() => construiesteBugetul(docs, invoices, an), [docs, invoices, an]);
  const vizibile = useMemo(() => {
    const q = cauta.toLowerCase().trim();
    if (!q) return randuri;
    return randuri.filter(r => r.articol.toLowerCase().includes(q)
      || r.coduriSSI.some(c => c.toLowerCase().includes(q)));
  }, [randuri, cauta]);

  const total = useMemo(() => vizibile.reduce((t, r) => ({
    angajat: t.angajat + r.angajat, facturat: t.facturat + r.facturat,
  }), { angajat: 0, facturat: 0 }), [vizibile]);

  // Monedele straine s-ar aduna gresit peste lei.
  const alteMonede = useMemo(() => invoices.filter(f =>
    (an === 'TOT' || (f.issueDate || '').startsWith(an)) && f.currency && f.currency !== moneda).length,
    [invoices, an, moneda]);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={cauta} onChange={e => setCauta(e.target.value)}
            placeholder="Cauta dupa articol bugetar sau cod SSI..."
            aria-label="Cauta in buget"
            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-xl text-[15px] font-semibold outline-none" />
        </div>
        <select value={an} onChange={e => setAn(e.target.value)} aria-label="Anul"
          className="px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest outline-none">
          {aniDisponibili.map(a => <option key={a} value={a}>{a}</option>)}
          <option value="TOT">Toti anii</option>
        </select>
      </div>

      {alteMonede > 0 && (
        <div className="px-5 py-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-[13px] font-bold text-amber-900">
            {alteMonede} factur{alteMonede === 1 ? 'a e' : 'i sunt'} in alta moneda decat {moneda}.
            Sumele de mai jos le aduna ca atare, fara conversie.
          </p>
        </div>
      )}

      {vizibile.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[2.5rem] border-4 border-dashed border-slate-50 flex flex-col items-center">
          <Landmark className="w-16 h-16 text-slate-100 mb-4" />
          <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">
            {randuri.length === 0 ? `Nimic inregistrat pe ${an === 'TOT' ? 'niciun an' : an}` : 'Niciun articol gasit'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {vizibile.map(r => {
            const rest = r.angajat - r.facturat;
            const procent = r.angajat > 0 ? Math.min(100, Math.round((r.facturat / r.angajat) * 100)) : 0;
            const depasit = r.angajat > 0 && r.facturat > r.angajat;
            const faraAngajament = r.angajat === 0 && r.facturat > 0;
            return (
              <div key={r.articol} className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="p-3 rounded-2xl shrink-0 bg-slate-50 text-slate-600"><Landmark className="w-6 h-6" /></div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-black text-slate-900">
                        {r.articol === '—' ? 'Fara articol bugetar' : `Articolul ${r.articol}`}
                      </p>
                      <p className="text-xs font-bold text-slate-500 mt-0.5 break-words">
                        {r.nrAngajamente} angajament{r.nrAngajamente === 1 ? '' : 'e'} · {r.nrFacturi} factur{r.nrFacturi === 1 ? 'a' : 'i'}
                        {r.coduriSSI.length > 0 && ` · SSI ${r.coduriSSI.join(', ')}`}
                        {r.ghicit > 0 && (
                          <span className="text-amber-700"> · {r.ghicit} atribuit{r.ghicit === 1 ? 'a' : 'e'} dupa contract sau furnizor</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 sm:gap-6 shrink-0 text-right">
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Angajat</p>
                      <p className="text-[15px] font-black text-slate-900 tabular-nums">{fmt(r.angajat)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Facturat</p>
                      <p className="text-[15px] font-black text-slate-900 tabular-nums">{fmt(r.facturat)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Diferenta</p>
                      <p className={`text-[15px] font-black tabular-nums ${rest < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {fmt(rest)}
                      </p>
                    </div>
                  </div>
                </div>

                {r.angajat > 0 && (
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    {/* Facturat pana la angajament e normal, nu ingrijorator; abia
                        peste el e o problema, si atunci se si scrie sub bara. */}
                    <div className={`h-full rounded-full ${depasit ? 'bg-red-600' : 'bg-emerald-500'}`}
                      style={{ width: `${procent}%` }} />
                  </div>
                )}
                {depasit && (
                  <p className="text-[12px] font-bold text-red-700">
                    Facturat peste angajament cu {fmt(r.facturat - r.angajat)} {moneda} — angajamentul are nevoie de o revizuire.
                  </p>
                )}
                {faraAngajament && (
                  <p className="text-[12px] font-bold text-amber-700">
                    Facturi fara niciun document de fundamentare pe acest articol.
                  </p>
                )}
              </div>
            );
          })}

          <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-[2rem] flex flex-col sm:flex-row sm:items-center gap-4">
            <p className="text-xs font-black uppercase tracking-widest flex-1">
              Total {an === 'TOT' ? 'pe toti anii' : an}
            </p>
            <div className="grid grid-cols-3 gap-4 sm:gap-8 text-right">
              <div>
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Angajat</p>
                <p className="text-[17px] font-black tabular-nums">{fmt(total.angajat)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Facturat</p>
                <p className="text-[17px] font-black tabular-nums">{fmt(total.facturat)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Diferenta</p>
                <p className="text-[17px] font-black tabular-nums">{fmt(total.angajat - total.facturat)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(BugetPanel);
