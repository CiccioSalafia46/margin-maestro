# Derived Intelligence

The mock store (`src/data/mock.ts`) holds **source data only**: ingredients,
recipes, snapshots, price log entries, batches. Everything the UI shows as
"intelligence" is derived on demand by selectors in
`src/data/selectors.ts` — never hardcoded in route components.

## Source vs derived

| Source (mock) | Derived (selectors) |
|---|---|
| `ingredients`, `recipes`, `priceLog` | `getMenuAnalyticsRows()` |
| `ingredientSnapshots` | `getMenuBenchmarks()` |
| `priceBatches`, `latestCascade` | `getLatestImpactCascade()`, `getImpactCascadeForBatch()` |
| (none) | `getImpactCascadeBatchSummary()`, `getImpactCascadeHistory()` |
| (none) | `getAlerts()` |
| (none) | `getDashboardKpis()`, `getLatestImpactCascadeSummary()` |
| (none) | `getDataIntegrityReport()` |

## Dashboard KPIs

`getDashboardKpis()` reads on-menu dishes from `getMenuAnalyticsRows()`
and the latest batch's price log to compute:

- `avg_gpm`, `below_target_count`, `on_menu_count`
- `ingredient_cost_spike_count` (changes > 10% in latest batch)
- `recent_price_changes_count`
- `profit_at_risk_monthly_usd` when `estimated_monthly_units_sold` exists,
  otherwise `margin_gap_per_cover_usd`.

`getLatestImpactCascadeSummary()` aggregates by **unique dish** so the
Dashboard's "Latest batch summary" matches `/impact-cascade` exactly.

## Impact Cascade

Computed from the live price log + snapshots via
`buildImpactCascadeForBatch()` (`src/lib/cascade.ts`). The selector layer
adds:

- `pathway: "Direct" | "Indirect"`
- `impact_path: string[]` (e.g. `Tomato → Marinara Sauce → Lasagne`)
- Filter for negligible deltas (`< 1e-6`)

The deprecated `priceBatches.{ingredients_changed, dishes_affected,
total_margin_impact_usd}` and `ImpactCascadeRun.{ingredients_changed,
dishes_affected, total_margin_impact_usd}` fields are kept on the type
for backwards compatibility but **the UI must not consume them** —
selectors are the single source of truth.

## Alerts

`getAlerts()` (`src/lib/alerts.ts`) generates four alert types from live
data:

- `dish_below_target` (per on-menu dish below target GPM)
- `ingredient_spike` (latest batch, capped at warning; downgraded to info
  if zero on-menu dishes are affected)
- `dish_needs_price_review` (dish with `menu_price` null/0)
- `intermediate_cost_shift` (Intermediate ingredients whose recipe cost
  moved materially)

## Price Trend stats

Computed inline against the price log: first/current cost, absolute and
percent change, change count, largest single increase. Optional baseline
toggle filters out `event === "baseline"` entries before computation.
