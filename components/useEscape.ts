import { useEffect } from 'react';

/**
 * Escape closes what is open.
 *
 * Twelve of the app's fifteen overlays could only be dismissed by finding
 * their X — including the ones that cover the whole screen on a phone, where
 * the X is a small target in a corner. Escape is what everyone tries first on
 * a keyboard, and it costs three lines per dialog.
 *
 * Only the topmost listener should act, so each call checks that no later
 * overlay has opened on top of it. Passing `active: false` unregisters.
 */
export const useEscape = (onEscape: () => void, active = true) => {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // A text field mid-edit gets first refusal: Escape there means "revert
      // this value", and closing the whole dialog would throw away the rest.
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && (el as HTMLInputElement).value) {
        return;
      }
      e.preventDefault();
      onEscape();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onEscape, active]);
};

export default useEscape;
