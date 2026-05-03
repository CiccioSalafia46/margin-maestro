import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { useAuth } from "./AuthProvider";

/** Routes that do NOT require authentication. */
const PUBLIC_PATHS = new Set(["/login", "/signup", "/auth/callback", "/accept-invite"]);

/**
 * Routes that authenticated users should be bounced away from — these are
 * login/signup flows that make no sense once you're signed in.
 * Note: /accept-invite is public but NOT an auth-flow path — authenticated
 * users should be able to accept invites.
 */
const AUTH_FLOW_PATHS = new Set(["/login", "/signup", "/auth/callback"]);

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

    // authenticated + has restaurant — redirect away from auth-flow pages
    // and root, but NOT from app routes like /qa-auth or /settings.
    if (AUTH_FLOW_PATHS.has(pathname) || isOnboarding || pathname === "/") {
      navigate({ to: "/dashboard", replace: true });
    }
    void activeRestaurantId; // referenced for re-eval when switching tenants
  }, [status, memberships, activeRestaurantId, pathname, navigate]);

  return <>{children}</>;
}
