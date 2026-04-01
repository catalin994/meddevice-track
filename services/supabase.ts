
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

/**
 * Enhanced check to specifically identify "Paused", "Table Missing", or "Resuming" states.
 * PGRST205: Table not in schema cache (common missing table error).
 * 42P01: Relation does not exist (standard Postgres missing table error).
 */
export const checkConnection = async (): Promise<{ success: boolean; message: string; errorType?: 'auth' | 'table' | 'network' | 'paused' }> => {
  if (!supabase) return { success: false, message: "Supabase client not initialized.", errorType: 'network' };
  
  try {
    const { error } = await supabase.from('devices').select('id').limit(1);
    
    if (error) {
      console.error("[Supabase Diagnostic] Error code:", error.code, "Message:", error.message);
      
      // PGRST205 and 42P01 both mean the 'devices' table is missing from the public schema
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return { 
          success: false, 
          message: "The 'devices' table was not found. Please go to Settings and run the SQL migration script in your Supabase SQL Editor.", 
          errorType: 'table' 
        };
      }
      
      if (error.code === 'PGRST301') return { success: false, message: "Authentication failed. Please verify your Project URL and Anon Key in Settings.", errorType: 'auth' };
      
      // Detection for paused projects or 503 service unavailable
      if (error.message.includes('Service Unavailable') || 
          error.message.includes('paused') || 
          error.code === '503' || 
          (error as any).status === 503) {
        return { success: false, message: "Your Supabase project is currently paused or resuming. Please wait a moment and try again.", errorType: 'paused' };
      }
      
      return { success: false, message: error.message, errorType: 'network' };
    }
    
    return { success: true, message: "Cloud connection healthy." };
  } catch (err: any) {
    return { success: false, message: err.message || "An unexpected network error occurred.", errorType: 'network' };
  }
};
