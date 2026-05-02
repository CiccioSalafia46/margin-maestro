# Architecture Overview

High-level architecture for Margin IQ — Restaurant Margin Intelligence SaaS.

---

## Frontend Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start (SSR) + TanStack Router (file-based routing) |
| UI library | React 19 |
| Components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| Forms | react-hook-form + zod |
| State | React Context (AuthProvider) + React Query |
| Build | Vite 7 via `@lovable.dev/vite-tanstack-config` |
| Deployment | Cloudflare Workers |

---

## Route Categories

### Public Routes
`/login`, `/signup`, `/auth/callback`, `/qa-auth`

No authentication required. AuthGate allows these paths through.

### Onboarding Route
`/onboarding/create-restaurant`

Requires authentication but no restaurant membership. Users with zero memberships are redirected here.

### Operational Routes (Mock Data)
`/dashboard`, `/ingredients`, `/recipes`, `/dish-analysis`, `/menu-analytics`, `/impact-cascade`, `/price-log`, `/price-trend`, `/alerts`

Require authentication + at least one restaurant membership. Currently render from `src/data/mock.ts`.

### Settings Route (Live Supabase)
`/settings`

Requires authentication + restaurant. Reads/writes to Supabase tables (`restaurant_settings`, `units`, `unit_conversions`, `menu_categories`, `suppliers`).

### QA Routes
`/qa-auth`, `/qa-calculations`, `/qa-data-integrity`, `/qa-settings-admin`

Developer diagnostics. `/qa-auth` is public; others require authentication.

---

## App Shell

```
__root.tsx
├── RootShell          ← SSR HTML shell (<html>, <head>, <body>)
└── RootComponent
    ├── AuthProvider   ← Session state, tenant data, context
    │   ├── AuthGate   ← Redirect logic
    │   │   └── Outlet ← Active route component
    │   └── Toaster    ← Toast notifications
```

All authenticated routes render inside `AppShell` (sidebar + topbar layout).

---

## Data Layers

### 1. Mock Data Layer
**Location:** `src/data/mock.ts`, `src/data/snapshots.ts`

Contains the demo Italian restaurant dataset: ingredients, recipes, recipe lines, menu items, price batches, cost states, and snapshots. Used by all operational pages.

### 2. Calculation Helpers
**Location:** `src/lib/*.ts`

Pure, stateless functions for business logic:
- `units.ts` — UoM families, conversion factors, compatibility checks
- `ingredientCost.ts` — Original unit cost, recipe unit cost with conversion + adjustment
- `cogs.ts` — Recipe line costs, COGS per serving
- `margin.ts` — GP, GPM, on-target, suggested menu price
- `cascade.ts` — Impact cascade ratio method, direct/indirect pathways
- `alerts.ts` — Alert derivation from menu analytics + price log + cascade
- `format.ts` — Display formatting (money, percentages, unit costs)

These helpers are **preview-only** once backend source of truth exists. Server is canonical for persisted values.

### 3. Derived Intelligence Selectors
**Location:** `src/data/selectors.ts`

Transform source data into dashboard KPIs, menu analytics rows, impact cascade summaries, alerts, and price trend statistics. Currently consume mock data; will swap to Supabase reads as domains migrate.

### 4. Supabase Auth/Tenant Layer
**Location:** `src/auth/AuthProvider.tsx`, `src/auth/AuthGate.tsx`, `src/data/api/authApi.ts`, `src/data/api/tenantApi.ts`

Manages authentication, session, profile, memberships, and active restaurant context. Reads from Supabase `profiles`, `restaurants`, `restaurant_members`, `restaurant_settings`.

### 5. Settings/Admin Supabase Layer
**Location:** `src/data/api/settingsApi.ts`

CRUD for `restaurant_settings`, `units`, `unit_conversions`, `menu_categories`, `suppliers`. All calls go through the browser Supabase client with RLS enforcement.

---

## Core Architecture Separation

```
┌─────────────────────────────────────────────────┐
│                 UI Presentation                  │
│  Routes → Components → shadcn/ui + Recharts     │
├─────────────────────────────────────────────────┤
│              Derived Intelligence                │
│  Selectors → KPIs, Analytics, Cascades, Alerts  │
├─────────────────────────────────────────────────┤
│             Calculation Helpers                   │
│  units, ingredientCost, cogs, margin, cascade    │
├─────────────────────────────────────────────────┤
│               Source Data                        │
│  Mock (now) → Supabase (future per build)       │
├─────────────────────────────────────────────────┤
│           Supabase Persistence                   │
│  Auth, Profiles, Restaurants, Settings, RLS     │
├─────────────────────────────────────────────────┤
│            RLS Authorization                     │
│  restaurant_members → has_restaurant_role()      │
├─────────────────────────────────────────────────┤
│     Future: Server-Side Business Operations      │
│  recalculate_costs, run_batch, generate_cascade  │
└─────────────────────────────────────────────────┘
```

---

## Migration Approach

1. **Data-access layer** (`src/data/api/*.ts`) is the single import surface for routes and components.
2. **Phase-by-phase swap:** As each build lands a domain in Supabase, the corresponding API module switches from mock selectors to Supabase queries. Route components do not change.
3. **Calculation helpers persist** as frontend preview logic — used in Dish Analysis scenarios, optimistic UI, and form previews.
4. **Server is source of truth** for any persisted COGS, GPM, snapshots, cascades, and alerts.
5. **QA pages survive** each migration and validate both helpers and live backend data.

---

## Server-Side Source of Truth Principle

Once a domain moves to Supabase:
- The **server** is canonical for persisted values (costs, COGS, GPM, snapshots, cascades, alerts).
- The **browser** must never write to server-managed tables (`ingredient_cost_state`, `ingredient_snapshots`, `ingredient_price_log`, `impact_cascade_*`, `alerts`).
- Frontend calculations become **preview-only** — used for form previews and what-if scenarios, not persisted.

---

## Future Backend Calculation Principle

Server-side functions (TanStack Start `createServerFn` or PL/pgSQL) will handle:
- `recalculate_ingredient_unit_cost()` — Compute recipe_unit_cost from ingredient parameters
- `recalculate_recipe_cogs()` — Compute COGS per serving from recipe lines
- `recalculate_restaurant_costs()` — Full restaurant cost recalculation
- `run_price_update_batch()` — Atomic price update with cascade
- `generate_impact_cascade()` — Impact analysis per batch
- `generate_alerts_for_restaurant()` — Alert derivation
- `initialize_restaurant_baseline()` — First baseline setup
- `reset_baseline_non_destructive()` — Version bump, never delete

All multi-table writes are wrapped in a single PostgreSQL transaction for atomicity.
