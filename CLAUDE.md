# CLAUDE.md — Working Instructions for Claude Code

## Product

**Margin IQ** — Restaurant Margin Intelligence SaaS.

This is NOT POS, NOT inventory, NOT ordering, NOT reservations, NOT delivery, NOT staff scheduling, NOT table management, NOT a restaurant marketing website.

It is a **Margin Intelligence decision layer** for independent restaurant operators. It answers: "Which dishes are affected when supplier prices move?"

### Core business chain

```
ingredients → intermediate recipes → dish recipes →
menu analytics → price log → snapshot → impact cascade → alerts
```

## Current Status

- **Branch:** `build-1.0e-auth-session-fix`
- **Accepted baseline:** Build 1.1 (Settings/Admin reference data) is implemented but pending re-acceptance after Auth fix.
- **Current blocker:** Supabase Auth session persistence is broken. After login, the session is lost on refresh and page navigation. `/qa-auth` shows "Auth QA requires sign in."
- **Next task:** Build 1.0E — Persistent Supabase Session Hard Fix.

## Architecture

- **Framework:** TanStack Start (SSR) + TanStack Router (file-based routing)
- **Deployment:** Cloudflare Workers
- **UI:** React 19, shadcn/ui, Tailwind CSS 4
- **Backend:** Supabase (Auth + Postgres + RLS)
- **Build tool:** Vite 7 via `@lovable.dev/vite-tanstack-config`
- **Operational data:** Still mock (`src/data/mock.ts`). Not yet in Supabase.

## Strict Guardrails

### Database — Do Not Add Tables Before Their Build

| Table(s) | Earliest Build |
|-----------|---------------|
| `ingredients`, `ingredient_cost_state` | Build 1.2 |
| `recipes`, `recipe_lines`, `recipe_dependency_edges` | Build 1.3 |
| `menu_items`, `menu_profitability_snapshots` | Build 1.4 |
| `ingredient_price_log`, `ingredient_snapshots`, `price_update_batches` | Build 1.5 |
| Impact cascade persistence (`impact_cascade_runs`, `impact_cascade_items`) | Build 1.7 |
| Alerts persistence (`alerts`, `audit_events`) | Build 1.8 |
| Billing / subscriptions | Build 2.0 |

### Auth & Security

- **Do not expose `SUPABASE_SERVICE_ROLE_KEY`** to client code. Never alias it to `VITE_*`. Never import `client.server.ts` in components.
- **Do not store `activeRestaurantId`, role, membership, or settings in `localStorage`.**
- Authorization must come from **Supabase Auth + RLS + `restaurant_members`**, never from client storage.
- It IS allowed to persist the official Supabase Auth session using Supabase's supported `persistSession` + `storage` configuration.
- RLS is mandatory for every tenant-owned table.

### Operational Data

- **Do not migrate operational mock data to Supabase** before the planned build.
- **Do not redesign the app** unless explicitly instructed.
- Operational pages (`/dashboard`, `/ingredients`, `/recipes`, `/menu-analytics`, `/dish-analysis`, `/impact-cascade`, `/price-log`, `/price-trend`, `/alerts`) read from `src/data/mock.ts` until their respective builds.

### Product Scope

- No POS features.
- No ordering / delivery.
- No reservations / table management.
- No staff scheduling.
- No supplier marketplace until explicitly approved.
- No AI substitutions until explicitly approved.
- No billing until Build 2.0.

## Implementation Philosophy

- **Mock-first, then Supabase.** Frontend helpers stay as preview logic after backend lands.
- **Server is source of truth** for persisted values. Frontend calculations become preview-only once backend exists for that domain.
- **Price log is append-only.** No UPDATE, no DELETE, ever.
- **Baseline reset is non-destructive.** Bumps `baseline_version`, adds new rows, never deletes history.
- **Names are labels, not keys.** Technical primary keys are UUIDs.
- Each build is independently shippable and acceptance-tested.

## Coding Rules

- Use TypeScript strict mode. Run `npx tsc --noEmit` before committing.
- Do not add features beyond the current build scope.
- Do not refactor code outside the current build's touched files.
- Do not run whole-repo formatting unless explicitly asked.
- Do not modify `routeTree.gen.ts` — it is auto-generated.
- Prefer editing existing files over creating new ones.
- Do not add new dependencies without explicit approval.

## QA Expectations

- `/qa-auth` — Auth, tenancy, RLS, security posture.
- `/qa-calculations` — Calculation engine checks A through S.
- `/qa-data-integrity` — Mock data reference integrity.
- `/qa-settings-admin` — Settings/admin reference data checks A through U.
- All QA routes must pass after every build.
- Do not disable or skip QA checks to make them pass.

## Commit Discipline

- One commit per logical change.
- Descriptive commit messages (not "Changes").
- Do not commit `.env.local` or secrets.
- Do not amend published commits.
- Do not force-push to `main`.

## Roadmap Summary

```
Build 1.0E  → Auth session persistence fix (CURRENT BLOCKER)
Build 1.0F  → Auth acceptance final
Build 1.1A  → Settings/Admin re-acceptance
Build 1.2   → Ingredients database
Build 1.3   → Recipes + recipe lines
Build 1.4   → Menu analytics persistence
Build 1.5   → Price log + snapshot
Build 1.6   → Recalculation cascade
Build 1.7   → Impact cascade persistence
Build 1.8   → Alerts persistence
Build 1.9   → CSV import/export
Build 2.0   → Billing
```

## Key Files

| Purpose | Path |
|---------|------|
| Supabase browser client | `src/integrations/supabase/client.ts` |
| Client re-export | `src/data/api/supabaseClient.ts` |
| Auth provider | `src/auth/AuthProvider.tsx` |
| Route guard | `src/auth/AuthGate.tsx` |
| Root route | `src/routes/__root.tsx` |
| Mock data | `src/data/mock.ts` |
| Calculation helpers | `src/lib/*.ts` |
| Derived selectors | `src/data/selectors.ts` |
| API layer | `src/data/api/*.ts` |
| Migrations | `supabase/migrations/*.sql` |

## Do-Not-Touch List (Until Approved)

- `src/data/mock.ts` — Do not migrate to Supabase.
- `src/data/selectors.ts` — Do not change selector logic.
- `src/data/snapshots.ts` — Do not change snapshot data.
- `src/lib/*.ts` — Do not change calculation helpers.
- `src/routes/qa-calculations.tsx` — Do not modify QA checks.
- `src/routes/qa-data-integrity.tsx` — Do not modify QA checks.
- `supabase/migrations/` — Do not add new migrations until Build 1.0E or later if needed.
- `routeTree.gen.ts` — Auto-generated, never edit.
