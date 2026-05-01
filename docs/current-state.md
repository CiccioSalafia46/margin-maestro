# Current State — Build 0.5A

**Phase:** Frontend-only mock UI shell with derived intelligence + UX polish.
GitHub Checkpoint Verification — project structure, docs, and QA validated
after the GitHub connection. No new functionality; baseline is Build 0.4.
**Backend:** None. No Supabase, no Auth, no schema, no Edge Functions, no
billing, no API calls, no `localStorage` persistence.

## What is implemented

- Premium SaaS layout: collapsible sidebar, sticky topbar, demo badge.
- All MVP routes render against an Italian-restaurant mock dataset.
- Pure-helper calculation engine (`src/lib/`).
- Derived intelligence selectors (`src/data/selectors.ts`) feed the
  Dashboard, Menu Analytics, Impact Cascade, Alerts, Price Trend, and Dish
  Analysis.
- Two QA routes (`/qa-calculations` A–S, `/qa-data-integrity`).
- Documentation under `docs/`.

## Routes implemented

| Route | Purpose |
|---|---|
| `/` | Redirects to `/dashboard` |
| `/dashboard` | Alert-first overview with derived KPIs |
| `/ingredients`, `/ingredients/$id` | Ingredient database + detail |
| `/recipes`, `/recipes/$id` | Recipes list + line-level editor view |
| `/menu-analytics` | Per-dish GPM, GP, COGS, Δ vs snapshot |
| `/dish-analysis`, `/dish-analysis/$id` | Per-dish deep dive + scenario |
| `/impact-cascade`, `/impact-cascade/$batchId` | Latest cascade + history |
| `/price-trend` | Per-ingredient unit-cost history |
| `/price-log` | Append-only log (read-only UI) |
| `/alerts` | Derived alerts from selectors |
| `/settings` | Restaurant config + Developer QA links |
| `/qa-calculations` | Calculation engine pass/fail (A–S) |
| `/qa-data-integrity` | Reference & integrity checks |

## Known limitations

- All write actions are UI-only and toast "Demo only — …".
- "Run Price Update" is intentionally disabled until backend exists.
- Alerts cannot be acknowledged/resolved (no persistence).
- Snapshots are static — no "baseline reset" workflow.
- Price Log cannot be appended through the UI.
- No multi-restaurant tenancy, no auth, no roles.
- Mobile is functional but not polished.
