# Impact Cascade — Build 1.7

## Tables

### `impact_cascade_runs`
One run per price update batch. Stores summary: changed ingredients count, affected dishes, newly below target, total COGS/margin delta.

### `impact_cascade_items`
Per-dish impact rows. Stores old/new COGS, GP, GPM, delta, target status, suggested price, affected ingredient names and paths.

## Calculation

For each applied manual price update batch:
1. Find changed ingredients from `ingredient_price_log` (event_type = change).
2. Build old/new cost override maps.
3. Find dish recipes consuming changed ingredients (directly or through intermediates).
4. For each affected dish: compute old COGS, new COGS, COGS delta, old/new GP/GPM, suggested price.
5. Store results in `impact_cascade_runs` + `impact_cascade_items`.

## Paths

- **Direct:** Ingredient → Dish (e.g., Mozzarella → Margherita Pizza)
- **Indirect:** Ingredient → Intermediate Recipe → Intermediate Ingredient → Dish

Only dish recipes appear as final impact items. Intermediate recipes are traversed but not stored as separate items.

## Limitations

- Per-serving metrics only (no monthly impact without sales volume data).
- No alerts generated (Build 1.8).
- Client-orchestrated generation (not atomic DB transaction).
- Dashboard still uses mock data.
