import React from 'react';
import { X } from 'lucide-react';

/**
 * Un camp de scris cu ce s-a mai scris in el dedesubt, ca sa se aleaga.
 *
 * Nu e o lista derulanta: optiunile stau la vedere, sub camp, si se ajunge la
 * ele dintr-o apasare. Sunt putine — un birou, un sef, o mana de articole
 * bugetare — si atunci lista inchisa ar ascunde tocmai raspunsul, si ar cere
 * doua apasari pentru el. Cel ales se vede negru; a doua apasare pe el il
 * scoate, daca omul vrea sa scrie altceva.
 *
 * Campul ramane de scris. Cand vine un articol bugetar nou sau alt sef, se
 * scrie ca pana acum, si de la salvare inainte apare si el in lista.
 */

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Ce se ofera la alegere, primul fiind cel mai proaspat. */
  optiuni: string[];
  /** Scoate o optiune din lista. Lipseste cand lista nu se schimba de aici. */
  onUita?: (v: string) => void;
  /** Pentru cititorul de ecran: al cui e campul. */
  eticheta: string;
  placeholder?: string;
  required?: boolean;
}

const CampAles: React.FC<Props> = ({ value, onChange, optiuni, onUita, eticheta, placeholder, required }) => {
  const ales = (o: string) => o.trim().toLowerCase() === (value || '').trim().toLowerCase();

  return (
    <>
      <input
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={eticheta}
        className="camp"
      />
      {optiuni.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {optiuni.map(o => (
            <span key={o}
              className={`inline-flex items-center rounded-lg border-2 transition ${
                ales(o)
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
              }`}>
              <button type="button"
                onClick={() => onChange(ales(o) ? '' : o)}
                aria-pressed={ales(o)}
                className="px-2.5 py-1 text-[11px] font-bold">
                {o}
              </button>
              {onUita && (
                <button type="button"
                  onClick={() => onUita(o)}
                  aria-label={`Scoate ${o} din lista`}
                  title="Scoate din lista"
                  className={`pr-2 pl-0.5 py-1 ${ales(o) ? 'text-white/60 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </>
  );
};

export default CampAles;
