// Loads .env for local `expo start`. For EAS builds, set EXPO_PUBLIC_* in
// Project → Environment variables or in eas.json → build.*.env.
require('dotenv').config();

const DEFAULT_SUPABASE_URL = 'https://awazxytwuhmsyogfdrho.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXp4eXR3dWhtc3lvZ2ZkcmhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3MjEzNjMsImV4cCI6MjA2MjI5NzM2M30.bAOXIXvLJBiQ5DVmtEpnyJ8ZqTk5bUV1zJ2S1pyfBzg';

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
  },
});
