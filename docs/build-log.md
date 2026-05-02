# Build Log

Historical record of builds for Margin IQ — Restaurant Margin Intelligence SaaS.

---

## Build 0.1 — Frontend-only Mock UI Shell

**Status:** Accepted

- UI shell with sidebar navigation, topbar, AppShell layout
- TanStack Router file-based routing for all operational pages
- Mock data layer (`src/data/mock.ts`) with demo Italian restaurant
- Pages: dashboard, ingredients, recipes, dish analysis, menu analytics, impact cascade, price log, price trend, alerts
- No backend, no auth, no Supabase

---

## Build 0.2 — Calculation Core & QA Hardening

**Status:** Accepted

- Unit of measure helpers (`src/lib/units.ts`): mass (Gr, Kg, Lb, Oz), volume (Ml, Lt, Gl), count (Ct)
- Ingredient cost helpers (`src/lib/ingredientCost.ts`): original unit cost, recipe quantity, recipe unit cost
- Recipe COGS helpers (`src/lib/cogs.ts`): line costs, cost per serving
- Margin helpers (`src/lib/margin.ts`): GP, GPM, on-target, suggested menu price
- Impact cascade helpers (`src/lib/cascade.ts`): ratio method, direct/indirect pathways
- `/qa-calculations` checks A through J: unit conversions, trim loss, blocked conversions, density, adjustment validation, zero price handling, purity

---

## Build 0.3 — Derived Intelligence Layer

**Status:** Accepted

- Derived selectors (`src/data/selectors.ts`): dashboard KPIs, menu analytics rows, impact cascade, alerts, price trends
- Dashboard KPIs: avg GPM, below-target count, ingredient spike count, profit at risk
- Alert derivation: dish below target, ingredient spike, price review needed, intermediate cost shift
- Impact cascade builder from price log + snapshots
- Snapshot mock data (`src/data/snapshots.ts`): prior unit costs, estimated monthly units sold
- `/qa-calculations` checks extended (K through R)

---

## Build 0.3C — Derived Intelligence Consistency Fixes

**Status:** Accepted

- Batch summary consistency: latest cascade summary matches batch history
- No duplicate dish double-counting in batch summary
- Impact metric labeling: per-serving vs. monthly, has_sales_data flags
- `/qa-calculations` checks S added (no duplicate dish double-counting)

---

## Build 0.4 — UX Polish & Pre-Supabase Readiness

**Status:** Accepted

- Documentation: `docs/calculation-engine.md`, `docs/derived-intelligence.md`
- UX polish across operational pages
- Accessibility improvements
- Empty states for pages without data
- `docs/pre-supabase-readiness.md`: migration readiness tracker

---

## Build 0.5A — GitHub Checkpoint

**Status:** Accepted

- Repository readiness
- Project cleanup
- Git history established

---

## Build 0.5B — Supabase Architecture Planning

**Status:** Accepted (planning only, no code changes)

- `docs/supabase-plan.md`: comprehensive phased backend plan
- Database schema design for all planned tables
- RLS policy plan
- Server-side function specifications
- Migration strategy from mock data
- Risk list (15 identified risks with mitigations)

---

## Build 1.0 — Auth + Tenant Foundation

**Status:** Implemented, stabilized through 1.0D

- **Migration 1:** `profiles`, `restaurants`, `restaurant_members`, `restaurant_settings` tables
- **Migration 2-4:** Permission cleanup and hardening for SECURITY DEFINER functions
- RLS policies on all tables
- SECURITY DEFINER helpers: `is_restaurant_member()`, `has_restaurant_role()`, `create_restaurant_with_owner()`
- Trigger: `on_auth_user_created` (auto-create profile)
- Trigger: `protect_sole_owner` (prevent last-owner removal)
- Auth UI: `/login`, `/signup`, `/auth/callback`
- Onboarding: `/onboarding/create-restaurant`
- AuthProvider context with session, profile, memberships, activeRestaurantId
- AuthGate route guard with redirect logic
- `/qa-auth` diagnostic page

---

## Build 1.0A/B/C/D — Auth Stabilization Attempts

**Status:** Partially resolved

- **1.0A:** Fixed HTTP 500 from wrong env var naming
- **1.0B:** Removed `localStorage activeRestaurantId` — now React state only
- **1.0C:** Improved signup feedback and error handling
- **1.0D:** Various auth flow fixes
- **Remaining blocker:** Session persistence — session is lost on refresh/navigation

---

## Build 1.1 — Settings/Admin Reference Data

**Status:** Implemented, pending re-acceptance after Auth fix

- **Migration 5:** `units`, `unit_conversions`, `menu_categories`, `suppliers` tables
- Default units seeded: Ct, Gr, Kg, Lb, Oz, Ml, Lt, Gl
- Unit conversions seeded: same-family pairs with correct factors
- `initialize_restaurant_reference_data()` function: seeds default categories and suppliers on restaurant creation
- Settings page with 6 tabs: General, Units & Conversions, Menu Categories, Suppliers, Alert Thresholds, Team
- Role-based access: owner can edit settings, owner/manager can manage reference data
- API layer: `src/data/api/settingsApi.ts` — CRUD for settings, units, categories, suppliers
- `/qa-settings-admin` checks A through U

**Note:** Build 1.1 is implemented. Re-acceptance (Build 1.1A) is next now that Auth works.

---

## Build 1.0E — Persistent Supabase Session Hard Fix

**Status:** Accepted (merged into 1.0F)

- Removed Proxy singleton from `src/integrations/supabase/client.ts`
- Removed explicit `storage: typeof window !== 'undefined' ? localStorage : undefined` — was passing `storage: undefined` during SSR, overriding Supabase's built-in localStorage default
- Now uses Supabase's default storage detection (localStorage in browser, in-memory on server)
- Added `detectSessionInUrl: true` explicitly
- Auth config: `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`

---

## Build 1.0E-A — Auth QA Loading and Route Guard Fix

**Status:** Accepted (merged into 1.0F)

- Removed `/qa-auth` from `PUBLIC_PATHS` in AuthGate
- `/qa-auth` was being treated as an auth-flow page, causing authenticated users to be redirected to `/dashboard`
- Now only `/login`, `/signup`, `/auth/callback` redirect authenticated users away
- `/qa-auth` is a protected route: unauthenticated → `/login`, authenticated → stays on page

---

## Build 1.0F — Auth Acceptance Final

**Status:** Accepted

- Build label updated to "Build 1.0F — Auth Accepted"
- Session persistence verified: survives refresh and navigation
- Sign out clears session and redirects to `/login`
- `/qa-auth` accessible as protected diagnostic route
- No `activeRestaurantId`, role, membership, or settings in localStorage
- Documentation updated
- Previous blocker resolved
