
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch (e) {
    // ignore error
  }
  return undefined;
};

const envUrl = getEnv('SUPABASE_URL');
const envKey = getEnv('SUPABASE_KEY');

const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('meditrack_supabase_url') : null;
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('meditrack_supabase_key') : null;
const isDisabled = typeof window !== 'undefined' ? localStorage.getItem('meditrack_supabase_disabled') === 'true' : false;

const DEFAULT_URL = "https://cevixwidnxpjnctljfzs.supabase.co";
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNldml4d2lkbnhwam5jdGxqZnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzU1NTUsImV4cCI6MjA4MTMxMTU1NX0.22qlURNa9Hmwq68BPvWdihZ8KWgEDlLmuP_j_EXibp8";

const finalUrl = envUrl || storedUrl || DEFAULT_URL;
const finalKey = envKey || storedKey || DEFAULT_KEY;

export const supabase = (!isDisabled && finalUrl && finalKey) 
  ? createClient(finalUrl, finalKey) 
  : null;

export const isSupabaseConfigured = !!supabase;

export const getSupabaseConfig = () => ({
  url: finalUrl,
  key: finalKey,
  isEnv: !!(envUrl && envKey),
  isDisabled
});

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('meditrack_supabase_url', url);
  localStorage.setItem('meditrack_supabase_key', key);
  localStorage.removeItem('meditrack_supabase_disabled');
  window.location.reload();
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem('meditrack_supabase_url');
  localStorage.removeItem('meditrack_supabase_key');
  localStorage.setItem('meditrack_supabase_disabled', 'true');
  window.location.reload();
};

/** PostgREST caps every response at 1000 rows by default, so a plain
 *  select('*') silently truncates larger fleets. */
const PAGE_SIZE = 1000;

/**
 * Reads an entire table, one page at a time.
 *
 * Without this a device list longer than 1000 arrives incomplete — which looks
 * exactly like "some equipment is missing" on a freshly installed phone, where
 * there is no local copy to fall back on.
 */
export const fetchAllRows = async <T>(
  table: string,
  orderColumn = 'id',
): Promise<{ data: T[] | null; error: any }> => {
  if (!supabase) return { data: null, error: new Error('Cloud neconfigurat') };

  const all: T[] = [];
  const MAX_PAGES = 100; // 100k rows — a hard stop against a misbehaving endpoint
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) return { data: null, error };
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
  }
  return { data: all, error: null };
};

/**
 * Writes rows in batches. Devices can carry base64 files, so a single request
 * with the whole fleet exceeds the request size limit and the write fails
 * outright — leaving the cloud copy incomplete.
 *
 * onProgress reports rows written so far, so long uploads can show a bar
 * instead of appearing frozen.
 */
export const upsertInChunks = async (
  table: string,
  rows: any[],
  chunkSize = 100,
  onProgress?: (written: number, total: number) => void,
): Promise<{ error: any; written: number }> => {
  if (!supabase) return { error: new Error('Cloud neconfigurat'), written: 0 };

  let written = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) return { error, written };
    written += chunk.length;
    onProgress?.(written, rows.length);
  }
  return { error: null, written };
};

/**
 * Row count from the server without downloading the table.
 *
 * Uses a normal GET limited to one row rather than `head: true`: a HEAD request
 * is refused by some proxies and CORS setups, which would report "cloud
 * unreachable" on a perfectly healthy project.
 */
export const countCloudRows = async (table: string): Promise<{ count: number | null; error: any }> => {
  if (!supabase) return { count: null, error: new Error('Cloud neconfigurat') };
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact' })
    .limit(1);
  return { count: count ?? null, error };
};

export type CloudStage = 'no-config' | 'unreachable' | 'blocked' | 'auth' | 'schema' | 'ok';

export interface CloudDiagnosis {
  ok: boolean;
  stage: CloudStage;
  title: string;
  detail: string;
  hint: string;
}

/**
 * Works out *why* the cloud can't be reached.
 *
 * fetch() reports every network-level problem as the same opaque
 * "Failed to fetch", so we probe in stages: an opaque no-cors request tells us
 * whether the host answers at all (a paused or deleted Supabase project simply
 * doesn't resolve), and only then do we look at status codes and error codes.
 */
