import React, { useRef, useState } from 'react';
import { Plus, Trash2, Camera, Package, Loader2, X } from 'lucide-react';
import { Consumable } from '../types';
import { micsoreaza } from '../services/poze';
import Poza, { pozaConsumabilului } from './Poza';

/**
 * Consumabilele de care are nevoie un aparat.
 *
 * Cand se strica ceva la trei noaptea, intrebarea nu e "ce aparat e", e "ce
 * senzor ii trebuie". Informatia asta nu statea nicaieri in evidenta: era in
 * capul omului care lucreaza de zece ani pe sectia aia, pe o eticheta lipita pe
 * carcasa, sau in manualul din sertar. Cand el e in concediu, se comanda gresit
 * — iar o manseta nepotrivita se intoarce dupa doua saptamani.
 *
 * Poza conteaza mai mult decat numele, si de asta sta in dreptul fiecaruia. Un
 * cod de catalog se citeste gresit de pe o eticheta uzata, iar "set linii
 * pacient" inseamna patru lucruri diferite la patru producatori. O poza se
 * recunoaste de la un metru, si cu ea pe telefon se poate compara cu ce e in
 * magazie.
 */

const camp = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors';

export const consumabilNou = (): Consumable => ({
  id: crypto.randomUUID(), name: '', code: '', manufacturer: '', unit: '', notes: '',
});

interface EditorProps {
  valoare: Consumable[];
  onChange: (c: Consumable[]) => void;
}

export const ConsumabileEditor: React.FC<EditorProps> = ({ valoare, onChange }) => {
  const schimba = (id: string, cheie: keyof Consumable, v: string) =>
    onChange(valoare.map(x => x.id === id ? { ...x, [cheie]: v } : x));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="tech-label block">
          Consumabile{valoare.length > 0 && <span className="text-blue-600"> · {valoare.length}</span>}
        </label>
        <button type="button" onClick={() => onChange([...valoare, consumabilNou()])}
          className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-[11px] font-black uppercase tracking-wide hover:bg-slate-200 transition flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" /> Adauga consumabil
        </button>
      </div>

      {valoare.length === 0 ? (
        <p className="text-[13px] font-semibold text-slate-500 leading-relaxed bg-slate-50 border border-slate-100 rounded-2xl p-4">
          Ce consuma aparatul: senzori, mansete, electrozi, filtre, linii, hartie. Trece-le aici,
          fiecare cu poza si cu codul de catalog, ca sa se poata comanda fara sa fie nevoie de
          cineva care stie aparatul pe de rost.
        </p>
      ) : (
        <div className="space-y-3">
          {valoare.map((c, i) => (
            <RandEditor key={c.id} c={c} i={i}
              onCamp={(cheie, v) => schimba(c.id, cheie, v)}
              onPoza={(url) => onChange(valoare.map(x => x.id === c.id ? { ...x, photoUrl: url, photoPath: url ? x.photoPath : '' } : x))}
              onSterge={() => onChange(valoare.filter(x => x.id !== c.id))} />
          ))}
        </div>
      )}
    </div>
  );
};

