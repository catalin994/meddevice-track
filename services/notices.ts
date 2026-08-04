/**
 * Short-lived messages that have to reach the user wherever they are.
 *
 * Until now the app said things like "only an administrator can delete
 * equipment" by writing into a panel at the bottom of the sidebar. On a
 * phone the sidebar is a closed drawer, so from the technician's side the
 * button simply did nothing — no refusal, no reason, no sign the tap even
 * registered. The same went for every sync failure.
 *
 * The status bar lives outside the app tree (it is mounted in index.tsx), so
 * this is a channel rather than a prop, matching how storage problems are
 * already reported.
 */

export type NoticeTone = 'error' | 'warning' | 'success' | 'info';

export interface Notice {
  id: number;
  text: string;
  tone: NoticeTone;
}

type Listener = (notice: Notice | null) => void;

const listeners = new Set<Listener>();
let current: Notice | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let seq = 0;

/** How long each kind stays up. A refusal needs longer than a confirmation. */
const LIFETIME: Record<NoticeTone, number> = {
  error: 9000,
  warning: 7000,
  success: 4000,
  info: 5000,
};

const emit = () => { listeners.forEach(l => l(current)); };

export const notify = (text: string, tone: NoticeTone = 'info') => {
  if (!text) return;
  // Repeating the same message shouldn't restart nothing — but it should
  // restart the clock, so a second refused tap is visibly answered again.
  if (timer) clearTimeout(timer);
  current = { id: ++seq, text, tone };
  emit();
  timer = setTimeout(() => { current = null; timer = null; emit(); }, LIFETIME[tone]);
};

export const dismissNotice = () => {
  if (timer) { clearTimeout(timer); timer = null; }
  current = null;
  emit();
};

export const getNotice = () => current;

export const onNotice = (listener: Listener) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