export const diagnoseCloud = async (): Promise<CloudDiagnosis> => {
  const { url, key } = getSupabaseConfig();

  if (!url || !key) {
    return { ok: false, stage: 'no-config', title: 'Cloud neconfigurat',
      detail: 'Lipsesc URL-ul proiectului sau cheia anon.',
      hint: 'Completeaza-le mai sus si apasa "Conecteaza instanta cloud".' };
  }

  const base = url.replace(/\/+$/, '');

  // Stage 1 — does the host answer at all? An opaque response is enough.
  try {
    await fetch(`${base}/rest/v1/`, { method: 'GET', mode: 'no-cors', cache: 'no-store' });
  } catch {
    return { ok: false, stage: 'unreachable', title: 'Serverul nu raspunde',
      detail: `Nu se poate ajunge la ${base}.`,
      hint: 'Cauze uzuale: proiectul Supabase este in pauza sau a fost sters (proiectele gratuite se pun in pauza dupa 7 zile de inactivitate) · URL scris gresit · lipsa internet · retea sau extensie care blocheaza supabase.co. Deschide dashboard.supabase.com si verifica daca proiectul e activ; daca scrie "Paused", apasa Resume.' };
  }

  // Stage 2 — a real, authenticated request
  try {
    const res = await fetch(`${base}/rest/v1/devices?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, stage: 'auth', title: 'Cheie respinsa',
        detail: `Serverul a raspuns ${res.status}.`,
        hint: 'Cheia anon nu este valida pentru acest proiect. Copiaza-o din Supabase → Project Settings → API → anon public.' };
    }

    const body = await res.json().catch(() => null);

    if (res.status === 404 || body?.code === 'PGRST205' || body?.code === '42P01') {
      return { ok: false, stage: 'schema', title: 'Tabelele lipsesc',
        detail: body?.message || 'Tabelul "devices" nu a fost gasit.',
        hint: 'Copiaza scriptul SQL de mai jos si ruleaza-l in Supabase → SQL Editor.' };
    }

    if (!res.ok) {
      return { ok: false, stage: 'blocked', title: `Eroare server (${res.status})`,
        detail: body?.message || res.statusText,
        hint: 'Verifica politicile RLS din Supabase sau ruleaza din nou scriptul SQL.' };
    }

    return { ok: true, stage: 'ok', title: 'Conexiune functionala',
      detail: 'Serverul raspunde si tabelele exista.', hint: '' };
  } catch (err: any) {
    // Host answered the opaque probe but blocks the real request → CORS/policy
    return { ok: false, stage: 'blocked', title: 'Cerere blocata',
      detail: err?.message || 'Failed to fetch',
      hint: 'Serverul exista, dar cererea este blocata. Verifica in Supabase → Project Settings → API daca URL-ul este cel corect, si dezactiveaza temporar extensiile de blocare din browser.' };
  }
};

/**
 * Enhanced check to specifically identify "Paused", "Table Missing", or "Resuming" states.
 * PGRST205: Table not in schema cache (common missing table error).
 * 42P01: Relation does not exist (standard Postgres missing table error).
 */
export const checkConnection = async (): Promise<{ success: boolean; message: string; errorType?: 'auth' | 'table' | 'network' | 'paused' }> => {
  if (!supabase) return { success: false, message: "Cloud neconfigurat.", errorType: 'network' };
  
  try {
    const { error } = await supabase.from('devices').select('id').limit(1);
    
    if (error) {
      console.error("[Supabase Diagnostic] Error code:", error.code, "Message:", error.message);
      
      // PGRST205 and 42P01 both mean the 'devices' table is missing from the public schema
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return { 
          success: false, 
          message: "Tabelul 'devices' nu exista. Ruleaza scriptul SQL din Configurare in Supabase SQL Editor.", 
          errorType: 'table' 
        };
      }
      
      if (error.code === 'PGRST301') return { success: false, message: "Autentificare respinsa. Verifica URL-ul si cheia anon in Configurare.", errorType: 'auth' };
      
      // Detection for paused projects or 503 service unavailable
      if (error.message.includes('Service Unavailable') || 
          error.message.includes('paused') || 
          error.code === '503' || 
          (error as any).status === 503) {
        return { success: false, message: "Proiectul Supabase este oprit sau reporneste. Asteapta un moment si reincearca.", errorType: 'paused' };
      }
      
      return { success: false, message: error.message, errorType: 'network' };
    }
    
    return { success: true, message: "Conexiune cloud functionala." };
  } catch (err: any) {
    return { success: false, message: err.message || "Eroare de retea neasteptata.", errorType: 'network' };
  }
};
