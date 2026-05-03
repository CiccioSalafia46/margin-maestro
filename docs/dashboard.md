# Dashboard — Build 1.9

## Overview

Dashboard is **Supabase-derived**. No new tables. Alert-first operational home screen.

## Data Sources

- `alerts` — open/critical alerts
- Menu Analytics (derived) — GPM, below target, missing price, incomplete costing
- `impact_cascade_runs` + `impact_cascade_items` — latest cascade summary
- `price_update_batches` + `ingredient_price_log` — price activity
- `ingredient_snapshots` — baseline status
- `restaurant_settings` — target GPM

## Sections

- **Alert-first header** — critical alerts banner
- **KPI cards** — avg GPM, below target, open alerts, missing price, price changes, impacted dishes
- **Active alerts** — latest open alerts with severity and actions
- **Menu health** — priced/below-target/incomplete counts, worst margins
- **Price activity** — latest batch, recent changes, cost spikes
- **Impact cascade** — latest run summary
- **Recommended actions** — contextual next steps

## Limitations

- Per-serving metrics only (no sales volume/monthly revenue)
- Dashboard does not mutate data
- Dashboard does not generate alerts automatically
- Billing not implemented
- Team management placeholder
- Google OAuth not enabled
