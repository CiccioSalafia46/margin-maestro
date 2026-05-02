# Ingredients Database — Build 1.2

## Tables

### `ingredients`

Tenant-owned master ingredient list.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | Auto-generated |
| `restaurant_id` | uuid FK → restaurants | Cascade on delete |
| `supplier_id` | uuid FK → suppliers | Set null on delete |
| `name` | text | Unique per restaurant (case-insensitive, active only) |
| `type` | text | `primary`, `intermediate`, `fixed` |
| `total_cost` | numeric(18,6) | Purchase cost (primary only) |
| `original_quantity` | numeric(18,6) | Purchase quantity (primary only) |
| `original_uom_code` | text FK → units | Purchase UoM |
| `conversion_on` | boolean | Enable UoM conversion |
| `recipe_uom_code` | text FK → units | Recipe UoM |
| `adjustment` | numeric(12,6) | Trim/yield adjustment, cannot = -1 |
| `density_g_per_ml` | numeric(18,8) | For mass↔volume conversion |
| `manual_recipe_unit_cost` | numeric(18,8) | Fixed ingredient cost |
| `notes` | text | Optional |
| `is_active` | boolean | Soft delete via false |

**RLS:** Members select, owner/manager insert/update. No delete policy.

### `ingredient_cost_state`

Computed cost state per ingredient (one row per ingredient).

| Field | Type | Notes |
|-------|------|-------|
| `ingredient_id` | uuid PK FK → ingredients | Cascade on delete |
| `restaurant_id` | uuid FK → restaurants | Must match ingredient |
| `cost_source` | text | `calculated`, `manual`, `intermediate_pending`, `error` |
| `original_unit_cost` | numeric(18,8) | total_cost / original_quantity |
| `recipe_quantity` | numeric(18,8) | Converted quantity |
| `recipe_unit_cost` | numeric(18,8) | Final cost per recipe UoM |
| `calculation_status` | text | `valid`, `warning`, `error`, `pending` |
| `calculation_error` | text | Error message if applicable |

**RLS:** Members select, owner/manager insert/update.

## Cost Calculation Rules

### Primary
```
original_unit_cost = total_cost / original_quantity
recipe_quantity = convert(original_qty, original_uom, recipe_uom, density?)
recipe_unit_cost = total_cost / (recipe_quantity × (1 + adjustment))
```
- `adjustment ≠ -1`
- `original_quantity > 0`
- `total_cost ≥ 0`
- Ct cannot convert to non-Ct
- Mass↔volume requires density

### Fixed
- `recipe_unit_cost = manual_recipe_unit_cost`
- `cost_source = manual`

### Intermediate
- Pending until Build 1.3 Recipes
- `cost_source = intermediate_pending`
- `calculation_status = pending`

## Current Limitations

- Cost state is computed client-side using existing pure helpers, then persisted via RLS writes. In a future build, this becomes server-side source of truth.
- Intermediate ingredient costs await Build 1.3 (Recipes).
- Price Log and Snapshot await Build 1.5.
- No edit form yet — inline editing in a future iteration.
- Dashboard and other operational pages still use mock data.
