# AI Handoff — Current State

**Date:** 2026-05-02
**Branch:** `build-1.0e-auth-session-fix`
**Last commit:** `c1cede9 Audited and fixed auth client`
**Product:** Margin IQ — Restaurant Margin Intelligence SaaS

---

## Product Positioning

This is NOT POS, inventory, ordering, reservations, or delivery. It is a **Margin Intelligence decision layer** for independent restaurant operators.

Core chain: `ingredients → intermediate recipes → dish recipes → menu analytics → price log → snapshot → impact cascade → alerts`.

---

## Current Accepted Baseline

**Build 1.1 — Settings/Admin Reference Data** is the most recent build implemented. However, it is pending re-acceptance because the underlying Auth session persistence (Build 1.0E) is broken.

What is implemented and live in Supabase:
- Auth (email/password sign-in/sign-up)
- `profiles`, `restaurants`, `restaurant_members`, `restaurant_settings`
- `units`, `unit_conversions`, `menu_categories`, `suppliers`
- RLS policies on all tables
- Onboarding flow (`create_restaurant_with_owner` RPC)
- Settings UI (6 tabs: General, Units, Categories, Suppliers, Thresholds, Team)

What remains mock:
- All operational pages (`/dashboard`, `/ingredients`, `/recipes`, `/menu-analytics`, `/dish-analysis`, `/impact-cascade`, `/price-log`, `/price-trend`, `/alerts`)
- All data from `src/data/mock.ts`, `src/data/selectors.ts`, `src/data/snapshots.ts`

---

## Current Blocker

**Supabase Auth session persistence is broken.**

After login, the session is lost on page refresh and when navigating between pages. `/qa-auth` shows "Auth QA requires sign in."

**Suspected root cause:** The Supabase client (`src/integrations/supabase/client.ts`) uses a Proxy singleton with a conditional `typeof window !== 'undefined' ? localStorage : undefined` check for `storage`. In this TanStack Start SSR app (deployed to Cloudflare Workers), this check may resolve incorrectly during server-side rendering, causing the singleton to cache a client with `storage: undefined`. When the browser then uses this poisoned singleton, `getSession()` cannot read from localStorage.

**Next task:** Build 1.0E — Persistent Supabase Session Hard Fix.

---

## App Structure

```
src/
├── auth/                     # AuthProvider.tsx, AuthGate.tsx
├── components/
│   ├── common/              # PageHeader, KPI cards, badges
│   ├── dish-analysis/       # Dish analysis components
│   ├── impact-cascade/      # Cascade visualization
│   ├── layout/              # AppShell, AppSidebar, Topbar
│   └── ui/                  # ~30 shadcn/ui components
├── data/
│   ├── api/                 # authApi, tenantApi, settingsApi, supabaseClient, types
│   ├── mock.ts              # Mock operational data
│   ├── selectors.ts         # Derived intelligence selectors
│   └── snapshots.ts         # Snapshot mock data
├── hooks/                   # use-mobile
├── integrations/supabase/   # client.ts, client.server.ts, auth-middleware.ts, types.ts
├── lib/                     # alerts, cascade, cogs, format, ingredientCost, margin, types, units, utils
├── routes/                  # 25 TanStack Router file-based route files
├── router.tsx               # Router factory
├── routeTree.gen.ts         # Auto-generated (DO NOT EDIT)
└── styles.css               # Tailwind
```

**Framework:** TanStack Start (SSR) + TanStack Router (file-based routing)
**Deployment:** Cloudflare Workers (`wrangler.jsonc`)
**Build config:** `@lovable.dev/vite-tanstack-config` (opaque Vite wrapper)

---

## Route Structure

| Route | Auth | Data Source |
|-------|------|-------------|
| `/login` | Public | Supabase Auth |
| `/signup` | Public | Supabase Auth |
| `/auth/callback` | Public | Supabase Auth |
| `/qa-auth` | Public | Supabase Auth + tenant |
| `/onboarding/create-restaurant` | Auth required | Supabase RPC |
| `/dashboard` | Auth + restaurant | Mock |
| `/ingredients`, `/ingredients/$id` | Auth + restaurant | Mock |
| `/recipes`, `/recipes/$id` | Auth + restaurant | Mock |
| `/dish-analysis`, `/dish-analysis/$id` | Auth + restaurant | Mock |
| `/menu-analytics` | Auth + restaurant | Mock |
| `/impact-cascade`, `/impact-cascade/$batchId` | Auth + restaurant | Mock |
| `/price-log` | Auth + restaurant | Mock |
| `/price-trend` | Auth + restaurant | Mock |
| `/alerts` | Auth + restaurant | Mock |
| `/settings` | Auth + restaurant | Supabase |
| `/qa-calculations` | Auth | Mock |
| `/qa-data-integrity` | Auth | Mock |
| `/qa-settings-admin` | Auth | Supabase |

---

## AuthProvider / AuthGate Overview

