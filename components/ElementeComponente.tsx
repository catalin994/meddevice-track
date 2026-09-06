import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { DeviceComponent, DeviceStatus, DEVICE_STATUS_RO } from '../types';

/**
 * Elementele din care e facut un aparat care sta pe o singura pozitie.
 *
 * Sunt aparate care in registrul de mijloace fixe au un singur numar, dar pe
 * teren sunt doua obiecte: un aparat de radiologie cu generatorul si masa lui,
 * un turn de endoscopie, un sterilizator cu generatorul de abur, un ecograf cu
 * imprimanta. Fiecare parte are seria si modelul ei — si tocmai seria e ceruta
 * cand se cheama service-ul — dar pozitia contabila e una singura.
 *
 * Pana acum trebuia ales intre a le trece ca doua aparate, adica doua numere de
 * inventar, ceea ce nu e adevarat si strica numaratoarea, si a scrie a doua
 * serie intr-o nota, de unde n-o gaseste nimeni.
 *
 * Sta in doua locuri — la adaugarea unui aparat si in fisa lui — fiindca un
 * aparat din doua bucati se introduce dintr-o data, nu se creeaza intai si se
 * completeaza dupa.
 */

interface Props {
  valoare: DeviceComponent[];
  onChange: (elemente: DeviceComponent[]) => void;
}

const camp = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors';

export const ElementeEditor: React.FC<Props> = ({ valoare, onChange }) => {
  const schimba = (id: string, cheie: keyof DeviceComponent, v: string) =>
    onChange(valoare.map(x => x.id === id ? { ...x, [cheie]: v } : x));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="tech-label block">Elemente componente</label>
        <button
          type="button"
          onClick={() => onChange([...valoare, {
            id: crypto.randomUUID(), name: '', serialNumber: '', manufacturer: '',
            model: '', status: DeviceStatus.ACTIVE,
          }])}
          className="px-3.5 py-2 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-wide hover:bg-black transition active:scale-95 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Adauga element
        </button>
      </div>

      {valoare.length === 0 ? (
        <p className="text-[13px] font-semibold text-slate-500 leading-relaxed bg-slate-50 border border-slate-100 rounded-2xl p-4">
          Aparatul e dintr-o singura bucata. Daca sta pe o pozitie de inventar dar e format
          din doua sau mai multe obiecte — generator si masa, turn si monitor — adauga-le
          aici, fiecare cu seria lui.
        </p>
      ) : (
        <div className="space-y-3">
          {valoare.map((c, i) => (
            <div key={c.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Elementul {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(valoare.filter(x => x.id !== c.id))}
                  title="Scoate elementul"
                  aria-label={`Scoate elementul ${i + 1}`}
                  className="p-1.5 text-slate-500 hover:text-red-600 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="tech-label ml-1">Denumire</label>
                  <input value={c.name} onChange={e => schimba(c.id, 'name', e.target.value)}
                    placeholder="ex. Generator de raze X" className={camp} />
                </div>
                <div className="space-y-1">
                  <label className="tech-label ml-1">Numar serie</label>
                  <input value={c.serialNumber || ''} onChange={e => schimba(c.id, 'serialNumber', e.target.value)}
                    placeholder="daca e trecuta pe placuta" className={camp} />
                </div>
                <div className="space-y-1">
                  <label className="tech-label ml-1">Stare</label>
                  <select value={c.status} onChange={e => schimba(c.id, 'status', e.target.value)} className={camp}>
                    {Object.values(DeviceStatus).map(st => <option key={st} value={st}>{DEVICE_STATUS_RO[st]}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="tech-label ml-1">Producator</label>
                  <input value={c.manufacturer || ''} onChange={e => schimba(c.id, 'manufacturer', e.target.value)} className={camp} />
                </div>
                <div className="space-y-1">
                  <label className="tech-label ml-1">Model</label>
                  <input value={c.model || ''} onChange={e => schimba(c.id, 'model', e.target.value)} className={camp} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="tech-label ml-1">Observatii</label>
                  <input value={c.notes || ''} onChange={e => schimba(c.id, 'notes', e.target.value)}
                    placeholder="ce e de stiut despre partea asta" className={camp} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** Aceleasi elemente, doar de citit. */
export const ElementeLista: React.FC<{ elemente: DeviceComponent[] }> = ({ elemente }) => {
  if (elemente.length === 0) {
    return <p className="text-[13px] font-semibold text-slate-500">Aparatul e dintr-o singura bucata.</p>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {elemente.map((c, i) => (
        <div key={c.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] font-bold text-slate-900 leading-snug break-words">
              {c.name || `Elementul ${i + 1}`}
            </p>
            {/* Starea se scrie doar cand nu e cea obisnuita: un "Functional" pe
                fiecare cartonas ar ascunde tocmai partea care nu merge. */}
            {c.status && c.status !== DeviceStatus.ACTIVE && (
              <span className="shrink-0 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-[10px] font-black uppercase tracking-wide">
                {DEVICE_STATUS_RO[c.status] || c.status}
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            {[c.manufacturer, c.model].filter(Boolean).join(' · ') || 'Producator si model netrecute'}
          </p>
          <p className="text-[11px] font-bold text-slate-600 mt-1.5 font-mono break-all">
            {c.serialNumber ? `SN ${c.serialNumber}` : 'Fara serie'}
          </p>
          {c.notes && <p className="text-[11px] font-medium text-slate-500 mt-1.5 leading-relaxed">{c.notes}</p>}
        </div>
      ))}
    </div>
  );
};
