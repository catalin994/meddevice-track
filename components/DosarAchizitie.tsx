import React, { useMemo, useState } from 'react';
import {
  FileSignature, FolderOpen, ShoppingCart, Receipt, Search, ChevronRight,
  ArrowRight, AlertCircle,
} from 'lucide-react';
import {
  Referat, FoundationDoc, Comanda, Invoice, MedicalDevice,
  comandaValoare, normaliseComandaStatus, COMANDA_STATUS_RO,
} from '../types';
import Pager, { usePagination, PageSizePicker } from './Pager';

/**
 * Dosarul unei achizitii, de la referat la factura.
 *
 * Piesele se leaga deja intre ele — documentul de fundamentare stie referatul,
 * comanda ii scrie numarul, factura poarta numarul comenzii — dar se adunau din
 * patru taburi diferite. "Ce s-a intamplat cu reparatia defibrilatorului" era o
 * intrebare la care se raspundea cu patru cautari si o foaie de hartie.
 *
 * Aici se vede lantul intreg, si unde s-a oprit: un referat fara comanda si un
 * referat cu marfa venita si nefacturata arata altfel de la prima privire.
 *
 * Ce nu face: nu inventeaza legaturi. Cand comanda scrie alt numar de referat
 * decat cel din aplicatie — se intampla, pe comanda scrie numarul de
 * inregistrare intreg — piesa nu se leaga, si se spune, in loc sa fie pusa in
 * dosar pe ghicite.
 */

const lei = (n: number) => n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const curat = (s?: string) => (s || '').trim().toLowerCase();

/**
 * Numarul de pe comanda il cuprinde pe cel din aplicatie?
 *
 * Referatul e "127" in aplicatie, dar pe comanda furnizorul scrie numarul de
 * inregistrare intreg, "14/24389/24.07.26". Se accepta si potrivirea exacta, si
 * cazul in care unul il contine pe celalalt ca bucata de numar intreaga — dar
 * nu doua cifre care se nimeresc, ca "12" sa nu prinda "127".
 */
const seLeaga = (alReferatului: string, alComenzii: string): boolean => {
  const a = curat(alReferatului), b = curat(alComenzii);
  if (!a || !b) return false;
  if (a === b) return true;
  const bucati = b.split(/[^0-9a-z]+/i).filter(Boolean);
  return bucati.includes(a);
};

interface Props {
  referate: Referat[];
  foundationDocs: FoundationDoc[];
  comenzi: Comanda[];
  invoices: Invoice[];
  devices: MedicalDevice[];
}