**AuthProvider** (`src/auth/AuthProvider.tsx`): Wraps entire app. Manages session, hydration state, profile, memberships, activeRestaurantId, restaurantSettings. Initializes via `onAuthStateChange` + `getSession()`. Exposes `status` (loading | unauthenticated | authenticated), `refreshAuth`, `refreshTenants`, `signOut`.

**AuthGate** (`src/auth/AuthGate.tsx`): Redirects based on auth status. Public paths: `/login`, `/signup`, `/auth/callback`, `/qa-auth`. Unauthenticated users go to `/login`. Authenticated users without restaurants go to onboarding. Authenticated users on public paths go to `/dashboard`.

---

## Supabase Clients Found

| Client | File | Purpose | Auth Config |
|--------|------|---------|-------------|
| Browser (Proxy singleton) | `src/integrations/supabase/client.ts` | All browser-side queries | `persistSession: true`, `storage: localStorage` (conditional), `autoRefreshToken: true` |
| Re-export | `src/data/api/supabaseClient.ts` | Import surface for API modules | Same as above |
| Server admin | `src/integrations/supabase/client.server.ts` | Bypass RLS (not currently used) | `persistSession: false`, service role key |
| Auth middleware | `src/integrations/supabase/auth-middleware.ts` | Per-request server auth (not currently used) | `persistSession: false`, Bearer token |

---

## Environment Variables Used

| Variable | Required | Client/Server |
|----------|----------|---------------|
| `VITE_SUPABASE_URL` | Yes | Client (build-time) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Client (build-time) |
| `SUPABASE_URL` | Yes | Server (runtime) |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Server (runtime) |
| `SUPABASE_SERVICE_ROLE_KEY` | Missing | Server admin client (not used yet) |

---

## Auth Persistence Configuration

| Setting | Value in Code | Notes |
|---------|--------------|-------|
| `persistSession` | `true` | Changed from `false` in commit c1cede9 |
| `autoRefreshToken` | `true` | |
| `storage` | `typeof window !== 'undefined' ? localStorage : undefined` | Conditional — root cause suspect |
| `detectSessionInUrl` | not set (defaults to `true`) | |

`activeRestaurantId`, role, membership, and settings are React state only — NOT in localStorage.

---

## Migrations / Tables Present

5 migration files in `supabase/migrations/`:

| Table | Scope | Build |
|-------|-------|-------|
| `profiles` | per-user | 1.0 |
| `restaurants` | per-user | 1.0 |
| `restaurant_members` | per-restaurant | 1.0 |
| `restaurant_settings` | per-restaurant | 1.0 |
| `units` | global | 1.1 |
| `unit_conversions` | global | 1.1 |
| `menu_categories` | per-restaurant | 1.1 |
| `suppliers` | per-restaurant | 1.1 |

No operational tables exist (ingredients, recipes, menu_items, price_log, etc.).

---

## QA Routes Present

| Route | Checks | Status |
|-------|--------|--------|
| `/qa-auth` | Session, profile, membership, RLS smoke, security posture | Blocked by session bug |
| `/qa-calculations` | A through S (19 checks) — unit conversions, COGS, margins, cascades | Pass (mock data) |
| `/qa-data-integrity` | Duplicate IDs, references, NaN/Infinity, impact paths | Pass (mock data) |
| `/qa-settings-admin` | A through U (21 checks) — auth, settings, reference data, RLS, roles | Blocked by session bug |

---

## Docs Present

| File | Content |
|------|---------|
| `docs/current-state.md` | Build 1.1A state (needs update) |
| `docs/supabase-plan.md` | Full Supabase architecture plan (Build 0.5B) |
| `docs/auth-tenant-foundation.md` | Auth/tenant model (Build 1.0B) |
| `docs/calculation-engine.md` | Calculation formulas and helpers |
| `docs/derived-intelligence.md` | Selector derivation patterns |
| `docs/pre-supabase-readiness.md` | Migration readiness tracker |
| `docs/rls-security-notes.md` | RLS policies and security notes |
| `docs/settings-admin-reference.md` | Settings/admin reference layer (Build 1.1) |

---

## Next Task: Build 1.0E — Persistent Supabase Session Hard Fix

**Goal:** Fix the Supabase client so that authenticated sessions survive page refresh and navigation.

**Scope:**
1. Replace the Proxy singleton in `src/integrations/supabase/client.ts` with a browser-safe client factory
2. Ensure `storage: localStorage` is always used on the client
3. Verify AuthProvider session restoration flow
4. Verify AuthGate does not redirect prematurely during hydration
5. Update `AUTH_SESSION_CONFIG` display constant
6. Pass all `/qa-auth` checks
7. Manual acceptance: login, refresh, navigate, sign out

**Guardrails:** No new tables. No schema changes. No operational data changes. No app redesign. Session tokens only — no `activeRestaurantId` / role / membership / settings in localStorage.
