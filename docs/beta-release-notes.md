# Beta Release Notes — Margin IQ

## What's Included

**Margin IQ** is a Restaurant Margin Intelligence SaaS for independent restaurant operators. This beta includes the complete core chain:

- **Ingredients** — Primary, Fixed, Intermediate with cost calculations
- **Recipes** — Dish and Intermediate with line editor and COGS
- **Menu Analytics** — GPM, GP, target comparison, suggested pricing
- **Price Log** — Append-only audit trail with baseline initialization
- **Price Update Batches** — Controlled supplier price updates
- **Price Trend** — Per-ingredient cost history and charts
- **Dish Analysis** — COGS breakdown, scenario modeling, margin manager
- **Impact Cascade** — Dish-level margin impact from supplier price changes
- **Alerts** — Operator-facing recommendations with status workflow
- **Dashboard** — Alert-first overview with KPIs and recommended actions
- **Apply Price** — Update dish menu prices from suggested values
- **CSV Import/Export** — Ingredient import with preview, 5 dataset exports
- **Team Management** — Invite by link, role assignment, sole owner protection
- **Billing Foundation** — Stripe tables + Edge Function stubs (requires Stripe key setup)
- **Settings/Admin** — Units, categories, suppliers, thresholds, team, billing, import/export

## What's Intentionally Not Included

- Google OAuth (email/password only)
- Transactional invite emails (copy link manually)
- Stripe production billing (test-mode setup required)
- POS/external menu publishing
- XLS/XLSM import
- Recipe CSV import
- Monitoring/error logging vendor
- Supplier Marketplace
- Multi-location management

## Known Limitations

- Cost calculations are client-side (server-side source of truth in future)
- Price update batch apply is client-orchestrated (not atomic DB transaction)
- Per-serving metrics only (no sales volume/monthly revenue)
- Scenario modeling is local-only (not persisted)
- Apply Price updates Margin Maestro only, not POS
- Alert generation is manual (not automatic on price update)
- Invitation emails must be shared manually via link

## Reporting Issues

Contact the development team with:
- Steps to reproduce
- Expected vs actual behavior
- Browser console errors if visible
- QA route screenshot if relevant
