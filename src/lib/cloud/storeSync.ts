import type { FetyStore } from "../../types/fety";
import { importStoreSnapshot, storePayloadForPersist } from "../fetyStorage";
import { getSupabase } from "./supabaseClient";

export type RemoteStoreRow = {
  store: FetyStore;
  updatedAt: string;
};

export async function fetchRemoteStore(userId: string): Promise<RemoteStoreRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("fety_user_stores")
    .select("store, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.store) return null;

  const store = importStoreSnapshot(data.store as FetyStore);
  return { store, updatedAt: data.updated_at as string };
}

export async function pushRemoteStore(userId: string, store: FetyStore): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Cloud sync is not configured.");

  const payload = storePayloadForPersist(store);
  const { data, error } = await supabase
    .from("fety_user_stores")
    .upsert({ user_id: userId, store: payload }, { onConflict: "user_id" })
    .select("updated_at")
    .single();

  if (error) throw new Error(error.message);
  return (data.updated_at as string) ?? new Date().toISOString();
}
