import React, { useMemo, useState } from 'react';
import { Building2, ArrowRight, CheckCircle, Info, Loader2, Merge } from 'lucide-react';
import { MedicalDevice, MedicalTask } from '../types';
import { sectiiDeUnit, cheieSectie } from '../services/sectii';
import ConfirmDialog from './ConfirmDialog';

/**
 * Unirea sectiilor scrise in mai multe feluri.
 *
 * Aceeasi sectie ajunge in aplicatie sub cateva nume — una cu diacritice si una
 * fara, una prescurtata, una venita dintr-un import cu numele din registrul
 * contabil. Pe ecran par sectii diferite: Panoul le numara de doua ori, filtrul
 * le arata separat, si aparatele unei sectii sunt imprastiate intre ele.
 *
 * Aplicatia gaseste singura perechile, dar nu le uneste singura: numele seamana
 * nu inseamna intotdeauna aceeasi usa, iar "Chirurgie 1" si "Chirurgie 2" chiar
 * sunt doua sectii. Se propune, omul confirma.
 */

interface Props {
  devices: MedicalDevice[];
  tasks: MedicalTask[];
  /** Muta aparatele si tichetele de la numele vechi la cel pastrat. */
  onUneste: (dela: string[], la: string) => Promise<void> | void;
  canEdit: boolean;
}

