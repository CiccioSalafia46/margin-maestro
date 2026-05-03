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

---

## Build 1.1A — Settings/Admin Acceptance

**Status:** Accepted

- Re-accepted Settings/Admin reference data layer now that Auth session persistence is stable (Build 1.0F).
- `/qa-settings-admin` checks A through U verified.
- Settings page 6 tabs verified: General, Units & Conversions, Menu Categories, Suppliers, Alert Thresholds, Team.
- Role-based access: owner can edit settings/thresholds, owner/manager can manage categories/suppliers, viewer is read-only.
- Units (Ct, Gr, Kg, Lb, Oz, Ml, Lt, Gl) and unit conversions are read-only global reference data.
- Default menu categories and suppliers seeded on restaurant creation.
- Duplicate name handling verified for categories and suppliers.
- RLS tenant scoping verified for menu_categories and suppliers.
- No service-role key exposed to client.
- No operational tables created.
- Team tab remains placeholder/read-only.
- Build label updated to "Build 1.1A — Settings/Admin Accepted".

**Known limitations:**
- Custom unit management not exposed (units are read-only).
- Suppliers not linked to ingredients yet (Build 1.2).
- Team management is placeholder — no invites or role changes.
- Restaurant switcher limited to in-memory re-pointing.
- Google OAuth not enabled.

---

## Build 1.2 — Ingredients Database

**Status:** Implemented

- **Migration:** `ingredients` and `ingredient_cost_state` tables with RLS, updated_at triggers, case-insensitive unique name index.
- **API:** `src/data/api/ingredientsApi.ts` — getIngredients, getIngredientById, createIngredient, updateIngredient, deactivateIngredient, calculateCostState, upsertIngredientCostState, getIngredientCostStates.
- **Types:** `IngredientRow`, `IngredientCostStateRow`, `IngredientWithCostState`, `IngredientInput`, `IngredientPatch` in `types.ts`.
- **Generated types:** `src/integrations/supabase/types.ts` updated with new tables.
- **Routes:** `/ingredients` and `/ingredients/$id` rewritten from mock to Supabase.
- **Add form:** Drawer with type-conditional fields (Primary/Fixed/Intermediate).
- **Cost calculation:** Uses existing pure helpers from `src/lib/ingredientCost.ts` and `src/lib/units.ts`, persists result to `ingredient_cost_state`.
- **QA:** `/qa-ingredients` with checks A–T.
- **Developer QA link:** Added to Settings → Developer QA.
- **RLS:** Members select, owner/manager insert/update. No delete policy (soft delete via `is_active`).
- Suppliers linked via FK to `suppliers` table.
- Deactivation via `is_active = false`.

**Limitations:**
- Cost state computed client-side (server-side source of truth in future build).
- Intermediate ingredient costs pending (awaiting Build 1.3 Recipes).
- Price Log/Snapshot not yet available (Build 1.5).
- Edit form not yet implemented (placeholder).
- Dashboard and other operational pages still use mock data.

---

## Build 1.2A — Ingredients Acceptance

**Status:** Accepted

- Verified on self-owned Supabase project `margin-maestro-dev` (migrated from Lovable Cloud).
- All migrations (1.0 through 1.2) applied successfully to the new project.
- Primary ingredient cost state: calculated, valid.
- Fixed ingredient cost state: manual, valid.
- Intermediate ingredient cost state: pending (awaiting Build 1.3).
- `/qa-settings-admin` check U updated to accept Build 1.2 tables (ingredients, ingredient_cost_state).
- `/qa-auth` operational data warning updated to reflect partial migration.
- `/qa-ingredients` warnings clarified as manual/role-dependent, not product failures.
- Build label updated to "Build 1.2A — Ingredients Accepted".

---

## Build 1.3 — Recipes

**Status:** Implemented

