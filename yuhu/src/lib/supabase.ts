import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = 'https://awazxytwuhmsyogfdrho.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXp4eXR3dWhtc3lvZ2ZkcmhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3MjEzNjMsImV4cCI6MjA2MjI5NzM2M30.bAOXIXvLJBiQ5DVmtEpnyJ8ZqTk5bUV1zJ2S1pyfBzg';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Add a helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey;
};
