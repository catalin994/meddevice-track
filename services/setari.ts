import { supabase } from './supabase';

/**
 * Setarile care trebuie sa fie la fel pe toate aparatele.
 *
 * Pana acum stateau in localStorage, adica pe aparatul de la care fusesera
 * scrise. Limita abonamentului trecuta pe calculator ramanea 1 GB pe telefon,
 * si bara de spatiu arata alta poveste in fiecare loc — fara ca cineva sa
 * inteleaga de ce.
 *
 * Regula: se citeste intai copia locala, ca ecranul sa nu astepte reteaua, si
 * se improspateaza din cloud in fundal. Se scrie in amandoua. Fara semnal,
 * setarea ramane a aparatului pana la urmatoarea sincronizare — ceea ce e tot
 * ce se poate face, si e oricum mai bine decat inainte.
 */

const PREFIX = 'meditrack_setare_';

export type Setare = 'limita_stocare_gb' | 'cuvinte_triaj';

const local = (cheie: Setare) => `${PREFIX}${cheie}`;

export const iaSetareLocal = <T>(cheie: Setare, implicit: T): T => {
  try {
    const raw = localStorage.getItem(local(cheie));
    return raw === null ? implicit : (JSON.parse(raw) as T);
  } catch {
    return implicit;
  }
};

const punLocal = (cheie: Setare, valoare: unknown) => {
  try { localStorage.setItem(local(cheie), JSON.stringify(valoare)); } catch { /* plin sau blocat */ }
};

/**
 * Valoarea din cloud, cand se poate ajunge la ea.
 *
 * Intoarce null cand tabelul lipseste sau reteaua nu raspunde — apelantul
 * ramane cu ce are local, si nimic nu se strica.
 */
export const iaSetareDinCloud = async <T>(cheie: Setare): Promise<T | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('setari').select('valoare').eq('cheie', cheie).maybeSingle();
    if (error || !data) return null;
    const v = (data as any).valoare;
    if (v === null || v === undefined) return null;
    punLocal(cheie, v);
    return v as T;
  } catch {
    return null;
  }
};

export const punSetare = async (cheie: Setare, valoare: unknown): Promise<{ inCloud: boolean }> => {
  punLocal(cheie, valoare);
  if (!supabase) return { inCloud: false };
  try {
    const { error } = await supabase.from('setari').upsert(
      [{ cheie, valoare, updated_at: new Date().toISOString() }],
      { onConflict: 'cheie' },
    );
    return { inCloud: !error };
  } catch {
    return { inCloud: false };
  }
};
