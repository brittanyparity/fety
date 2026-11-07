/** Dormant while SUPABASE_INTEGRATION_DISABLED — not mounted from main.tsx. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isCloudSyncEnabled } from "../lib/cloud/cloudConfig";
import { getSupabase } from "../lib/cloud/supabaseClient";

export type CloudAuthContextValue = {
  cloudEnabled: boolean;
  authReady: boolean;
  session: Session | null;
  user: User | null;
  authError: string | null;
  clearAuthError: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const CloudAuthContext = createContext<CloudAuthContextValue | null>(null);

export function CloudAuthProvider({ children }: { children: ReactNode }) {
  const cloudEnabled = isCloudSyncEnabled();
  const [authReady, setAuthReady] = useState(!cloudEnabled);
  const [session, setSession] = useState<Session | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!cloudEnabled) return;
    const supabase = getSupabase();
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [cloudEnabled]);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const supabase = getSupabase();
    if (!supabase) {
      const msg = "Cloud sign-in is not configured on this build.";
      setAuthError(msg);
      return { error: msg };
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setAuthError(error.message);
      return { error: error.message };
    }
    setAuthError(null);
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const supabase = getSupabase();
    if (!supabase) {
      const msg = "Cloud sign-up is not configured on this build.";
      setAuthError(msg);
      return { error: msg, needsEmailConfirmation: false };
    }
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) {
      setAuthError(error.message);
      return { error: error.message, needsEmailConfirmation: false };
    }
    const needsEmailConfirmation = data.session == null;
    setAuthError(null);
    return { error: null, needsEmailConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo<CloudAuthContextValue>(
    () => ({
      cloudEnabled,
      authReady,
      session,
      user: session?.user ?? null,
      authError,
      clearAuthError: () => setAuthError(null),
      signIn,
      signUp,
      signOut,
    }),
    [cloudEnabled, authReady, session, authError, signIn, signUp, signOut],
  );

  return <CloudAuthContext.Provider value={value}>{children}</CloudAuthContext.Provider>;
}

export function useCloudAuth(): CloudAuthContextValue {
  const ctx = useContext(CloudAuthContext);
  if (!ctx) throw new Error("useCloudAuth must be used within CloudAuthProvider");
  return ctx;
}
