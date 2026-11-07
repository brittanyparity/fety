/** Dormant while SUPABASE_INTEGRATION_DISABLED — see cloudConfig.ts. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readCloudConfig } from "./cloudConfig";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const config = readCloudConfig();
  if (!config) return null;
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
