import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  ''
).trim();

const supabaseKey = (
  import.meta.env.VITE_SUPABASE_PUBLISH_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_PUBLISH_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  ''
).trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'tmh_supabase_auth_token_v1',
      },
    });
  } catch (err) {
    console.warn('[Supabase] Không thể khởi tạo client, chuyển về chế độ Offline/Local:', err);
    client = null;
  }
}

export const supabase: SupabaseClient | null = client;
