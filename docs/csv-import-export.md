# CSV Import/Export — Build 3.0A (accepted)

> **Build 3.0A update (accepted).** Recipe CSV Import (two-file: `recipes` + `recipe_lines`) is live-verified alongside the existing Ingredient Import. See `docs/recipe-csv-import.md`. Recipe import does NOT create ingredients/suppliers/categories/batches/billing rows; it does NOT publish to a POS. `Export Recipe Lines` is available in the Export Data card.

## Import

### Supported: Ingredients (Build 2.5)

**Required columns:** `name`, `type`
**Optional:** `supplier_name`, `total_cost`, `original_quantity`, `original_uom_code`, `recipe_uom_code`, `adjustment`, `density_g_per_ml`, `manual_recipe_unit_cost`, `notes`

### Validation
- Name required, type required (primary/fixed/intermediate)
- Primary requires total_cost, original_quantity, UoM codes
- Fixed requires manual_recipe_unit_cost
- Adjustment cannot be -1
- Invalid UoM codes rejected
- Duplicate handling: skip (default) or update existing

### Preview before apply
- Row-level validation with status (valid/warning/error/skipped)
- Summary: creates, updates, skips, errors
- Error rows block apply

### Import does NOT:
- Write ingredient_price_log
- Create price_update_batches
- Create billing records
- Mutate recipes

## Export

| Dataset | Filename |
|---------|----------|
| Ingredients | ingredients.csv |
| Recipes | recipes.csv |
| Menu Analytics | menu-analytics.csv |
| Price Log | price-log.csv |
| Alerts | alerts.csv |

### Security
- All exports respect RLS
- Formula-risky cells prefixed with `'` to prevent injection
- No secrets, auth tokens, or service-role data in exports

## Limitations
- No XLS/XLSX/XLSM import
- No recipe CSV import yet
- No POS export
- Client-orchestrated import (not atomic)
