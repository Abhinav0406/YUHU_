import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[Supabase] Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in yuhu/.env (see .env.example).',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Add a helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseKey;
};
