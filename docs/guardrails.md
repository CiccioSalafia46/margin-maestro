# Guardrails

Strict implementation rules for Margin IQ — Restaurant Margin Intelligence SaaS.

---

## Product Scope Guardrails

- **No POS features.** This is not a point-of-sale system.
- **No ordering or delivery.** This is not an ordering platform.
- **No reservations or table management.** This is not a front-of-house tool.
- **No staff scheduling.** This is not an HR/workforce tool.
- **No supplier marketplace** until explicitly approved.
- **No AI substitutions** (ingredient/recipe suggestions) until explicitly approved.
- **No billing** until Build 2.0.
- **No redesign** of the app unless explicitly instructed.

This product is a **Margin Intelligence decision layer**. Every feature must serve the core chain: ingredients → recipes → menu analytics → price log → snapshot → impact cascade → alerts.

---

## Database Guardrails

### Table Introduction Schedule

Tables must only be added in their designated build:

| Table(s) | Build | Status |
|-----------|-------|--------|
| `profiles`, `restaurants`, `restaurant_members`, `restaurant_settings` | 1.0 | Implemented |
| `units`, `unit_conversions`, `menu_categories`, `suppliers` | 1.1 | Implemented |
| `ingredients`, `ingredient_cost_state` | 1.2 | Not started |
| `recipes`, `recipe_lines`, `recipe_dependency_edges` | 1.3 | Not started |
| `menu_items`, `menu_profitability_snapshots` | 1.4 | Not started |
| `ingredient_price_log`, `ingredient_snapshots`, `price_update_batches` | 1.5 | Not started |
| `impact_cascade_runs`, `impact_cascade_items` | 1.7 | Not started |
| `alerts`, `audit_events` | 1.8 | Not started |
| `subscriptions` | 2.0 | Not started |

### Data Integrity Rules

- **Price log is append-only.** No UPDATE policy, no DELETE policy, ever. Corrections are new rows with notes.
- **Baseline reset is non-destructive.** Bumps `baseline_version`, adds new snapshot/log rows, never deletes or overwrites existing rows.
- **Names are labels, not technical primary keys.** All primary keys are UUIDs.
- **Unique name constraints** use partial indexes: `(restaurant_id, lower(name)) WHERE deleted_at IS NULL`.
- **Soft delete** on entity tables (`deleted_at`), never on log tables.
- **Money uses `numeric(14,4)`.** Percentages stored as fractions (0..1).

---

## Auth / RLS Guardrails

- **RLS is mandatory** on every tenant-owned table. No exceptions.
- **Role checks flow through SECURITY DEFINER helpers** (`is_restaurant_member()`, `has_restaurant_role()`), never inline subqueries on `restaurant_members` (avoids recursive policy trap).
- **Roles live only in `restaurant_members`.** Never store roles on `profiles` or `auth.users`.
- **All multi-table writes** must be wrapped in a single PostgreSQL transaction via a SECURITY DEFINER PL/pgSQL helper.
- **Owner is the only role** that can update `restaurants`, `restaurant_settings`, and manage membership.
- **Sole-owner removal** is blocked by trigger on `restaurant_members`.

---

## Local Storage Guardrails

- **Do NOT store `activeRestaurantId` in localStorage.** It must remain in React state (AuthProvider).
- **Do NOT store `role` in localStorage.** It comes from `restaurant_members` via Supabase.
- **Do NOT store `membership` data in localStorage.** It comes from `listMyRestaurants()` via Supabase.
- **Do NOT store `restaurant_settings` in localStorage.** It comes from `getRestaurantSettings()` via Supabase.
- **It IS allowed** to persist the official Supabase Auth session using Supabase's supported `persistSession` + `storage: localStorage` configuration. This is the only sanctioned use of localStorage for auth/tenant data.

---

## Supabase Service-Role Guardrails

- **`SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed to client code.**
- Never alias it to a `VITE_*` variable.
- Never import `client.server.ts` in components or route files.
- `client.server.ts` is for server functions and API routes only.
- `/qa-auth` verifies `typeof import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY === "undefined"`.

---

## Operational Data Migration Guardrails

- **Do not migrate mock data to Supabase** before the planned build for that domain.
- **Do not touch `src/data/mock.ts`** except to fix bugs within the mock layer itself.
- **Do not change `src/data/selectors.ts`** unless the current build requires it.
- **Do not change `src/lib/*.ts` calculation helpers** unless the current build requires it.
- When a domain moves to Supabase, the `src/data/api/<domain>.ts` module swaps its implementation. Route components should not change.
- **Frontend calculations become preview-only** once the backend source of truth exists for that domain. Server is canonical for persisted values.

---

## UI/UX Guardrails

- Do not redesign the app layout, sidebar, topbar, or navigation structure unless explicitly instructed.
- Do not change shadcn/ui component imports or theming.
- Do not add new dependencies without explicit approval.
- Do not run whole-repo formatting unless explicitly asked.
- `routeTree.gen.ts` is auto-generated — never edit it manually.

---

## QA Guardrails

- **All QA routes must pass** after every build:
  - `/qa-auth` — Auth, tenancy, RLS, security
  - `/qa-calculations` — Calculation engine (A through S)
  - `/qa-data-integrity` — Mock data integrity
  - `/qa-settings-admin` — Settings/admin reference data (A through U)
- **Do not disable or skip QA checks** to make them pass.
- **Do not modify QA check logic** unless the underlying behavior has legitimately changed.
- QA pages are developer tools, not user-facing features.

---

## Git / Commit Guardrails

- One commit per logical change.
- Descriptive commit messages (not "Changes").
- Do not commit `.env.local` or any file containing secrets.
- Do not amend published commits.
- Do not force-push to `main`.
- Do not run `git reset --hard` without explicit user approval.
- Run `npx tsc --noEmit` before committing to catch type errors.
