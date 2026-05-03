# Apply Price — Build 2.4

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
