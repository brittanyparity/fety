/**
 * Supabase cloud sync — temporarily off until your project DB is ready.
 * To re-enable: set SUPABASE_INTEGRATION_DISABLED to false, add env vars,
 * uncomment CloudAuthProvider in main.tsx and cloud wiring in App.tsx (search "SUPABASE").
 */
export const SUPABASE_INTEGRATION_DISABLED = true;

export type CloudConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export function readCloudConfig(): CloudConfig | null {
  if (SUPABASE_INTEGRATION_DISABLED) return null;
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { supabaseUrl: url, supabaseAnonKey: anonKey };
}

export function isCloudSyncEnabled(): boolean {
  if (SUPABASE_INTEGRATION_DISABLED) return false;
  return readCloudConfig() != null;
}
