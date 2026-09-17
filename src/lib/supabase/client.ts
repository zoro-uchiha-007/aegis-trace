import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let browserClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;

  if (browserClient) return browserClient;

  // If environment variables are available and valid
  if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('mock.supabase.co')) {
    try {
      browserClient = createClient(supabaseUrl, supabaseAnonKey);
      return browserClient;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return null;
}
