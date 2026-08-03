import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Building2, Check, Plus, X } from 'lucide-react';
import Portal from './Portal';

/**
 * Choosing where a device lives.
 *
 * A plain <select> is fine for the fourteen departments the app ships with,
 * and useless once a hospital has added its wards, its rooms and its
 * consulting rooms: finding "Cabinet ORL 2" means scrolling a list of eighty
 * on a phone. This one filters as you type, matches without accents or
 * diacritics, and lets a section that does not exist yet be created on the
 * spot rather than sending someone to a settings screen first.
 */

interface DepartmentPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Every known department, in display order. */
  options: string[];
  /** How many devices sit in each one, shown as a hint. */
  counts?: Record<string, number>;
  label?: string;
  required?: boolean;
  /** Set false where inventing a department would be wrong, e.g. a filter. */
  allowCreate?: boolean;
  placeholder?: string;
}

/** "Secţia ATI" and "sectia ati" have to match each other. */
const normalise = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
   .replace(/ș|ş/g, 's').replace(/ț|ţ/g, 't').replace(/ă|â/g, 'a').replace(/î/g, 'i')
   .toLowerCase().trim();

const DepartmentPicker: React.FC<DepartmentPickerProps> = ({
  value,
  onChange,
  options,
  counts = {},
  label = 'Departament / Sectie',
  required,
  allowCreate = true,
  placeholder = 'Cauta sectia sau cabinetul...',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // The list is rendered through a Portal: inside the form card it was clipped
  // by the card's own rounded, overflow-hidden box and only two rows showed.
  const [pos, setPos] = useState<{ left: number; top: number; width: number; flip: boolean; maxList: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = normalise(query);
    if (!q) return options;
    // Whole-word prefix matches first: typing "ati" should not bury "ATI"
    // under "Radiologie — aparat ATI".
    const scored = options
      .map(o => {
        const n = normalise(o);
        if (n === q) return { o, rank: 0 };
        if (n.startsWith(q)) return { o, rank: 1 };
        if (n.split(/[\s/–-]+/).some(w => w.startsWith(q))) return { o, rank: 2 };
        if (n.includes(q)) return { o, rank: 3 };
        return null;
      })
      .filter(Boolean) as { o: string; rank: number }[];
    return scored.sort((a, b) => a.rank - b.rank || a.o.localeCompare(b.o)).map(s => s.o);
  }, [options, query]);

  const trimmed = query.trim();
  // Three characters minimum: a stray letter should not offer to create a
  // department called "o".
  const canCreate =
    allowCreate && trimmed.length >= 3 && !options.some(o => normalise(o) === normalise(trimmed));
  const rowCount = matches.length + (canCreate ? 1 : 0);

  useEffect(() => { setActive(0); }, [query]);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8, margin = 12;
    const below = window.innerHeight - r.bottom - gap - margin;
    const above = r.top - gap - margin;
    // Open upwards when there is more room there — on a phone the field is
    // often near the bottom of the form.
    const flip = below < 200 && above > below;
    // Roughly 62px goes to the search box; the rest is list. Capping it here
    // is what keeps the panel on screen instead of running off the bottom.
    const maxList = Math.max(120, (flip ? above : below) - 62);
    setPos({ left: r.left, top: flip ? r.top : r.bottom, width: r.width, flip, maxList });
  }, []);

  useEffect(() => {
    if (!open) { setPos(null); return; }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  // Close when the click lands elsewhere. The list is outside this element in
  // the DOM, so it needs checking too.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (boxRef.current?.contains(target)) return;
      if (listRef.current?.closest('[data-dept-list]')?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const commit = useCallback((next: string) => {
    onChange(next);
    setQuery('');
    setOpen(false);
  }, [onChange]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(rowCount - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (active < matches.length) commit(matches[active]);
      else if (canCreate) commit(trimmed);
    } else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  };

  return (
    <div className="space-y-1.5" ref={boxRef}>
      {label && (
        <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 ml-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label="Alege departamentul"
          aria-expanded={open}
          aria-haspopup="listbox"
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-left transition-colors hover:border-slate-300 focus:border-blue-500 outline-none"
        >
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          <span className={`flex-1 min-w-0 truncate text-[15px] font-semibold ${value ? 'text-slate-900' : 'text-slate-400'}`}>
            {value || 'Alege sectia sau cabinetul'}
          </span>
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        {open && pos && (
          <Portal>
          <div
            data-dept-list
            className="fixed z-[850] bg-white border-2 border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
            style={{
              left: pos.left,
              width: pos.width,
              ...(pos.flip
                ? { bottom: window.innerHeight - pos.top + 8 }
                : { top: pos.top + 8 }),
            }}
          >
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={placeholder}
                  className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-xl text-[15px] font-semibold outline-none"
                />
                {query && (
                  <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                    aria-label="Sterge cautarea"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div
              ref={listRef}
              data-dept-options
              className="overflow-y-auto overscroll-contain custom-scrollbar py-1"
              style={{ maxHeight: pos.maxList }}
            >
              {matches.map((opt, i) => (
                <button
                  key={opt}
                  type="button"
                  data-active={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(opt)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                    i === active ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className={`flex-1 min-w-0 truncate text-[15px] font-semibold ${opt === value ? 'text-blue-700' : 'text-slate-800'}`}>
                    {opt}
                  </span>
                  {counts[opt] > 0 && (
                    <span className="text-[11px] font-bold text-slate-400 shrink-0">
                      {counts[opt]} {counts[opt] === 1 ? 'aparat' : 'aparate'}
                    </span>
                  )}
                  {opt === value && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                </button>
              ))}

              {canCreate && (
                <button
                  type="button"
                  data-active={active === matches.length}
                  onMouseEnter={() => setActive(matches.length)}
                  onClick={() => commit(trimmed)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-t border-slate-100 transition ${
                    active === matches.length ? 'bg-emerald-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <Plus className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-[15px] font-semibold text-emerald-700">
                    Adauga „{trimmed}"
                  </span>
                </button>
              )}

              {matches.length === 0 && !canCreate && (
                <p className="px-4 py-6 text-center text-sm font-semibold text-slate-400">
                  Nicio sectie gasita
                </p>
              )}
            </div>
          </div>
          </Portal>
        )}
      </div>
    </div>
  );
};

export default DepartmentPicker;
