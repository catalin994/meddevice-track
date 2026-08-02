export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'meditrack_theme';

/**
 * The saved choice, or the operating system's preference the first time round.
 * Applied to <html> so the page background, form controls and scrollbars all
 * follow, not just the React tree.
 */
export const getInitialTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* private mode — fall through to the OS preference */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  // Keeps the phone's browser chrome the same colour as the app
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0b1120' : '#f8fafc');
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
};
