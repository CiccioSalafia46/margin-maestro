# Menu Analytics — Build 1.4

## Overview

Menu Analytics is **derived, not persisted**. No new database tables are created in Build 1.4. All data is computed on read from existing tables.

## Data Sources

- `recipes` (kind = 'dish', is_active = true)
- `recipe_lines`
- `ingredients`
- `ingredient_cost_state`
- `restaurant_settings` (target_gpm)
- `menu_categories`

## Formulas

For each active dish recipe:

```
recipe_cogs = sum(line_costs)
cost_per_serving = recipe_cogs / serving_quantity
gp = menu_price - cost_per_serving
gpm = gp / menu_price
on_target = gpm >= target_gpm
suggested_menu_price = cost_per_serving / (1 - target_gpm)
```

## Status Handling

| Status | Meaning |
|--------|---------|
| `valid` | All data present, calculations correct |
| `warning` | Minor issues (conversion warnings, etc.) |
| `error` | Calculation failed |
| `incomplete` | Missing menu price or no ingredient lines |

## No Snapshot Delta Yet

Snapshot deltas (Δ COGS, Δ GPM vs baseline) arrive in Build 1.5 — Price Log + Snapshot.

## Limitations

- Menu Analytics is read-only — no price update actions yet.
- Suggested price is informational only.
- Dashboard still uses mock data.
- Dish Analysis still uses mock data.
