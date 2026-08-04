import React, { useCallback, useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Portal from './Portal';

/**
 * The dialog that stands between a tap and something that cannot be undone.
 *
 * The inventory list used to delete a device the moment the bin was tapped —
 * one row of a hospital's register gone, on a phone, with the button a
 * thumb's width from the card you tap to open it. The detail page already
 * asked first; the list didn't, and the same action behaving two ways is
 * worse than either.
 *
 * Cancel takes the focus rather than confirm, so a stray Enter or a
 * double-tap that lands on the new dialog backs out instead of going through
 * with it. Escape and the backdrop do the same.
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What exactly is about to happen, named. */
  body: React.ReactNode;
  confirmLabel?: string;
  busyLabel?: string;
  cancelLabel?: string;
  icon?: React.ReactNode;
  /** Destructive by default — that is what this dialog exists for. */
  tone?: 'danger' | 'neutral';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, title, body,
  confirmLabel = 'Sterge definitiv',
  busyLabel = 'Se sterge...',
  cancelLabel = 'Anuleaza',
  icon,
  tone = 'danger',
  busy = false,
  onConfirm, onCancel,
}) => {
  // A callback ref, not an effect: Portal renders nothing on its first pass,
  // so an effect fires while the button still does not exist and the focus
  // silently stays on whatever bin was just tapped.
  const takeFocus = useCallback((el: HTMLButtonElement | null) => { el?.focus(); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) { e.preventDefault(); onCancel(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const danger = tone === 'danger';

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[600] scrim flex items-center justify-center p-4"
        onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="hardware-card p-6 sm:p-10 max-w-lg w-full text-center rounded-3xl sm:rounded-[2.5rem] shadow-2xl animate-slide-up"
        >
          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-7 ${
            danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
          }`}>
            {icon || <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10" />}
          </div>

          <h3 id="confirm-title" className="text-lg sm:text-2xl font-black text-slate-900 uppercase tracking-tight mb-3">
            {title}
          </h3>
          <p className="text-sm sm:text-[15px] text-slate-600 font-medium mb-7 sm:mb-9 leading-relaxed">
            {body}
          </p>

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              ref={takeFocus}
              disabled={busy}
              onClick={onCancel}
              className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              disabled={busy}
              onClick={onConfirm}
              className={`sm:flex-[1.6] py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-xl flex items-center justify-center gap-2.5 disabled:opacity-60 ${
                danger
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
              }`}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {busy ? busyLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ConfirmDialog;
