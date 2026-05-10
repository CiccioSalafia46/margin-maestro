# Apply Price — Build 2.4 (audit integration: 2.9 / 2.9A · atomic RPC: Build 3.4)

> **Build 3.4 update.** Apply Price now performs a **single atomic SQL RPC call** (`public.apply_dish_menu_price_with_audit`) that updates `recipes.menu_price` and inserts the `menu_price_audit_log` row in one transaction. Both writes succeed or fail together — no more partial-success path. The success toast reads "Menu price updated to $X and audit entry recorded." On RPC failure, no client-side fallback writes the price. **Apply Price still does not write `ingredient_price_log`, create `price_update_batches`, create billing rows, or publish to a POS.** See `docs/atomic-rpc-hardening.md`.

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
