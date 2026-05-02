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
import { getRestaurantSettings, listMyRestaurants } from "@/data/api/tenantApi";
import type {
  Profile,
  RestaurantMembership,
  RestaurantSettingsRow,
} from "@/data/api/types";

interface AuthContextValue {
  status: "loading" | "unauthenticated" | "authenticated";
  session: Session | null;
  sessionRestored: boolean;
  lastAuthEvent: string;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  memberships: RestaurantMembership[];
  activeRestaurantId: string | null;
  activeMembership: RestaurantMembership | null;
  activeRestaurantSettings: RestaurantSettingsRow | null;
  setActiveRestaurantId: (id: string) => void;
  refreshAuth: () => Promise<Session | null>;
  refreshTenants: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [lastAuthEvent, setLastAuthEvent] = useState("initializing");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<RestaurantMembership[]>([]);
  const [activeRestaurantSettings, setActiveRestaurantSettings] =
    useState<RestaurantSettingsRow | null>(null);
  const [activeRestaurantId, setActiveRestaurantIdState] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const activeRestaurantIdRef = useRef<string | null>(null);

  const loadRestaurantSettings = useCallback(async (restaurantId: string | null) => {
    if (!restaurantId) {
      setActiveRestaurantSettings(null);
      return;
    }

    try {
      const settings = await getRestaurantSettings(restaurantId);
      setActiveRestaurantSettings(settings);
    } catch (e) {
      console.error("[auth] failed to load restaurant settings", e);
      setActiveRestaurantSettings(null);
    }
  }, []);

  const loadTenantData = useCallback(async (uid: string | null) => {
    if (!uid) {
      setProfile(null);
      setMemberships([]);
      setActiveRestaurantSettings(null);
      activeRestaurantIdRef.current = null;
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
      const nextActiveId =
        mems.find((membership) => membership.restaurant.id === activeRestaurantIdRef.current)?.restaurant
          .id ?? mems[0]?.restaurant.id ?? null;
      activeRestaurantIdRef.current = nextActiveId;
      setActiveRestaurantIdState(nextActiveId);
      await loadRestaurantSettings(nextActiveId);
    } catch (e) {
      console.error("[auth] failed to load tenant data", e);
      setProfile(null);
      setMemberships([]);
      setActiveRestaurantSettings(null);
      activeRestaurantIdRef.current = null;
      setActiveRestaurantIdState(null);
    }
  }, [loadRestaurantSettings]);

  useEffect(() => {
    let mounted = true;

    // Auth state listener FIRST, then getSession.
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      setLastAuthEvent(event);
      setSession(newSession);
      const uid = newSession?.user?.id ?? null;
      userIdRef.current = uid;
      if (event === "SIGNED_OUT") {
        setSessionRestored(false);
      }

      // Defer Supabase calls out of the listener callback to avoid deadlocks.
      setTimeout(() => {
        void loadTenantData(uid).finally(() => {
          if (mounted) {
            setSessionRestored(!!uid);
          }
        });
      }, 0);
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[auth] failed to restore session", error);
          setSession(null);
          userIdRef.current = null;
          setLastAuthEvent("restore_error");
          return loadTenantData(null);
        }

        setSession(data.session);
        const uid = data.session?.user?.id ?? null;
        userIdRef.current = uid;
        setSessionRestored(!!data.session);
        setLastAuthEvent(data.session ? "getSession:restored" : "getSession:none");
        return loadTenantData(uid);
      })
      .catch((error) => {
        if (!mounted) return;
        console.error("[auth] session bootstrap crashed", error);
        setSession(null);
        userIdRef.current = null;
        setLastAuthEvent("restore_crash");
        return loadTenantData(null);
      })
      .finally(() => {
        if (mounted) {
          setHydrated(true);
        }
      });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadTenantData]);

  const setActiveRestaurantId = useCallback((id: string) => {
    activeRestaurantIdRef.current = id;
    setActiveRestaurantIdState(id);
    void loadRestaurantSettings(id);
  }, [loadRestaurantSettings]);

  const refreshAuth = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    const nextSession = data.session;
    const uid = nextSession?.user?.id ?? null;

    setSession(nextSession);
    userIdRef.current = uid;
    setSessionRestored(!!nextSession);
    setLastAuthEvent(nextSession ? "refreshAuth:session" : "refreshAuth:none");

    await loadTenantData(uid);

    if (!hydrated) {
      setHydrated(true);
    }

    return nextSession;
  }, [hydrated, loadTenantData]);

  const refreshTenants = useCallback(async () => {
    await loadTenantData(userIdRef.current);
  }, [loadTenantData]);

  const signOutFn = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setSessionRestored(false);
      setLastAuthEvent("SIGNED_OUT");
      setProfile(null);
      setMemberships([]);
      setActiveRestaurantSettings(null);
      activeRestaurantIdRef.current = null;
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
      sessionRestored,
      lastAuthEvent,
      userId: session?.user?.id ?? null,
      email: session?.user?.email ?? null,
      profile,
      memberships,
      activeRestaurantId,
      activeMembership,
        activeRestaurantSettings,
      setActiveRestaurantId,
        refreshAuth,
      refreshTenants,
      signOut: signOutFn,
    };
  }, [
    hydrated,
    session,
    sessionRestored,
    lastAuthEvent,
    profile,
    memberships,
    activeRestaurantId,
    activeRestaurantSettings,
    setActiveRestaurantId,
    refreshAuth,
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
