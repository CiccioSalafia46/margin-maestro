# Apply Price — Build 2.4 (audit integration: Build 2.9)

> **Build 2.9 update.** After a successful menu_price update, Apply Price now best-effort writes an append-only row to `menu_price_audit_log` with `source='apply_price'` and a structured `context` (origin route, target_gpm, cost_per_serving, suggested_price, reason). The function returns `ApplyPriceResult { audit_recorded, audit_error, old_menu_price, new_menu_price }`. The UI shows different toast copy depending on whether the audit row was recorded. **Apply Price still does not write `ingredient_price_log`, create `price_update_batches`, create billing rows, or publish to a POS.** See `docs/menu-price-audit-trail.md`.

## Overview

Apply Price updates `recipes.menu_price` for a dish recipe. It does NOT publish to POS, external menus, or ordering systems.

## Where It Appears

- **Menu Analytics:** "Apply" link next to suggested price for below-target dishes
- **Dish Analysis → Margin Manager:** "Apply this price" under the primary target GPM suggestion

## Rules

- Owner/manager only. Viewer is read-only.
- Price must be > 0 and finite.
- Updates `recipes.menu_price` via Supabase RLS.
- Does NOT write `ingredient_price_log`.
- Does NOT create `price_update_batches`.
- Does NOT create billing records.
- Does NOT create `menu_items`.
- Confirmation dialog required before applying.

## Limitations

- No POS publishing.
- No audit trail for menu price changes (future scope).
- No batch apply across multiple dishes (individual only).
- Dashboard links to review pages, does not apply directly.
- Alerts link to Dish Analysis for review, not direct apply.
