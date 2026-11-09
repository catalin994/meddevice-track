declare const __BUILD_ID__: string;

/**
 * Ce versiune ruleaza acum, si ce versiune e publicata.
 *
 * Aplicatia e o PWA: dupa prima vizita, tot ce incarca vine din copia de pe
 * telefon, nu de pe server. E tocmai ce trebuie intr-o sectie fara semnal — si
 * tocmai ce face ca o schimbare publicata azi sa nu ajunga la om saptamani
 * intregi, fara ca nimic sa spuna de ce. S-a intamplat de doua ori: s-a
 * publicat ceva, s-a deschis aplicatia, si arata exact ca inainte.
 *
 * Service worker-ul are mecanismul lui de innoire, dar el tace cand nu
 * reuseste sa intrebe — fara semnal, cu un raspuns din cache, cu o
 * inregistrare care n-a mai fost reimprospatata. Si cand tace, aplicatia pare
 * la zi.
 *
 * Asa ca intrebam de-a dreptul: un fisierel `version.json` scris la fiecare
 * compilare, cerut cu `no-store`, si comparat cu versiunea din bundle-ul care
 * ruleaza. Nu depinde de service worker si raspunde cu da sau nu.
 */

/** Versiunea din bundle-ul care ruleaza chiar acum. */
export const VERSIUNEA_RULATA: string =
  typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

export type StareaVersiunii =
  /** Pe server e altceva decat ce ruleaza aici. */
  | { fel: 'noua'; publicata: string }
  /** Ce ruleaza e ce e publicat. */
  | { fel: 'lazi' }
  /** N-am putut intreba: fara semnal, server mut, raspuns neinteles. */
  | { fel: 'nustiu' };

const caleaVersiunii = () => `${import.meta.env.BASE_URL}version.json`;

/**
 * Intreaba serverul ce versiune e publicata.
 *
 * `cache: 'no-store'` si un parametru care se schimba: altfel raspunsul ar
 * veni chiar din cache-ul despre care intrebam, si ar spune mereu ca totul e
 * la zi. Fisierul e scos anume din precache, din acelasi motiv.
 */
export const versiuneaPublicata = async (): Promise<StareaVersiunii> => {
  if (typeof fetch !== 'function' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { fel: 'nustiu' };
  }
  try {
    const r = await fetch(`${caleaVersiunii()}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return { fel: 'nustiu' };
    const j = await r.json();
    const publicata = String(j?.build || '').trim();
    if (!publicata) return { fel: 'nustiu' };
    /* In dezvoltare nu exista versiune publicata de comparat. */
    if (VERSIUNEA_RULATA === 'dev') return { fel: 'lazi' };
    return publicata === VERSIUNEA_RULATA ? { fel: 'lazi' } : { fel: 'noua', publicata };
  } catch {
    return { fel: 'nustiu' };
  }
};

/**
 * Sterge tot ce tine aplicatia pe telefon si o incarca din nou de pe server.
 *
 * E ultima treapta, cand innoirea obisnuita n-a mers: cache-urile sterse,
 * service worker-ul scos, pagina ceruta cu alt URL ca sa nu vina din istoric.
 * Nu se pierde nimic din evidenta — datele stau in baza locala si in cloud,
 * nu in cache-ul de fisiere.
 */
export const reincarcaDeLaZero = async (): Promise<void> => {
  try {
    if ('caches' in window) {
      const nume = await caches.keys();
      await Promise.all(nume.map(n => caches.delete(n)));
    }
    if ('serviceWorker' in navigator) {
      const inregistrari = await navigator.serviceWorker.getRegistrations();
      await Promise.all(inregistrari.map(r => r.unregister()));
    }
  } catch { /* facem ce se poate; reincarcarea urmeaza oricum */ }
  const url = new URL(window.location.href);
  url.searchParams.set('v', Date.now().toString());
  window.location.replace(url.toString());
};
