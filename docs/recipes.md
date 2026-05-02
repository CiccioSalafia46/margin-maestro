# Recipes — Build 1.3

## Tables

### `recipes`

Tenant-owned recipe master. Two kinds: `dish` (sold to customers) and `intermediate` (internal preparations that feed other recipes via linked Intermediate ingredients).

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | Auto-generated |
| `restaurant_id` | uuid FK → restaurants | Cascade |
| `name` | text | Unique per restaurant (case-insensitive, active only) |
| `kind` | text | `dish` or `intermediate` |
| `menu_category_id` | uuid FK → menu_categories | Optional |
| `serving_quantity` | numeric(18,6) | Must be > 0 |
| `serving_uom_code` | text FK → units | Required |
| `menu_price` | numeric(18,6) | Dish only, >= 0 |
| `linked_intermediate_ingredient_id` | uuid FK → ingredients | Intermediate only |
| `notes` | text | Optional |
| `is_active` | boolean | Soft delete |

### `recipe_lines`

Ingredient composition of a recipe.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | Auto-generated |
| `restaurant_id` | uuid FK → restaurants | Must match recipe |
| `recipe_id` | uuid FK → recipes | Cascade |
| `ingredient_id` | uuid FK → ingredients | Restrict on delete |
| `quantity` | numeric(18,6) | Must be > 0 |
| `uom_code` | text FK → units | Required |
| `sort_order` | integer | Display order |

**RLS:** Members select, owner/manager insert/update/delete.

## Recipe Cost Rules

- `line_cost = converted_quantity × ingredient.recipe_unit_cost`
- `recipe_cogs = sum(line_costs)`
- `cost_per_serving = recipe_cogs / serving_quantity`
- For dishes: `gp = menu_price - cost_per_serving`, `gpm = gp / menu_price`

## Intermediate Recipe Behavior

- An Intermediate recipe links to an Intermediate ingredient via `linked_intermediate_ingredient_id`.
- When recipe lines are saved, the linked ingredient's `ingredient_cost_state` is updated:
  - `recipe_unit_cost = cost_per_serving` (COGS / serving_quantity)
  - `cost_source = calculated`
  - `calculation_status = valid`
- If the recipe has errors, the linked cost_state becomes `error`.

## Cycle Detection

Before saving an intermediate recipe, the system checks for circular dependencies:
- Recipe A produces Intermediate ingredient A
- If Recipe A consumes Intermediate ingredient B, and Recipe B eventually consumes ingredient A → **blocked** with a friendly error.
- Self-reference is blocked.

## Limitations

- Menu Analytics (menu_items) awaits Build 1.4.
- Price Log/Snapshot awaits Build 1.5.
- Dashboard still uses mock data.
- Recipe editing (name, kind, category, serving) is through the add form; full edit form is future.
