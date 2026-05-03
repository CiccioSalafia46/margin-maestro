# Price Log + Snapshot — Build 1.5

## Tables

### `price_update_batches`
Groups a price update session. Status: draft → previewed → applied/cancelled/failed.

### `ingredient_price_log`
**Append-only** audit trail. No UPDATE policy, no DELETE policy. Corrections are new rows.
Stores name_at_time and supplier_at_time for audit readability after renames.

### `ingredient_snapshots`
Baseline state per ingredient per baseline_version. Unique(restaurant_id, ingredient_id, baseline_version).

## Baseline Initialization

First-time setup captures current ingredient state:
1. Creates a `price_update_batches` row (source = baseline_initialization, status = applied).
2. For each active ingredient, inserts a `ingredient_price_log` row (event_type = baseline, old = new, delta = 0).
3. Inserts `ingredient_snapshots` rows capturing current cost state.

## Non-Destructive Baseline Versioning

Baseline reset bumps `baseline_version` and adds new rows. Never deletes history. Full reset flow deferred to a later build.

## Key Rules

- Price Log is append-only — no edits, no deletes.
- Ingredient edits do NOT automatically write price log entries. Controlled price update batches are the intended workflow.
- Corrections use new rows with event_type = correction.
- Snapshots are immutable per version.

## Limitations

- Full price update batch editing flow deferred to Build 1.5A.
- Non-destructive baseline reset deferred.
- Impact Cascade persistence deferred to Build 1.7.
- Alerts persistence deferred to Build 1.8.
- Price Trend page still uses mock data.
