# Recipe CSV Import — Build 3.0A (accepted)

> **Build 3.0A — Accepted (2026-05-10).** Functionally verified on https://margin-maestro.vercel.app. Two-file import (Recipes CSV + Recipe Lines CSV) is live for owner/manager users. Recipe import does not create ingredients/suppliers/categories/batches/billing rows and does not publish to a POS. Imported dish menu prices write `source = 'import'` rows to `menu_price_audit_log`.
>
> **Build 3.4A update.** Atomic RPC live-verified. The UPDATE path's dish `menu_price` change goes through the atomic RPC `apply_dish_menu_price_with_audit` (source = 'import') — menu_price column + audit row commit/rollback together. Create path and non-price update fields remain client-orchestrated by design (OI-29).

## Purpose

Operators can bring an existing dish/recipe catalogue into Margin IQ from CSV — typically when onboarding a new restaurant, switching from a spreadsheet, or applying bulk menu engineering changes — without typing each recipe by hand.

Margin IQ accepts a **two-file** import:

1. **Recipes CSV** — recipe headers (name, kind, category, serving, menu price, …).
2. **Recipe Lines CSV** — ingredient lines for each recipe (recipe name, ingredient name, quantity, uom).

A preview + explicit confirmation step blocks any mutation until the operator reviews validation messages.

This is **CSV only**. Margin IQ does not parse XLS / XLSX / XLSM, does not publish to a POS, does not sync to external menu providers, does not create batches in `price_update_batches`, and does not write to `ingredient_price_log` from this flow.

## File formats

### Recipes CSV (header rows)

Required columns:

| Column | Type | Notes |
|---|---|---|
| `name` | text | Required. Trimmed; case-insensitive matching against existing recipes. |
| `kind` | text | Required. `dish` or `intermediate`. |

Optional columns (any subset; missing columns are treated as null):

| Column | Type | Notes |
|---|---|---|
| `category_name` | text | Resolved against active `menu_categories` by name. **Categories are not auto-created.** Unknown categories warn and leave the recipe with `menu_category_id = null`. |
| `serving_quantity` | number | Must be `> 0` if provided. Defaults to `1` on apply when missing. |
| `serving_uom_code` | text | One of `Ct, Gr, Kg, Lb, Oz, Ml, Lt, Gl`. Defaults to `Ct` on apply when missing. |
| `menu_price` | number | Must be `> 0` if provided. **Only meaningful for dishes.** Ignored on intermediates with a warning. |
| `target_gpm` | number 0–1 | **Informational only.** Margin IQ stores `target_gpm` per restaurant in `restaurant_settings`, not per recipe. The CSV column is preserved for parity with spreadsheets but does not change anything in the database. Out-of-range values warn. |
| `linked_intermediate_ingredient_name` | text | Only meaningful for `kind = intermediate`. Resolves to the `id` of an active intermediate ingredient. **Ingredients are not auto-created.** |
| `notes` | text | Free-form notes. |
| `is_active` | boolean | Currently informational; the apply path does not toggle existing `is_active` flags. |

### Recipe Lines CSV (line rows)

Required columns:

| Column | Type | Notes |
|---|---|---|
| `recipe_name` | text | Required. Must match a recipe found in either the Recipes CSV preview (post-validation) or in active database recipes. |
| `ingredient_name` | text | Required. Must match an active ingredient. |
| `quantity` | number | Required. Must be `> 0`. |
| `uom_code` | text | Required. One of `Ct, Gr, Kg, Lb, Oz, Ml, Lt, Gl`. |

Optional columns:

| Column | Type | Notes |
|---|---|---|
| `notes` | text | |
| `line_order` | number | Becomes `sort_order` on the line. Auto-incremented when missing in append mode. |

## Validation rules

- Empty `name` / `kind` on recipes → **error**.
- Invalid `kind` (not `dish`/`intermediate`) → **error**.
- `serving_quantity ≤ 0`, `menu_price ≤ 0` on dishes, line `quantity ≤ 0` → **error**.
- Unknown `uom_code` → **error**.
- Duplicate `name` within the recipes CSV → **error** on the second occurrence.
- Existing `name` matches an active recipe → driven by the **duplicate handling** mode (see below).
- Line references an unknown `recipe_name` (not in CSV preview and not in DB) → **error**.
- Line references an unknown / inactive `ingredient_name` → **error** (ingredient creation is intentionally NOT supported here).
- Unknown `category_name` → **warning**, recipe is created with `menu_category_id = null`.
- Unknown `linked_intermediate_ingredient_name` for an `intermediate` recipe → **warning**, link left null.
- `menu_price` set on an `intermediate` recipe → **warning**, ignored on apply.
- `target_gpm` provided → **warning** (informational only).

A preview row is one of: `valid` · `warning` · `error` · `skipped`.

The Apply button is disabled if **any** row has `error`. Warnings can be applied after explicit confirmation by the operator.

## Duplicate handling modes

