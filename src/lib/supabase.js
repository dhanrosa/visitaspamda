import { createClient } from '@supabase/supabase-js';

export const AUTH_STORAGE_KEY = 'pamda-supabase-auth';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function getSupabase() {
  if (!url || !key) throw new Error('Configure a conexão do Supabase para entrar no sistema.');
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new Error('A configuração da conexão precisa ser revisada.');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Revise a URL do Supabase na configuração do sistema.'); }
  if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('A conexão do Supabase precisa usar HTTPS.');
  }
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: AUTH_STORAGE_KEY },
  });
}
