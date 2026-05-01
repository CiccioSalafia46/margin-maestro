# Calculation Engine

All formulas are implemented as pure helpers under `src/lib/` and are
covered by `/qa-calculations` (checks A–S).

## Units of Measure

Allowed: `Ct, Gr, Kg, Lb, Oz, Gl, Lt, Ml`.

- **Mass ↔ mass** and **volume ↔ volume** conversions are always allowed.
- **Mass ↔ volume** requires `density_g_per_ml` on the ingredient or
  explicit user confirmation; otherwise the conversion fails with `ok: false`.
- **`Ct` cannot be converted** to or from any other unit.

See `src/lib/units.ts` (`convertQuantity`).

## Ingredient cost

```
Original Unit Cost     = Total Cost / Original Quantity
Recipe Quantity        = Original Quantity × ConversionFactor(orig→recipe)  (if conversion_on)
                       = Original Quantity                                  (if conversion_on = false)
Recipe Unit Cost       = Total Cost / (Recipe Quantity × (1 + Adjustment))
```

Validation: `Original Quantity > 0`, `Adjustment ≠ -1`. `Intermediate`
ingredients derive their unit cost from the linked Intermediate recipe.
See `src/lib/ingredientCost.ts`.

## Recipe COGS

```
Line Cost          = Quantity × Ingredient Recipe Unit Cost
Recipe COGS        = SUM(Line Costs)
Cost per Serving   = COGS / Serving Quantity
```

Line UoM is converted to the ingredient's `recipe_uom` before multiplication.
See `src/lib/cogs.ts`.

## Menu analytics (per dish)

```
GP                       = Menu Price - Cost per Serving
GPM                      = GP / Menu Price
On Target                = GPM ≥ target_gpm
Suggested Menu Price     = (Cost per Serving) / (1 - target_gpm)
```

See `src/lib/margin.ts`.

## Scenario analysis

```
Scenario Cost Mul   = 1 + (cost_pct / 100)
Scenario COGS       = Σ ( qty × unit_cost × Scenario Cost Mul )
Scenario Price      = Menu Price × (1 + price_pct / 100)
Scenario GPM        = (Scenario Price − Scenario COGS/Serving) / Scenario Price
```

Implemented inline in `DishAnalysisView` against the same helpers.

## Impact Cascade (ratio method)

For an ingredient whose unit cost changed `old → new`:

```
ratio                = new / old
ingredient_share     = (line.qty × old_unit_cost) / old_dish_cogs
new_dish_cogs        = old_dish_cogs + (ratio − 1) × ingredient_share × old_dish_cogs
```

For Intermediate ingredients, the cascade walks one level (Primary →
Intermediate → Dish) and sums propagated impact per dish. Direct vs
Indirect pathway and the explicit `impact_path` are emitted for each row.
Rows with negligible Δ (`< 1e-6`) are filtered out.

See `src/lib/cascade.ts` and `src/data/selectors.ts:getImpactCascadeForBatch`.

## Display precision

- Money / GP / Menu Price / Suggested Menu Price → 2 decimals.
- Recipe unit costs → 4–6 decimals depending on context.
- Percentages → 1–2 decimals; pp deltas signed with sign.
- Store precise values; round only at the display boundary
  (`src/lib/format.ts`).
