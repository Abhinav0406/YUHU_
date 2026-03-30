// Loads .env for local `expo start`. For EAS builds, set EXPO_PUBLIC_* in
// Project → Environment variables or in eas.json → build.*.env.
require('dotenv').config();

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  },
});
