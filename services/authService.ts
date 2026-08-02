import { AppUser, UserRole } from '../types';
import { supabase } from './supabase';

const LOCK_KEY = 'meditrack_device_pin';
const PROFILE_CACHE = 'meditrack_profile';

/* ──────────────────────────────────────────────────────────────────────────
 * Accounts
 *
 * Identity lives in Supabase Auth; the name and role live in `profiles`,
 * which the database's own policies consult on every read and write. The UI
 * checks the role too, but only so it can hide what wouldn't work anyway —
 * it is no longer the thing standing between a viewer and the data.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Flat rather than a discriminated union: this project compiles without
 * strictNullChecks, and TypeScript only narrows boolean discriminants when
 * that flag is on.
 */
export type AuthResult = { ok: boolean; user?: AppUser; error?: string };

const RO_ERRORS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Email sau parola gresita.'],
  [/email not confirmed/i, 'Contul nu e confirmat. Verifica emailul primit de la Supabase.'],
  [/user already registered|already been registered/i, 'Exista deja un cont cu acest email.'],
  [/password should be at least/i, 'Parola trebuie sa aiba cel putin 6 caractere.'],
  [/unable to validate email|invalid format/i, 'Adresa de email nu pare valida.'],
  [/rate limit|too many/i, 'Prea multe incercari. Reincearca peste un minut.'],
  [/failed to fetch|network/i, 'Nu am putut contacta serverul. Verifica internetul.'],
];

const translate = (message: string): string => {
  for (const [pattern, text] of RO_ERRORS) if (pattern.test(message)) return text;
  return message;
};

/** The profile row, or null when the account has no profile yet. */
const loadProfile = async (id: string, email: string): Promise<AppUser | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role, approved, email')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  const user: AppUser = {
    id: data.id,
    name: data.name || email.split('@')[0],
    email: data.email || email,
    role: (data.role as UserRole) || 'VIZUALIZARE',
    approved: !!data.approved,
  };
  try { localStorage.setItem(PROFILE_CACHE, JSON.stringify(user)); } catch { /* ignore */ }
  return user;
};

/**
 * The profile from the last successful sign-in. Used when the phone is offline:
 * the session is still valid locally, so the app should open its local data
 * rather than refuse to start.
 */
export const getCachedProfile = (): AppUser | null => {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
};

export const signIn = async (email: string, password: string): Promise<AuthResult> => {
  if (!supabase) return { ok: false, error: 'Cloud-ul nu este configurat.' };
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) return { ok: false, error: translate(error?.message || 'Autentificare esuata.') };

  const profile = await loadProfile(data.user.id, data.user.email || email);
  if (!profile) {
    return {
      ok: false,
      error: 'Contul nu are profil. Ruleaza scriptul de securitate din Configurare.',
    };
  }
  return { ok: true, user: profile };
};

export const signUp = async (email: string, password: string, name: string): Promise<AuthResult> => {
  if (!supabase) return { ok: false, error: 'Cloud-ul nu este configurat.' };
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name: name.trim() } },
  });
  if (error) return { ok: false, error: translate(error.message) };

  // With email confirmation on, there is no session yet — the profile exists
  // but the user has to confirm before they can sign in.
  if (!data.session || !data.user) {
    return { ok: false, error: 'Cont creat. Confirma adresa din emailul primit, apoi autentifica-te.' };
  }
  const profile = await loadProfile(data.user.id, data.user.email || email);
  if (!profile) return { ok: false, error: 'Cont creat, dar profilul lipseste. Ruleaza scriptul de securitate.' };
  return { ok: true, user: profile };
};

/** The signed-in user, refreshed from the server when reachable. */
export const getCurrentUser = async (): Promise<AppUser | null> => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.user) return null;

  const fresh = await loadProfile(session.user.id, session.user.email || '');
  // Offline: the session is still good, so fall back to what we last saw.
  return fresh || getCachedProfile();
};

export const signOut = async () => {
  try { localStorage.removeItem(PROFILE_CACHE); } catch { /* ignore */ }
  clearDeviceLock();
  if (supabase) await supabase.auth.signOut();
};

export const onAuthChange = (cb: (signedIn: boolean) => void) => {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') cb(false);
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') cb(true);
  });
  return () => data.subscription.unsubscribe();
};

/* ──────────────────────────────────────────────────────────────────────────
 * Device lock
 *
 * A PIN so the app can be reopened on a phone without retyping a password.
 * It guards the screen, not the data: the Supabase session is what the
 * database trusts. It never leaves the device and is stored as a hash.
 * ────────────────────────────────────────────────────────────────────────── */

const hashPin = async (pin: string): Promise<string> => {
  const bytes = new TextEncoder().encode(`meditrack:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const hasDeviceLock = (): boolean => {
  try { return !!localStorage.getItem(LOCK_KEY); } catch { return false; }
};

export const setDeviceLock = async (pin: string) => {
  try { localStorage.setItem(LOCK_KEY, await hashPin(pin)); } catch { /* ignore */ }
};

export const verifyDeviceLock = async (pin: string): Promise<boolean> => {
  try {
    const stored = localStorage.getItem(LOCK_KEY);
    return !!stored && stored === (await hashPin(pin));
  } catch {
    return false;
  }
};

export const clearDeviceLock = () => {
  try { localStorage.removeItem(LOCK_KEY); } catch { /* ignore */ }
};

/* ──────────────────────────────────────────────────────────────────────────
 * Administration — every call below is also enforced by the database
 * ────────────────────────────────────────────────────────────────────────── */

export const listProfiles = async (): Promise<AppUser[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role, approved, email, created_at')
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map(p => ({
    id: p.id,
    name: p.name || (p.email || '').split('@')[0],
    email: p.email || '',
    role: (p.role as UserRole) || 'VIZUALIZARE',
    approved: !!p.approved,
  }));
};

export const updateProfile = async (id: string, patch: { role?: UserRole; approved?: boolean; name?: string }) => {
  if (!supabase) return { error: 'Cloud-ul nu este configurat.' };
  const { error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error ? translate(error.message) : null };
};
