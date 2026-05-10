# Production Readiness — Build 2.8A (live)

> **Live since Build 2.8A.** App deployed at https://margin-maestro.vercel.app via Vercel project `margin-maestro`. Backend remains `margin-maestro-dev` (`atdvrdhzcbtxvzgvoxhb`) by explicit user choice. Migration to `margin-maestro-prod` is recommended for wider rollout (OI-16, Build 3.2). See `docs/live-deployment.md` for the operational runbook.

---

## Build 2.0 baseline (preserved below)

## MVP Status

All core operational modules are Supabase-backed or Supabase-derived:

| Module | Status |
|--------|--------|
| Auth / Tenant | Accepted |
| Settings / Admin | Accepted |
| Ingredients | Accepted |
| Recipes | Accepted |
| Menu Analytics | Accepted (derived) |
| Price Log + Snapshot | Accepted |
| Price Update Batch | Accepted |
| Price Trend | Accepted (derived) |
| Dish Analysis | Accepted (derived) |
| Impact Cascade | Accepted |
| Alerts | Accepted |
| Dashboard | Accepted (derived) |

## Pre-Production Requirements

### Completed
- [x] All operational pages Supabase-backed
- [x] RLS on all 18 tables
- [x] No service role key in client code
- [x] No tenant authorization in localStorage
- [x] Append-only price log (no update/delete)
- [x] TypeScript type-safe codebase
- [x] QA routes for every module
- [x] Security review documented
- [x] Deployment guide documented
- [x] Beta checklist documented

### Not Yet Complete
- [ ] Production Supabase project (separate from dev) — **Build 3.2** (OI-16). Currently reusing dev by explicit choice.
- [x] Production domain and hosting — Vercel `margin-maestro` at https://margin-maestro.vercel.app (Build 2.8A).
- [ ] Email templates configured (default Supabase templates active).
- [x] Google OAuth enabled and live verified — Build 2.8A.
- [ ] Stripe test-mode verification — **Build 2.2B** (OI-17).
- [ ] Sentry DSN configured — **Build 3.3** (OI-19).
- [ ] Transactional invite emails — **Build 3.1** (OI-20).
- [ ] Google OAuth production hardening (consent screen review) — OI-21.
- [ ] Team management (invites, role changes)
- [ ] Billing integration
- [ ] Error monitoring (Sentry or similar)
- [ ] Automated E2E tests
- [ ] Backup and restore policy
- [ ] Apply Price workflow
- [ ] CSV import/export

## Database Schema (18 tables)

profiles, restaurants, restaurant_members, restaurant_settings, units, unit_conversions, menu_categories, suppliers, ingredients, ingredient_cost_state, recipes, recipe_lines, price_update_batches, ingredient_price_log, ingredient_snapshots, impact_cascade_runs, impact_cascade_items, alerts.

## Known Limitations

- Cost state computed client-side (server-side source of truth in future)
- Batch apply is client-orchestrated (not atomic DB transaction)
- Per-serving metrics only (no sales volume/monthly revenue)
- Scenario modeling is local-only (not persisted)
- Suggested prices are informational only (no Apply action)
- Normal ingredient edits do not write price log entries (by design)
- Alert generation is manual (not automatic on price update)
