import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = 'https://awazxytwuhmsyogfdrho.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXp4eXR3dWhtc3lvZ2ZkcmhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3MjEzNjMsImV4cCI6MjA2MjI5NzM2M30.bAOXIXvLJBiQ5DVmtEpnyJ8ZqTk5bUV1zJ2S1pyfBzg';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Add a helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseKey;
};
