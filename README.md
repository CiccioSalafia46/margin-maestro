# Margin IQ — Restaurant Margin Intelligence Platform

A decision layer for independent restaurant operators. Existing systems tell
operators **what happened**. Margin IQ tells them **what to do next** when a
supplier price moves: which dishes are affected, how much COGS and GPM
changed, which dishes are now below target, and what menu price restores
the target margin.

> **Not** a POS, inventory system, or generic recipe-costing tool.

## Current build

**Build 0.5A — GitHub Checkpoint Verification.**

Frontend-only mock UI shell with a derived-intelligence selector layer and
QA suites. No backend. No Supabase. No authentication. No database. No
billing. No API calls. No `localStorage` persistence. All write actions are
demo-only and toast `"Demo only — no changes persisted"`.

## Tech stack

- TanStack Start v1 (React 19, file-based routing, SSR-capable)
- Vite 7
- Tailwind CSS v4 (tokens in `src/styles.css`)
- shadcn/ui + Radix primitives

## Run locally

```bash
bun install
bun run dev      # http://localhost:5173
bun run build
bun run lint
```

## Project layout

```
src/
  lib/         pure calculation helpers (units, cogs, margin, cascade, alerts)
  data/        mock source data + derived selectors
  routes/      file-based pages (TanStack Router)
  components/  layout, common, feature, and shadcn/ui components
docs/          calculation engine, derived intelligence, readiness notes
```

## Main routes

| Route | Purpose |
|---|---|
| `/` → `/dashboard` | Alert-first overview with derived KPIs |
| `/ingredients`, `/ingredients/$id` | Ingredient database + detail |
| `/recipes`, `/recipes/$id` | Recipes list + line-level editor view |
| `/menu-analytics` | Per-dish GPM, GP, COGS, Δ vs snapshot |
| `/dish-analysis`, `/dish-analysis/$id` | Per-dish deep dive + scenario |
| `/impact-cascade`, `/impact-cascade/$batchId` | Latest cascade + history |
| `/price-trend` | Per-ingredient unit-cost history |
| `/price-log` | Append-only log (read-only UI) |
| `/alerts` | Derived alerts |
| `/settings` | Restaurant config + Developer QA links |

## QA routes

| Route | What it covers |
|---|---|
| `/qa-calculations` | Calculation engine checks A–S (units, COGS, margin, cascade, summary consistency) |
| `/qa-data-integrity` | Reference, uniqueness, and derived-data integrity checks |

Both are linked from **Settings → Developer QA** and are intentionally not
in the main sidebar.

## Documentation

- [`docs/current-state.md`](./docs/current-state.md) — what's implemented today
- [`docs/calculation-engine.md`](./docs/calculation-engine.md) — formulas + helpers
- [`docs/derived-intelligence.md`](./docs/derived-intelligence.md) — selector layer
- [`docs/pre-supabase-readiness.md`](./docs/pre-supabase-readiness.md) — target schema, RLS, Edge Functions

## Current limitations

- No persistence — refresh resets all UI state.
- All write actions are UI-only (Add Ingredient, Add Recipe, Apply Suggested
  Price, Override, Defer, Acknowledge, Resolve).
- "Run Price Update" is intentionally disabled until backend exists.
- Snapshots are static — no baseline-reset workflow.
- Price Log cannot be appended through the UI.
- No multi-restaurant tenancy, no auth, no roles.
- Mobile is functional but not polished.

## Future Supabase phase (overview)

The next major phase introduces Lovable Cloud (Supabase) for persistence,
auth, and server-side calculation. Planned tables include `restaurants`,
`restaurant_members`, `ingredients`, `ingredient_price_log`,
`ingredient_snapshots`, `recipes`, `recipe_lines`, `menu_items`,
`price_update_batches`, `impact_cascade_runs`, `alerts`. Critical operations
(`run_price_update_batch`, `recalculate_restaurant_costs`,
`generate_impact_cascade`, `generate_alerts_for_restaurant`) move to Edge
Functions. Every tenant table will be RLS-protected; roles live in a
separate `restaurant_members` table behind a `SECURITY DEFINER` helper.
See [`docs/pre-supabase-readiness.md`](./docs/pre-supabase-readiness.md).
