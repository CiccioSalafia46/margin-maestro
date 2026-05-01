# Pre-Supabase Readiness

Build 0.4 is the last fully frontend-only build. The next phase will
introduce Lovable Cloud (Supabase under the hood) for persistence,
auth, and server-side calculation.

## Future tables (target schema)

`profiles`, `restaurants`, `restaurant_members`, `restaurant_settings`,
`units`, `unit_conversions`, `menu_categories`, `suppliers`,
`ingredients`, `ingredient_cost_state`, `ingredient_price_log`,
`ingredient_snapshots`, `price_update_batches`, `recipes`,
`recipe_lines`, `recipe_dependency_edges`, `menu_items`,
`menu_profitability_snapshots`, `impact_cascade_runs`,
`impact_cascade_items`, `alerts`, `audit_events`.

Every tenant-owned record carries `restaurant_id` and is RLS-protected.

## Future Edge Functions (server-side)

- `run_price_update_batch`
- `recalculate_restaurant_costs`
- `generate_impact_cascade`
- `generate_alerts_for_restaurant`

## What must move server-side later

- Recipe COGS / GPM / suggested-price recomputation after any price or
  recipe change (today: pure helpers in the browser).
- Impact Cascade generation after a batch (today: derived selector in
  the browser).
- Alert generation (today: derived selector in the browser).
- Snapshot creation / baseline reset.
- All write workflows (Add Ingredient, Add Recipe, Apply Suggested
  Price, Override, Defer, Acknowledge, Resolve).

Frontend calculation helpers stay — but only as a **preview** layer.
The server is the source of truth.

## RLS principles

- Every tenant table has RLS enabled.
- Membership lookups go through a `SECURITY DEFINER` helper
  (e.g. `has_restaurant_role(_user_id, _restaurant_id, _role)`) to avoid
  recursive policies.
- Roles live in a separate `restaurant_members` table (never on
  `profiles` / `auth.users`).
- The frontend is never trusted for sensitive business logic.

## Append-only Price Log

`ingredient_price_log` is **append-only**: no UPDATE, no DELETE policies.
Corrections are added as new rows with `notes`, never by mutating
history.

## Non-destructive baseline reset

A baseline reset must:

1. Insert new `baseline` rows in the price log with an incremented
   `baseline_version`.
2. Re-snapshot `ingredient_snapshots` with the new baseline version.
3. Leave all prior price log rows and snapshots intact.

Historical analytics (Δ vs snapshot, Price Trend, Impact Cascade
history) must remain intact across resets.
