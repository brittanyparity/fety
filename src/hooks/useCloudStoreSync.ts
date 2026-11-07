/** Dormant while SUPABASE_INTEGRATION_DISABLED — not used from App.tsx. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { fetchRemoteStore, pushRemoteStore } from "../lib/cloud/storeSync";
import type { FetyStore } from "../types/fety";

const PUSH_DEBOUNCE_MS = 2500;

export type CloudSyncState = {
  syncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  pullRemoteStore: () => Promise<FetyStore | null>;
};

export function useCloudStoreSync(
  session: Session | null,
  store: FetyStore,
  onRemoteStore: (store: FetyStore) => void,
  enabled: boolean,
): CloudSyncState {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const pushTimer = useRef<number | null>(null);
  const skipNextPush = useRef(false);
  const userId = session?.user?.id;

  const pullRemoteStore = useCallback(async (): Promise<FetyStore | null> => {
    if (!enabled || !userId) return null;
    setSyncing(true);
    setSyncError(null);
    try {
      const remote = await fetchRemoteStore(userId);
      if (remote) {
        skipNextPush.current = true;
        onRemoteStore(remote.store);
        setLastSyncedAt(remote.updatedAt);
        return remote.store;
      }
      return null;
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Could not download your data.");
      return null;
    } finally {
      setSyncing(false);
    }
  }, [enabled, userId, onRemoteStore]);

  useEffect(() => {
    if (!enabled || !userId) return;
    void pullRemoteStore();
  }, [enabled, userId]); // pull once per login — omit pullRemoteStore to avoid loops

  useEffect(() => {
    if (!enabled || !userId) return;
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }

    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => {
      setSyncing(true);
      pushRemoteStore(userId, store)
        .then((updatedAt) => {
          setLastSyncedAt(updatedAt);
          setSyncError(null);
        })
        .catch((e) => {
          setSyncError(e instanceof Error ? e.message : "Could not save to the cloud.");
        })
        .finally(() => setSyncing(false));
    }, PUSH_DEBOUNCE_MS);

    return () => {
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
    };
  }, [enabled, userId, store]);

  return { syncing, lastSyncedAt, syncError, pullRemoteStore };
}