const DosarAchizitie: React.FC<Props> = ({ referate, foundationDocs, comenzi, invoices, devices }) => {
  const [cauta, setCauta] = useState('');
  const [deschis, setDeschis] = useState<string | null>(null);

  /** Tot lantul unui referat, strans o data. */
  const dosarul = useMemo(() => (r: Referat) => {
    const documente = foundationDocs.filter(d =>
      (d.referatId && d.referatId === r.id) || seLeaga(r.number, d.number || ''));
    const comenzile = comenzi.filter(c => seLeaga(r.number, c.referatNumber || ''));
    const numereComenzi = new Set(comenzile.map(c => curat(c.number)).filter(Boolean));
    const facturi = invoices.filter(i => numereComenzi.has(curat(i.orderNumber)));

    const cerut = (r.items || []).reduce((s, it) => s + (it.quantity || 0) * (it.unitPrice || 0), 0);
    const comandat = comenzile.reduce((s, c) => s + comandaValoare(c.items || []), 0);
    const facturat = facturi.reduce((s, i) => s + (i.amount || 0), 0);
    return { documente, comenzile, facturi, cerut, comandat, facturat };
  }, [foundationDocs, comenzi, invoices]);

  const filtrate = useMemo(() => {
    const q = curat(cauta);
    return [...referate]
      .filter(r => !q
        || curat(r.number).includes(q)
        || curat(r.subject).includes(q)
        || curat(r.department).includes(q)
        || (r.items || []).some(it => curat(it.name).includes(q)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [referate, cauta]);

  const { pageItems, page, pageSize, setPageSize, pageCount, goToPage, topRef } =
    usePagination(filtrate, 'meditrack_dosare_page_size');

  // ══════════════════ un dosar ══════════════════
  const referatDeschis = referate.find(r => r.id === deschis);
  if (referatDeschis) {
    const r = referatDeschis;
    const { documente, comenzile, facturi, cerut, comandat, facturat } = dosarul(r);
    const primit = comenzile.reduce((s, c) =>
      s + (c.items || []).reduce((t, it) => t + Math.min(it.received ?? 0, it.quantity || 0) * (it.unitPrice || 0), 0), 0);

    const etape = [
      { cheie: 'referat', titlu: 'Referat', cate: 1, icon: FileSignature },
      { cheie: 'df', titlu: 'Fundamentare', cate: documente.length, icon: FolderOpen },
      { cheie: 'comanda', titlu: 'Comanda', cate: comenzile.length, icon: ShoppingCart },
      { cheie: 'factura', titlu: 'Factura', cate: facturi.length, icon: Receipt },
    ];

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-xl border border-slate-100">
          <button onClick={() => setDeschis(null)}
            className="text-[11px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition mb-3">
            ← Inapoi la dosare
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight break-words">
              {r.subject || 'Achizitie'}
            </h2>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl shrink-0">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Referat</span>
              <span className="text-[15px] font-black font-mono">{r.number}</span>
            </span>
          </div>
          <p className="text-sm text-slate-500 font-bold mt-1">
            {r.date}{r.department ? ` · ${r.department}` : ''}{r.issuedBy ? ` · ${r.issuedBy}` : ''}
          </p>

          {/* ── unde a ajuns ── */}
          <div className="flex flex-wrap items-center gap-2 mt-6">
            {etape.map((e, i) => {
              const Icon = e.icon;
              const are = e.cate > 0;
              return (
                <React.Fragment key={e.cheie}>
                  <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border ${
                    are ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-[12px] font-black uppercase tracking-wide">{e.titlu}</span>
                    {e.cheie !== 'referat' && (
                      <span className={`text-[11px] font-black ${are ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {e.cate}
                      </span>
                    )}
                  </div>
                  {i < etape.length - 1 && <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── banii ── */}
        <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { et: 'Cerut prin referat', v: cerut, ton: 'bg-slate-50 text-slate-900' },
              { et: 'Comandat', v: comandat, ton: 'bg-indigo-50 text-indigo-700' },
              { et: 'Primit', v: primit, ton: 'bg-amber-50 text-amber-700' },
              { et: 'Facturat', v: facturat, ton: 'bg-blue-50 text-blue-700' },
            ].map(x => (
              <div key={x.et} className={`p-4 rounded-2xl ${x.ton.split(' ')[0]}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest ${x.ton.split(' ')[1]} opacity-70`}>{x.et}</p>
                <p className={`text-xl font-black tabular-nums mt-1 ${x.ton.split(' ')[1]}`}>{lei(x.v)}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-bold text-slate-500 mt-4 leading-relaxed">
            Valorile de pe referat si de pe comanda sunt fara TVA; facturile poarta suma cu TVA,
            asa cum vin. Nu se scad una din alta.
          </p>
        </div>

        {/* ── piesele ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Sectiune titlu={`Documente de fundamentare (${documente.length})`} gol="Niciun document de fundamentare legat de referatul acesta.">
            {documente.map(d => (
              <Rand key={d.id}
                sus={`${d.number || 'fara numar'}${d.revision ? ` · revizia ${d.revision}` : ''}`}
                jos={d.subject || d.shortDescription || d.type}
                dreapta={d.amount ? `${lei(d.amount)} lei` : ''} />
            ))}
          </Sectiune>

          <Sectiune titlu={`Comenzi (${comenzile.length})`} gol="Nicio comanda pe referatul acesta. Daca s-a emis una, verifica numarul de referat scris pe ea.">
            {comenzile.map(c => (
              <Rand key={c.id}
                sus={`Nr. com. ${c.number} · ${c.supplier || ''}`}
                jos={`${c.date} · ${COMANDA_STATUS_RO[normaliseComandaStatus(c.status)]}`}
                dreapta={`${lei(comandaValoare(c.items || []))} lei`} />
            ))}
          </Sectiune>

          <Sectiune titlu={`Facturi (${facturi.length})`} gol="Nicio factura sosita pe comenzile dosarului.">
            {facturi.map(i => (
              <Rand key={i.id}
                sus={`${i.invoiceNumber} · ${i.supplier || ''}`}
                jos={`${i.issueDate}${i.description ? ` · ${i.description}` : ''}`}
                dreapta={`${lei(i.amount || 0)} ${i.currency || 'RON'}`} />
            ))}
          </Sectiune>

          <Sectiune titlu={`Ce s-a cerut (${(r.items || []).length})`} gol="Referatul n-are pozitii trecute.">
            {(r.items || []).map(it => (
              <Rand key={it.id}
                sus={it.name}
                jos={`${it.quantity} ${it.unit} × ${lei(it.unitPrice)}`}
                dreapta={`${lei((it.quantity || 0) * (it.unitPrice || 0))} lei`} />
            ))}
          </Sectiune>
        </div>
      </div>
    );
  }

  // ══════════════════ lista ══════════════════
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={cauta} onChange={e => setCauta(e.target.value)}
            placeholder="Cauta dupa numar de referat, obiect, sectie sau articol..."
            aria-label="Cauta in dosare"
            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-xl text-[15px] font-semibold outline-none" />
        </div>
        <p className="text-[11px] font-bold text-slate-500 mt-3 leading-relaxed">
          Un dosar porneste de la un referat si aduna documentul de fundamentare, comanda si
          facturile care se leaga de el.
        </p>
      </div>

      <div ref={topRef} className="scroll-mt-4" />
      {filtrate.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[2.5rem] border-4 border-dashed border-slate-50 flex flex-col items-center">
          <FolderOpen className="w-16 h-16 text-slate-100 mb-4" />
          <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">
            {referate.length === 0 ? 'Niciun referat inregistrat' : 'Niciun dosar gasit'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pageItems.map(r => {
            const { documente, comenzile, facturi, cerut, facturat } = dosarul(r);
            const etape = [documente.length > 0, comenzile.length > 0, facturi.length > 0];
            const ajunse = etape.filter(Boolean).length;
            return (
              <button key={r.id} onClick={() => setDeschis(r.id)}
                aria-label={`Deschide dosarul referatului ${r.number}`}
                className="w-full text-left bg-white p-4 sm:p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl shrink-0">
                  <FileSignature className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[11px] font-black font-mono">{r.number}</span>
                    <span className="text-[15px] font-black text-slate-900 truncate">{r.subject || 'Achizitie'}</span>
                  </div>
                  <p className="text-[12px] font-bold text-slate-500 mt-1">
                    {r.date}{r.department ? ` · ${r.department}` : ''}
                    {' · '}
                    <span className={ajunse === 3 ? 'text-emerald-600' : ajunse === 0 ? 'text-slate-400' : 'text-amber-600'}>
                      {['fara fundamentare', 'fundamentare', 'comanda', 'factura'][ajunse]}
                      {ajunse === 3 ? ' — dosar complet' : ajunse === 0 ? '' : ' pana acum'}
                    </span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cerut / facturat</p>
                  <p className="text-[15px] font-black text-slate-900 tabular-nums">
                    {lei(cerut)} / {lei(facturat)}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 shrink-0 hidden sm:block" />
              </button>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <PageSizePicker value={pageSize} onChange={setPageSize} />
            <Pager page={page} pageCount={pageCount} pageSize={pageSize} total={filtrate.length} onGoTo={goToPage} />
          </div>
        </div>
      )}
    </div>
  );
};

const Sectiune: React.FC<{ titlu: string; gol: string; children: React.ReactNode }> = ({ titlu, gol, children }) => {
  const are = React.Children.count(children) > 0;
  return (
    <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">{titlu}</h3>
      {are ? <div className="space-y-2">{children}</div> : (
        <p className="text-[13px] font-bold text-slate-500 leading-relaxed flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" /> {gol}
        </p>
      )}
    </div>
  );
};

const Rand: React.FC<{ sus: string; jos: string; dreapta?: string }> = ({ sus, jos, dreapta }) => (
  <div className="flex items-start justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl">
    <div className="min-w-0">
      <p className="text-[14px] font-bold text-slate-900 break-words">{sus}</p>
      <p className="text-[11px] font-bold text-slate-500 mt-0.5 break-words">{jos}</p>
    </div>
    {dreapta && <p className="text-[14px] font-black text-slate-900 tabular-nums shrink-0">{dreapta}</p>}
  </div>
);

export default DosarAchizitie;
