import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Paging, shared by the inventory, the tickets and the invoices.
 *
 * All three render every row they hold, which is fine at fifty and painful at
 * two thousand. The third copy of this was the point at which it stopped being
 * worth writing again.
 */

export const PAGE_SIZES = [10, 20, 50, 100];

/** Page numbers to show: always first and last, plus a window around the current one. */
const pageWindow = (page: number, pageCount: number): (number | '…')[] => {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const around = [page - 1, page, page + 1].filter(n => n > 1 && n < pageCount);
  const out: (number | '…')[] = [1];
  if (around[0] > 2) out.push('…');
  out.push(...around);
  if (around[around.length - 1] < pageCount - 1) out.push('…');
  out.push(pageCount);
  return out;
};

/**
 * Keeps the page in range as filters narrow the list, and remembers the chosen
 * size per screen — someone who wants ten invoices at a time rarely wants a
 * hundred devices.
 */
export const usePagination = <T,>(items: T[], storageKey: string) => {
  const [pageSize, setPageSizeState] = useState<number>(() => {
    const stored = Number(localStorage.getItem(storageKey));
    return PAGE_SIZES.includes(stored) ? stored : 20;
  });
  const [page, setPage] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  // A narrowed filter can leave the current page past the end of the results
  useEffect(() => {
    setPage(p => Math.min(p, Math.max(1, Math.ceil(items.length / pageSize))));
  }, [items.length, pageSize]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
    try { localStorage.setItem(storageKey, String(size)); } catch { /* ignore */ }
  }, [storageKey]);

  // Jumping pages without this leaves you halfway down the previous page
  const goToPage = useCallback((next: number) => {
    setPage(next);
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  return { page, setPage, pageSize, setPageSize, pageCount, pageItems, goToPage, topRef };
};

/** The "N per page" control, for a toolbar. */
export const PageSizePicker: React.FC<{ value: number; onChange: (n: number) => void }> = ({ value, onChange }) => (
  <label className="flex items-center gap-2">
    <span className="text-[13px] font-medium text-slate-500">Pe pagina</span>
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg text-[13px] font-semibold text-slate-700 outline-none cursor-pointer"
      title="Cate randuri se afiseaza pe o pagina"
    >
      {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
    </select>
  </label>
);

const Pager = React.memo(({ page, pageCount, pageSize, total, onGoTo, onPageSize }: {
  page: number; pageCount: number; pageSize: number; total: number; onGoTo: (p: number) => void;
  /** Cate randuri pe pagina. Statea sus, in bara de unelte, unde imbulzea
      cautarea si butoanele; locul lui e langa numaratoare. */
  onPageSize?: (n: number) => void;
}) => {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  /* Cu o singura pagina nu e nimic de rasfoit: raman doua cuvinte, nu o cartela
     alba cat randul, goala pe trei sferturi. */
  const singura = pageCount <= 1;
  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 ${
      singura ? 'px-2 py-1' : 'hardware-card rounded-3xl px-4 py-3.5 sm:px-6'
    }`}>
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-medium text-slate-500 text-center sm:text-left">
          {from}–{to} din {total}{pageCount > 1 ? ` · pagina ${page} / ${pageCount}` : ''}
        </span>
        {onPageSize && total > 10 && <PageSizePicker value={pageSize} onChange={onPageSize} />}
      </div>
      {pageCount > 1 && (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => onGoTo(page - 1)}
            disabled={page === 1}
            aria-label="Pagina anterioara"
            className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:text-white hover:bg-slate-900 hover:border-slate-900 transition active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
            title="Pagina anterioara"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {pageWindow(page, pageCount).map((n, i) =>
            n === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-slate-500 font-black">…</span>
            ) : (
              <button
                key={n}
                onClick={() => onGoTo(n)}
                className={`min-w-[2.5rem] px-2 py-2.5 rounded-xl text-[13px] font-bold transition active:scale-90 ${
 n === page
                    ? 'bg-blue-600 border border-blue-600 text-white shadow-sm shadow-blue-600/20'
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                {n}
              </button>
            )
          )}
          <button
            onClick={() => onGoTo(page + 1)}
            disabled={page === pageCount}
            aria-label="Pagina urmatoare"
            className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:text-white hover:bg-slate-900 hover:border-slate-900 transition active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
            title="Pagina urmatoare"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
});

export default Pager;
