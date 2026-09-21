import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';

/**
 * O data scrisa asa cum se scrie la noi: zi, luna, an.
 *
 * Campul de data al browserului isi ia forma din limba sistemului, nu din
 * limba paginii — iar pe un Windows pus pe engleza scrie "MM/DD/YYYY" si
 * asteapta luna prima. Pe un buletin de verificare care tine pana la 03.11.2026
 * asta nu e o neplacere de forma: 03.11 si 11.03 sunt amandoua date adevarate,
 * si greseala nu se vede nicaieri dupa aceea. Atributul lang nu ajuta, am
 * incercat; Chromium il ignora.
 *
 * Asa ca se scrie aici: o caseta de text care arata "zz.ll.aaaa", pune punctele
 * singura pe masura ce se tasteaza, si tine langa ea calendarul browserului
 * pentru cine prefera sa arate cu degetul. Inauntru, valoarea ramane cea
 * obisnuita, "2026-11-03", ca peste tot in aplicatie.
 */

const cifre = (s: string) => (s || '').replace(/\D/g, '');

/** "2026-11-03" → "03.11.2026". Ce nu e o data intreaga se intoarce cum a venit. */
export const laRomana = (iso: string): string => {
  const p = (iso || '').split('-');
  return p.length === 3 && p[0].length === 4 ? `${p[2]}.${p[1]}.${p[0]}` : '';
};

/**
 * "03.11.2026" → "2026-11-03", si '' daca nu e o zi adevarata.
 *
 * Se verifica ziua, nu doar cifrele: 31.02 se scrie la fel de usor ca 31.01, si
 * browserul ar inghiti-o mutand-o tacut in martie.
 */
export const dinRomana = (text: string): string => {
  const c = cifre(text);
  if (c.length !== 8) return '';
  const zi = +c.slice(0, 2), luna = +c.slice(2, 4), an = +c.slice(4);
  if (!zi || !luna || luna > 12 || an < 1900) return '';
  const d = new Date(Date.UTC(an, luna - 1, zi));
  if (d.getUTCDate() !== zi || d.getUTCMonth() !== luna - 1) return '';
  return `${String(an).padStart(4, '0')}-${String(luna).padStart(2, '0')}-${String(zi).padStart(2, '0')}`;
};

/** Pune punctele pe masura ce se tasteaza, fara sa incurce stersul. */
const cuPuncte = (brut: string): string => {
  const c = cifre(brut).slice(0, 8);
  if (c.length <= 2) return c;
  if (c.length <= 4) return `${c.slice(0, 2)}.${c.slice(2)}`;
  return `${c.slice(0, 2)}.${c.slice(2, 4)}.${c.slice(4)}`;
};

interface Props {
  /** Valoarea, in forma obisnuita: "2026-11-03" sau gol. */
  value: string;
  onChange: (iso: string) => void;
  eticheta: string;
  id?: string;
  autoFocus?: boolean;
  className?: string;
  /** Cand pleaca cu totul de pe camp — nu si cand trece la calendarul lui. */
  onIesire?: () => void;
}

const CampData: React.FC<Props> = ({
  value, onChange, eticheta, id, autoFocus, className = '', onIesire,
}) => {
  const [text, setText] = useState(() => laRomana(value));
  const invelis = useRef<HTMLDivElement>(null);
  const calendar = useRef<HTMLInputElement>(null);

  // Cand data vine din alta parte — aleasa din calendar, pusa de aplicatie.
  useEffect(() => { setText(laRomana(value)); }, [value]);

  const scrie = (brut: string) => {
    const t = cuPuncte(brut);
    setText(t);
    const iso = dinRomana(t);
    if (iso) onChange(iso);
    else if (!cifre(t)) onChange('');
  };

  /*
   * La plecare, ce a ramas pe jumatate scris se intoarce la ce e salvat. Altfel
   * casuta ar arata "03.11.20" peste o data care in evidenta e intreaga, si
   * omul ar crede ca asa s-a salvat.
   */
  const plec = (e: React.FocusEvent) => {
    if (invelis.current?.contains(e.relatedTarget as Node)) return;
    setText(laRomana(value));
    onIesire?.();
  };

  const deschideCalendarul = () => {
    const c = calendar.current as any;
    if (!c) return;
    // showPicker nu merge in orice imprejurare — fara gest, in cadru strain.
    // Cand nu merge, casuta ramane de scris, si asta e oricum drumul mai scurt.
    try { c.showPicker(); } catch { c.focus(); }
  };

  return (
    <div ref={invelis} className="relative" onBlur={plec}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={e => scrie(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
        placeholder="zz.ll.aaaa"
        aria-label={eticheta}
        className={className}
        style={{ paddingRight: '2.25rem' }}
      />
      <button
        type="button"
        onClick={deschideCalendarul}
        tabIndex={-1}
        aria-label={`Alege din calendar: ${eticheta}`}
        title="Alege din calendar"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 transition"
      >
        <CalendarDays className="w-4 h-4" />
      </button>
      {/*
        Calendarul browserului, tinut deoparte: forma lui e a sistemului, dar
        ce alege omul din el intra tot prin casuta de mai sus.
      */}
      <input
        ref={calendar}
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute right-2 bottom-0 w-0 h-0 opacity-0 pointer-events-none"
      />
      {/* autoFocus pe camp, nu pe invelis */}
      {autoFocus && <AutoFocus tinta={invelis} />}
    </div>
  );
};

/** Muta cursorul in casuta la deschidere, fara ca ea sa fie recreata. */
const AutoFocus: React.FC<{ tinta: React.RefObject<HTMLDivElement> }> = ({ tinta }) => {
  useEffect(() => { tinta.current?.querySelector('input')?.focus(); }, [tinta]);
  return null;
};

export default CampData;