- `skip existing` *(default)* — skip rows whose recipe name already exists; warning row.
- `update existing` — apply patch to existing recipe via `updateRecipe`. Kind transitions are blocked (cannot change `dish ↔ intermediate`).
- `block duplicates` — fail the import preview if any name already exists.

## Line handling modes

- `append lines` *(default)* — keep existing recipe lines; insert imported ones with sort_order continuing after the existing max.
- `replace lines` — for any recipe present in the lines CSV, replace its line set with the imported lines. **The UI confirms with the operator before applying because this hard-deletes existing rows in `recipe_lines` (a normal RLS-bound operation already used by `replaceRecipeLines`).**

## Cycle detection

Import calls the existing `detectCycle(recipeId, projectedIngredientIds, allRecipes, allIngredients)` helper before writing lines for each affected recipe. Recipes whose projected post-import line set would introduce a circular intermediate dependency are skipped with an error in the apply result; previously-applied recipe header changes are not rolled back.

## Apply orchestration (client-orchestrated)

The apply phase runs entirely in the browser via the standard Supabase client and RLS:

1. **Phase 1 — recipes.** `createRecipe` for new rows; `updateRecipe` for `update`-mode duplicates. Skipped rows are counted but no DB write occurs.
2. **Phase 2 — recipe lines.** Group lines by `recipe_name`. Run cycle detection. Then either `replaceRecipeLines` (replace mode) or direct `INSERT` into `recipe_lines` (append mode).
3. **Phase 3 — menu price audit (Build 2.9 integration).** For dish recipes whose `menu_price` was created or changed, write a row into `menu_price_audit_log` with `source = 'import'` and a `context` payload describing the row number and origin.

This is **not atomic.** If a later step fails, prior writes remain. The UI surfaces partial-success counts and a list of error messages. A future server-side RPC (`Build 3.0A`/`3.4`) can wrap this in one transaction.

## What recipe import does NOT do

- ❌ Create ingredients (`ingredients`).
- ❌ Create suppliers (`suppliers`).
- ❌ Create menu categories (`menu_categories`).
- ❌ Create or update batches (`price_update_batches`).
- ❌ Write to `ingredient_price_log`.
- ❌ Write to `billing_*`.
- ❌ Mutate `ingredient_cost_state`.
- ❌ Publish to a POS, marketplace, or external menu.
- ❌ Send notifications.

## Menu price audit integration (Build 2.9)

For each imported **dish** with a `menu_price > 0`:

- **Create:** new audit row with `old_menu_price = null`, `new_menu_price = imported`, `source = 'import'`.
- **Update:** when `update existing` mode runs and the new price differs from the prior price, an audit row with `source = 'import'` is added. (Note: `updateRecipe` also independently writes a `manual_recipe_edit` row from its Build 2.9 wiring; both rows coexist so the historical record reflects both the import and the recipe-edit code path.)
- Intermediate recipes never produce menu price audit rows.
- A failed audit insert does **not** roll back the recipe write; the apply result reports the count of failed audit inserts.

## UI

- **Settings → Import / Export → Import Recipes.**
  - Download Recipes Template + Download Recipe Lines Template buttons.
  - Two file uploads (recipes CSV + recipe lines CSV).
  - Duplicate-handling and Line-handling selectors.
  - Preview button → grid of per-row messages and counts (recipes, lines, create, update, skip, errors).
  - Apply button (disabled while any error exists).
  - Replace mode triggers a `window.confirm` warning.
  - Static reminder block clarifying what recipe import does and does not do.
- **Owner / Manager only.** Viewers do not see the section because RLS denies inserts and the UI gates the card on `canManage`.
- **`/qa-recipe-import`** — automated QA route (checks A–Y). Linked from Settings → Developer QA.

## Exports

Build 3.0 also adds an **Export Recipe Lines** button alongside the existing Export Recipes / Export Ingredients / Export Menu Analytics / Export Price Log / Export Alerts. All exports use `serializeCsv` with formula injection sanitization (`sanitizeCsvCell`).

## Limitations & follow-ups

1. **Not atomic** (OI-28-style) — recipe writes, line writes, and audit writes are sequential client calls. Build 3.0A / 3.4 may introduce a server-side RPC.
2. **No XLS / XLSX / XLSM**. Out of scope for now.
3. **No cycle re-check on later imports** — Phase 2 cycle detection uses the recipe set captured during apply; subsequent imports against the same data should re-run.
4. **Categories, ingredients, suppliers are never auto-created**. Operators must seed those first.
5. **`target_gpm` column is informational only**.
6. **Exports do not include `target_gpm`** since it lives at the restaurant level.

## Recommended follow-ups

- ✅ Build 3.0A — Recipe CSV Import Acceptance (done).
- **Build 3.4 — Atomic RPC Hardening.** A SQL function `apply_recipe_import_atomic(...)` (plus a sibling for Apply Price) wraps the three phases in a single transaction; closes OI-29 and OI-28 together.
- Build 3.5 — XLS/XLSM Analysis / Formula Gap Review (scope only, not implementation).
