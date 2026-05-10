# Dish Analysis — Build 1.6 (audit panel: Build 2.9, accepted: Build 2.9A)

> **Build 2.9A update.** Audit history panel verified live. `/dish-analysis/$id` includes a read-only "Menu price audit history" panel with the most recent 25 entries from `menu_price_audit_log` for the active dish (changed at, source label, old price, new price, Δ, Δ%). Panel reloads after Apply Price. Empty state explains that Apply Price + manual recipe edits will populate it. Source values are rendered with friendly labels ("Apply Price", "Manual edit", "Import", "System", "Other") — no raw user IDs and no raw JSON are surfaced.

## Overview

Dish Analysis is **derived, not persisted**. No new tables. Per-dish workspace for COGS breakdown, profitability, scenario modeling, and margin management.

## Data Sources

- `recipes` (kind = 'dish', is_active = true)
- `recipe_lines`
- `ingredients`
- `ingredient_cost_state`
- `restaurant_settings` (target_gpm)

## Features

- **COGS breakdown:** Line-by-line cost contribution sorted by share
- **Profitability summary:** GP, GPM, target comparison, suggested price
- **Scenario modeling:** Local-only sliders for cost and price adjustments (React state, not persisted)
- **Margin Manager:** Suggested prices at multiple target GPM levels

## Scenario Modeling

- Adjusts ingredient costs by a percentage (-30% to +50%)
- Adjusts menu price by a percentage (-20% to +50%)
- Shows scenario COGS, GP, GPM, delta vs current
- No database writes — purely local React state

## Limitations

- Scenario data is not persisted
- No Apply Price action
- No snapshot delta comparison (future scope)
- Dashboard still uses mock data
- Impact Cascade persistence awaits Build 1.7
- Alerts persistence awaits Build 1.8
