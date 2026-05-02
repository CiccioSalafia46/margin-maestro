import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { useAuth } from "./AuthProvider";

const PUBLIC_PATHS = new Set(["/login", "/signup", "/auth/callback", "/qa-auth"]);
const ONBOARDING_PATH = "/onboarding/create-restaurant";

/**
 * Centralized redirect logic. Renders children unconditionally and lets routes
 * decide what to display while redirects fire.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status, memberships, activeRestaurantId } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "loading") return;

    const isPublic = PUBLIC_PATHS.has(pathname);
    const isOnboarding = pathname === ONBOARDING_PATH;

    if (status === "unauthenticated") {
      if (!isPublic) {
        navigate({ to: "/login", replace: true });
      }
      return;
    }

    // authenticated
    if (memberships.length === 0) {
      if (!isOnboarding) navigate({ to: ONBOARDING_PATH, replace: true });
      return;
    }

    // authenticated + has restaurant
    if (isPublic || isOnboarding || pathname === "/") {
      navigate({ to: "/dashboard", replace: true });
    }
    void activeRestaurantId; // referenced for re-eval when switching tenants
  }, [status, memberships, activeRestaurantId, pathname, navigate]);

  return <>{children}</>;
}