const UnesteSectii: React.FC<Props> = ({ devices, tasks, onUneste, canEdit }) => {
  const grupuri = useMemo(() => sectiiDeUnit(devices, tasks), [devices, tasks]);
  /** Ce forma se pastreaza pentru fiecare grup, cand omul alege alta. */
  const [alese, setAlese] = useState<Record<string, string>>({});
  const [deUnit, setDeUnit] = useState<{ cheie: string; dela: string[]; la: string; cate: number } | null>(null);
  const [lucrez, setLucrez] = useState(false);

  /* ── unirea de mana, pentru sectii care nu seamana la nume ── */
  const toateSectiile = useMemo(() => {
    const s = new Set<string>();
    devices.forEach(d => { if (d.department?.trim()) s.add(d.department.trim()); });
    tasks.forEach(t => { if (t.department?.trim()) s.add(t.department.trim()); });
    return [...s].sort((a, b) => a.localeCompare(b, 'ro'));
  }, [devices, tasks]);
  const [dela, setDela] = useState('');
  const [la, setLa] = useState('');

  const cate = (nume: string) =>
    devices.filter(d => d.department?.trim() === nume).length
    + tasks.filter(t => t.department?.trim() === nume).length;

  const confirma = async () => {
    if (!deUnit) return;
    setLucrez(true);
    try { await onUneste(deUnit.dela, deUnit.la); } finally { setLucrez(false); setDeUnit(null); }
  };

  return (
    <div className="bg-white p-6 sm:p-10 rounded-[2rem] shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 sm:gap-5 mb-6">
        <div className="p-3 sm:p-5 bg-indigo-100 text-indigo-600 rounded-2xl sm:rounded-3xl shrink-0">
          <Building2 className="w-7 h-7 sm:w-10 sm:h-10" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Sectii care se repeta</h2>
          <p className="text-[12px] sm:text-sm text-slate-500 font-semibold mt-1">
            Aceeasi sectie scrisa in mai multe feluri, adusa la una singura
          </p>
        </div>
      </div>

      {grupuri.length === 0 ? (
        <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-emerald-800 leading-relaxed">
            Nicio sectie nu se repeta. {toateSectiile.length} sectii, fiecare cu un singur nume.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[13px] font-semibold text-amber-900 leading-relaxed">
              <span className="font-black">{grupuri.length}</span> {grupuri.length === 1 ? 'sectie apare' : 'sectii apar'} sub mai multe nume.
              Alege forma care ramane si apasa "Uneste" — aparatele si tichetele se muta pe ea.
              Verifica-le pe fiecare: "Chirurgie 1" si "Chirurgie 2" seamana, dar sunt doua sectii.
            </p>
          </div>

          {grupuri.map(g => {
            const pastrat = alese[g.cheie] || g.propus;
            const deMutat = g.feluri.filter(f => f.nume !== pastrat);
            const cateSeMuta = deMutat.reduce((s, f) => s + f.aparate + f.tichete, 0);
            return (
              <div key={g.cheie} className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-wrap gap-2">
                  {g.feluri.map(f => {
                    const eCelPastrat = f.nume === pastrat;
                    return (
                      <button
                        key={f.nume}
                        onClick={() => setAlese(p => ({ ...p, [g.cheie]: f.nume }))}
                        disabled={!canEdit}
                        title={eCelPastrat ? 'Numele care ramane' : 'Apasa ca sa pastrezi acest nume'}
                        className={`px-3.5 py-2.5 rounded-xl text-[12px] font-bold transition border-2 text-left disabled:cursor-not-allowed ${
                          eCelPastrat
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="block">{f.nume}</span>
                        <span className={`block text-[10px] font-black uppercase tracking-wide mt-0.5 ${eCelPastrat ? 'text-white/70' : 'text-slate-400'}`}>
                          {f.aparate} aparate{f.tichete ? ` · ${f.tichete} tichete` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[12px] font-bold text-slate-500 flex items-center gap-2 min-w-0">
                    <ArrowRight className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="truncate">
                      {cateSeMuta} {cateSeMuta === 1 ? 'inregistrare se muta' : 'inregistrari se muta'} pe
                      <span className="text-slate-900 font-black"> {pastrat}</span>
                    </span>
                  </p>
                  <button
                    onClick={() => setDeUnit({ cheie: g.cheie, dela: deMutat.map(f => f.nume), la: pastrat, cate: cateSeMuta })}
                    disabled={!canEdit || cateSeMuta === 0}
                    className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                  >
                    <Merge className="w-4 h-4" /> Uneste
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── unirea de mana ── */}
      <div className="mt-6 pt-6 border-t border-slate-100">
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">
          Uneste doua sectii care nu seamana la nume
        </p>
        <p className="text-[12px] font-semibold text-slate-500 mb-3 leading-relaxed">
          Pentru cazurile pe care aplicatia n-are cum sa le ghiceasca — "UTS Judetean" si
          "Unitate de transfuzie", de pilda, cand numele vine din registrul contabil.
        </p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <label className="flex-1 min-w-0 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1">Se muta de la</span>
            <select value={dela} onChange={e => setDela(e.target.value)} disabled={!canEdit}
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500">
              <option value="">— alege sectia —</option>
              {toateSectiile.map(s => <option key={s} value={s}>{s} ({cate(s)})</option>)}
            </select>
          </label>
          <ArrowRight className="w-5 h-5 text-slate-300 shrink-0 hidden sm:block mb-3.5" />
          <label className="flex-1 min-w-0 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1">Ramane</span>
            <select value={la} onChange={e => setLa(e.target.value)} disabled={!canEdit}
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500">
              <option value="">— alege sectia —</option>
              {toateSectiile.map(s => <option key={s} value={s}>{s} ({cate(s)})</option>)}
            </select>
          </label>
          <button
            onClick={() => setDeUnit({ cheie: 'manual', dela: [dela], la, cate: cate(dela) })}
            disabled={!canEdit || !dela || !la || dela === la}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
          >
            <Merge className="w-4 h-4" /> Uneste
          </button>
        </div>
        {dela && la && dela !== la && cheieSectie(dela) !== cheieSectie(la) && (
          <p className="text-[12px] font-bold text-amber-700 mt-3 leading-relaxed">
            Numele astea doua nu seamana deloc. Sigur e aceeasi sectie?
          </p>
        )}
      </div>

      <ConfirmDialog
        open={!!deUnit}
        tone="neutral"
        title="Unesti sectiile?"
        icon={lucrez ? <Loader2 className="w-8 h-8 animate-spin" /> : <Merge className="w-8 h-8" />}
        body={<>
          <span className="font-black text-slate-900">{deUnit?.cate}</span>{' '}
          {deUnit?.cate === 1 ? 'inregistrare se muta' : 'inregistrari se muta'} de pe{' '}
          {deUnit?.dela.map(d => <span key={d} className="font-black text-slate-900">"{d}" </span>)}
          pe <span className="font-black text-slate-900">"{deUnit?.la}"</span>.
          Aparatele raman aceleasi, li se schimba doar sectia — si se poate face la loc de aici,
          unind inapoi.
        </>}
        confirmLabel={lucrez ? 'Se muta...' : 'Uneste'}
        cancelLabel="Renunt"
        onCancel={() => setDeUnit(null)}
        onConfirm={confirma}
      />
    </div>
  );
};

export default UnesteSectii;