const RandEditor: React.FC<{
  c: Consumable;
  i: number;
  onCamp: (cheie: keyof Consumable, v: string) => void;
  onPoza: (dataUrl: string) => void;
  onSterge: () => void;
}> = ({ c, i, onCamp, onPoza, onSterge }) => {
  const input = useRef<HTMLInputElement>(null);
  const [lucrez, setLucrez] = useState(false);
  const [rau, setRau] = useState<string | null>(null);

  const alege = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    /* Campul se goleste imediat: altfel aceeasi poza aleasa a doua oara, dupa
       ce a fost scoasa, nu mai declanseaza nimic. */
    e.target.value = '';
    if (!f) return;
    setLucrez(true);
    setRau(null);
    try {
      onPoza(await micsoreaza(f));
    } catch (err: any) {
      setRau(err?.message || 'Poza nu a putut fi prelucrata.');
    } finally {
      setLucrez(false);
    }
  };

  const arePoza = !!(c.photoPath || c.photoUrl);

  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">
          Consumabilul {i + 1}
        </span>
        <button type="button" onClick={onSterge}
          title="Scoate consumabilul" aria-label={`Scoate consumabilul ${i + 1}`}
          className="p-1.5 text-slate-500 hover:text-red-600 transition">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Poza sta prima, si e singurul camp cu suprafata mare: ea e cea dupa
            care se recunoaste piesa, nu randul de text de langa. */}
        <div className="shrink-0">
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={alege}
            aria-label={`Poza consumabilului ${i + 1}`} />
          <button type="button" onClick={() => input.current?.click()} disabled={lucrez}
            className="relative w-full sm:w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 bg-white overflow-hidden flex items-center justify-center hover:border-blue-400 transition group">
            {lucrez ? <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              : arePoza ? (
                <Poza sursa={pozaConsumabilului(c)} alt={c.name || 'Consumabil'}
                  className="w-full h-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-slate-400 group-hover:text-blue-500">
                  <Camera className="w-6 h-6" />
                  <span className="text-[10px] font-black uppercase tracking-wide">Pune poza</span>
                </span>
              )}
          </button>
          {arePoza && (
            <button type="button" onClick={() => onPoza('')}
              className="mt-1.5 w-full sm:w-28 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500 hover:text-red-600 transition flex items-center justify-center gap-1">
              <X className="w-3 h-3" /> Scoate poza
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1 sm:col-span-2">
            <label className="tech-label ml-1">Denumire</label>
            <input value={c.name} onChange={e => onCamp('name', e.target.value)}
              placeholder="ex. Senzor SpO2 adult, reutilizabil" className={camp} />
          </div>
          <div className="space-y-1">
            <label className="tech-label ml-1">Cod de catalog</label>
            <input value={c.code || ''} onChange={e => onCamp('code', e.target.value)}
              placeholder="dupa el se comanda" className={camp} />
          </div>
          <div className="space-y-1">
            <label className="tech-label ml-1">Producator</label>
            <input value={c.manufacturer || ''} onChange={e => onCamp('manufacturer', e.target.value)} className={camp} />
          </div>
          <div className="space-y-1">
            <label className="tech-label ml-1">Unitatea</label>
            <input value={c.unit || ''} onChange={e => onCamp('unit', e.target.value)}
              placeholder="bucata, set, cutie de 50" className={camp} />
          </div>
          <div className="space-y-1">
            <label className="tech-label ml-1">Observatii</label>
            <input value={c.notes || ''} onChange={e => onCamp('notes', e.target.value)}
              placeholder="cat tine, de unde s-a luat" className={camp} />
          </div>
        </div>
      </div>

      {rau && <p className="text-[11px] font-bold text-red-600">{rau}</p>}
    </div>
  );
};

/**
 * Aceleasi consumabile, doar de citit.
 *
 * Cartonase, nu randuri de tabel: poza trebuie sa aiba suprafata ca sa fie de
 * folos, iar pe telefon un tabel cu cinci coloane s-ar taia tocmai la codul de
 * catalog, adica la singurul lucru care se copiaza in comanda.
 */
export const ConsumabileLista: React.FC<{ consumabile: Consumable[] }> = ({ consumabile }) => {
  if (!consumabile.length) {
    return (
      <p className="text-[13px] font-semibold text-slate-500 leading-relaxed bg-slate-50 border border-slate-100 rounded-2xl p-4">
        Niciun consumabil trecut. Din "Editeaza" se pot adauga, fiecare cu poza si cu codul lui.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {consumabile.map(c => (
        <div key={c.id} className="flex gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center">
            <Poza sursa={pozaConsumabilului(c)} alt={c.name || 'Consumabil'}
              className="w-full h-full object-cover"
              gol={<Package className="w-7 h-7 text-slate-300" />} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-black text-slate-900 leading-snug break-words">
              {c.name || 'Fara denumire'}
            </p>
            {c.code && (
              <p className="text-[12px] font-bold text-blue-700 font-mono mt-0.5 break-all">{c.code}</p>
            )}
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              {[c.manufacturer, c.unit].filter(Boolean).join(' · ')}
            </p>
            {c.notes && (
              <p className="text-[11px] font-semibold text-slate-500 mt-1 leading-snug break-words">{c.notes}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
