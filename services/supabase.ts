import { createClient } from '@supabase/supabase-js';

// Helper to safely access env vars without crashing if process is undefined
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

// 1. Environment Variables (Highest Priority)
const envUrl = getEnv('SUPABASE_URL');
const envKey = getEnv('SUPABASE_KEY');

// 2. Local Storage (User Configured via Settings UI)
const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('meditrack_supabase_url') : null;
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('meditrack_supabase_key') : null;
const isDisabled = typeof window !== 'undefined' ? localStorage.getItem('meditrack_supabase_disabled') === 'true' : false;

// 3. Defaults (Hardcoded for this specific deployment)
const DEFAULT_URL = "https://cevixwidnxpjnctljfzs.supabase.co";
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNldml4d2lkbnhwam5jdGxqZnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzU1NTUsImV4cCI6MjA4MTMxMTU1NX0.22qlURNa9Hmwq68BPvWdihZ8KWgEDlLmuP_j_EXibp8";

const finalUrl = envUrl || storedUrl || DEFAULT_URL;
const finalKey = envKey || storedKey || DEFAULT_KEY;

// Create client only if not explicitly disabled and keys are present
export const supabase = (!isDisabled && finalUrl && finalKey) 
  ? createClient(finalUrl, finalKey) 
  : null;

export const isSupabaseConfigured = !!supabase;

export const getSupabaseConfig = () => ({
  url: finalUrl,
  key: finalKey,
  isEnv: !!(envUrl && envKey), // filtered boolean to know if it's locked by env
  isDisabled
});

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('meditrack_supabase_url', url);
  localStorage.setItem('meditrack_supabase_key', key);
  localStorage.removeItem('meditrack_supabase_disabled'); // Re-enable if it was disabled
  window.location.reload(); // Reload to re-initialize the supabase client singleton
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem('meditrack_supabase_url');
  localStorage.removeItem('meditrack_supabase_key');
  // We explicitly disable it so it doesn't fall back to the hardcoded DEFAULT_KEY immediately
  localStorage.setItem('meditrack_supabase_disabled', 'true');
  window.location.reload();
};