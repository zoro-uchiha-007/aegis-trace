import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function getSupabaseServerClient(): SupabaseClient | null {
  if (supabaseUrl && serviceRoleKey && !supabaseUrl.includes('mock.supabase.co')) {
    try {
      return createClient(supabaseUrl, serviceRoleKey);
    } catch (err) {
      console.warn('Failed to initialize server Supabase client:', err);
      return null;
    }
  }
  return null;
}
