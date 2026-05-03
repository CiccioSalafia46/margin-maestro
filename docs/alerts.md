# Alerts — Build 1.8

## Table: `alerts`

Operator-facing alerts generated from margin intelligence signals.

## Alert Types

| Type | Source | Severity |
|------|--------|----------|
| `dish_below_target` | Menu Analytics | warning/critical |
| `dish_newly_below_target` | Impact Cascade | critical |
| `ingredient_cost_spike` | Price Log | warning |
| `impact_cascade_margin_drop` | Impact Cascade | warning |
| `missing_menu_price` | Menu Analytics | info |
| `incomplete_costing` | Menu Analytics | warning |
| `intermediate_cost_shift` | Impact Cascade | warning |

## Status Workflow

`open` → `acknowledged` → `resolved` (or `dismissed` from any state)

## Generation

Alerts are generated explicitly via "Generate Alerts" button. Not automatic on every page load.

## Duplicate Prevention

Before inserting, checks for existing open alert with same type + entity. Skips if already open.

## Limitations

- Dashboard still uses mock data
- No automatic alert generation on price update (manual trigger only)
- No email/push notifications
