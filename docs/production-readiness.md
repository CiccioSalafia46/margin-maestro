# Production Readiness — Build 2.0

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
- [ ] Production Supabase project (separate from dev)
- [ ] Production domain and hosting
- [ ] Email templates configured
- [ ] Google OAuth enabled
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
