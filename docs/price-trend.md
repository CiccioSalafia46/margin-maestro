# Price Trend — Build 1.5B

## Overview

Price Trend reads from the append-only `ingredient_price_log` table. No new tables are created. The chart and statistics are derived from baseline and change event rows.

## Data Source

- `ingredient_price_log` — filtered by selected ingredient, ordered by created_at
- `ingredients` — for the ingredient selector (active, non-intermediate)

## Trend Stats

- **first_recorded** — first valid `new_recipe_unit_cost`
- **current** — latest valid `new_recipe_unit_cost`
- **absolute_change** — current - first_recorded
- **percent_change** — absolute_change / first_recorded (null if first = 0)
- **number_of_changes** — count of event_type = 'change'
- **largest_increase** — max positive `delta_recipe_unit_cost_percent`

## Chart

- Plots `new_recipe_unit_cost` over time
- Includes baseline and change points (toggleable)
- Skips null/NaN/Infinity values

## Limitations

- Dashboard still uses mock data
- Dish Analysis still uses mock data
- Impact Cascade persistence awaits Build 1.7
- Alerts persistence awaits Build 1.8
