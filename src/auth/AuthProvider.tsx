import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/data/api/supabaseClient";
import { listMyRestaurants } from "@/data/api/tenantApi";
import type { Profile, RestaurantMembership } from "@/data/api/types";

interface AuthContextValue {
  status: "loading" | "unauthenticated" | "authenticated";
  session: Session | null;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  memberships: RestaurantMembership[];
  activeRestaurantId: string | null;
  activeMembership: RestaurantMembership | null;
  setActiveRestaurantId: (id: string) => void;
  refreshTenants: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<RestaurantMembership[]>([]);
  const [activeRestaurantId, setActiveRestaurantIdState] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  const loadTenantData = useCallback(async (uid: string | null) => {
    if (!uid) {
      setProfile(null);
      setMemberships([]);
      setActiveRestaurantIdState(null);
      return;
    }
    try {
      const [{ data: profileRow }, mems] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, full_name, avatar_url")
          .eq("id", uid)
          .maybeSingle(),
        listMyRestaurants(),
      ]);
      setProfile((profileRow as Profile | null) ?? null);
      setMemberships(mems);
      const valid = mems[0]?.restaurant.id ?? null;
      setActiveRestaurantIdState(valid);
    } catch (e) {
      console.error("[auth] failed to load tenant data", e);
      setProfile(null);
      setMemberships([]);
      setActiveRestaurantIdState(null);
    }
  }, []);

  useEffect(() => {
    // Auth state listener FIRST, then getSession.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      const uid = newSession?.user?.id ?? null;
      userIdRef.current = uid;
      // Defer Supabase calls out of the listener callback to avoid deadlocks.
      setTimeout(() => {
        void loadTenantData(uid);
      }, 0);
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      const uid = data.session?.user?.id ?? null;
      userIdRef.current = uid;
      void loadTenantData(uid).finally(() => setHydrated(true));
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [loadTenantData]);

  const setActiveRestaurantId = useCallback((id: string) => {
    setActiveRestaurantIdState(id);
  }, []);

  const refreshTenants = useCallback(async () => {
    await loadTenantData(userIdRef.current);
  }, [loadTenantData]);

  const signOutFn = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setProfile(null);
      setMemberships([]);
      setActiveRestaurantIdState(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const status: AuthContextValue["status"] = !hydrated
      ? "loading"
      : session
        ? "authenticated"
        : "unauthenticated";
    const activeMembership =
      memberships.find((m) => m.restaurant.id === activeRestaurantId) ?? null;
    return {
      status,
      session,
      userId: session?.user?.id ?? null,
      email: session?.user?.email ?? null,
      profile,
      memberships,
      activeRestaurantId,
      activeMembership,
      setActiveRestaurantId,
      refreshTenants,
      signOut: signOutFn,
    };
  }, [
    hydrated,
    session,
    profile,
    memberships,
    activeRestaurantId,
    setActiveRestaurantId,
    refreshTenants,
    signOutFn,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