- **Migration:** `recipes` and `recipe_lines` tables with RLS, updated_at triggers, case-insensitive unique name index.
- **API:** `src/data/api/recipesApi.ts` — getRecipes, getRecipeById, createRecipe, updateRecipe, deactivateRecipe, replaceRecipeLines, calculateRecipeMetrics, updateLinkedIntermediateIngredientCostState, detectCycle.
- **Types:** `RecipeRow`, `RecipeLineRow`, `RecipeWithLines`, `RecipeMetrics`, `RecipeLineCost`, `RecipeInput`, `RecipePatch`, `RecipeLineInput` in `types.ts`.
- **Generated types:** `src/integrations/supabase/types.ts` updated with recipes + recipe_lines.
- **Routes:** `/recipes` and `/recipes/$id` rewritten from mock to Supabase.
- **Recipe list:** Tabs (Dishes / Intermediates) with COGS, cost/serving, GPM, on-target.
- **Recipe detail:** Line editor (add/remove/edit ingredient lines), live totals panel, cycle detection.
- **Intermediate propagation:** Saving an intermediate recipe updates linked ingredient's cost_state.
- **Cycle detection:** Blocks circular intermediate dependencies before save.
- **QA:** `/qa-recipes` with checks A–V.
- **Developer QA link:** Added to Settings → Developer QA.
- **RLS:** Members select, owner/manager insert/update. Lines also allow delete.

**Limitations:**
- Menu Analytics (menu_items) awaits Build 1.4.
- Price Log/Snapshot awaits Build 1.5.
- Dashboard and other operational pages still use mock data.
- Full recipe edit form (name, category, serving) is future scope.

---

## Build 1.3A — Recipes Acceptance

**Status:** Accepted

- Verified on self-owned Supabase project `margin-maestro-dev`.
- Dish recipes: COGS, cost/serving, GP, GPM, suggested price compute correctly.
- Intermediate recipes: cost propagation updates linked ingredient_cost_state.
- Cycle detection blocks circular intermediate dependencies.
- `/qa-recipes` checks A–V verified (PASS or acceptable WARN for role-dependent checks).
- `/qa-settings-admin` check U updated to accept Build 1.3 tables.
- `/qa-auth` operational data warning updated to reflect Build 1.3.
- Build label updated to "Build 1.3A — Recipes Accepted".

---

## Build 1.3B — Recipes Edit Complete

**Status:** Accepted

- Full recipe field editing on /recipes/$id (name, category, serving, menu price, linked ingredient, notes).
- Save updates both recipe row and recipe lines in one flow.
- Intermediate cost propagation on save.

---

## Build 1.4 — Menu Analytics

**Status:** Implemented

- **No new migration.** Menu Analytics is derived from existing tables.
- **API:** `src/data/api/menuAnalyticsApi.ts` — deriveMenuAnalyticsRows, deriveMenuAnalyticsSummary, getMenuAnalyticsData.
- **Types:** `MenuAnalyticsRow`, `MenuAnalyticsSummary`, `MenuAnalyticsStatus` in `types.ts`.
- **Route:** `/menu-analytics` rewritten from mock to Supabase-derived data.
- **KPI cards:** Average GPM, Average GP, Top/Bottom performer, Below target count.
- **Table:** Dish, Category, Menu Price, COGS/serving, GP, GPM, Target, Suggested Price, Status.
- **Filters:** Below target only, Category, Missing price / Incomplete costing.
- **QA:** `/qa-menu-analytics` with checks A–U.
- **Developer QA link:** Added to Settings → Developer QA.

**Limitations:**
- No snapshot deltas (Δ COGS, Δ GPM) — arrives in Build 1.5.
- Suggested price is informational only — no Apply action yet.
- Dashboard and other operational pages still use mock data.

---

## Build 1.4A — Menu Analytics Acceptance

**Status:** Accepted

- Verified on self-owned Supabase project `margin-maestro-dev`.
- Menu Analytics derived from live Supabase data — no new tables.
- KPIs, per-dish profitability table, suggested prices verified.
- `/qa-menu-analytics` checks A–U verified (PASS or acceptable WARN).
- Build label updated to "Build 1.4A — Menu Analytics Accepted".
