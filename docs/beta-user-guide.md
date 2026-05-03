# Beta User Guide — Margin IQ

## A. First Login / Onboarding
1. Sign up with email and password.
2. Create your restaurant (name, target GPM).
3. You're now the owner with full access.

## B. Settings
- **General:** Restaurant name, currency, locale, target GPM, tax mode.
- **Units:** Read-only reference (Ct, Gr, Kg, Lb, Oz, Ml, Lt, Gl).
- **Categories:** Add/rename/deactivate menu categories.
- **Suppliers:** Add/rename/deactivate suppliers.
- **Thresholds:** Ingredient spike %, GPM drop %, GP floor.
- **Team:** Invite members, assign roles, manage access.
- **Billing:** View subscription status (requires Stripe setup).
- **Import/Export:** CSV import for ingredients, export for all datasets.

## C. Ingredients
- **Primary:** Purchased items with total cost, quantity, UoM, and calculated recipe unit cost.
- **Fixed:** Items with a manual cost per unit (e.g., condiments).
- **Intermediate:** Items produced by recipes (cost calculated from linked recipe).

## D. Recipes
- **Dish:** Final menu items with COGS, serving quantity, and optional menu price.
- **Intermediate:** Internal preparations that feed into dish recipes.
- Add ingredient lines with quantity and UoM. Save to recalculate COGS.

## E. Menu Analytics
- View all dish profitability: COGS, GP, GPM, target status.
- Filter by below-target, missing price, incomplete costing.
- Apply suggested price for below-target dishes.

## F. Price Log
- **Initialize baseline** to capture current ingredient state.
- **Run Price Update Batch** when supplier costs change.
- View append-only audit trail of all price changes.

## G. Price Trend
- Select an ingredient to see cost history over time.
- Toggle baseline inclusion. View KPIs and chart.

## H. Dish Analysis
- Select a dish for deep COGS breakdown.
- Use scenario sliders to model cost/price changes (local only, not saved).
- Margin Manager shows suggested prices at multiple target GPMs.
- Apply suggested price directly from Margin Manager.

## I. Impact Cascade
- After a Price Update Batch, generate Impact Cascade.
- See which dishes were affected, COGS/GPM deltas, suggested prices.

## J. Alerts
- Generate Alerts to surface margin intelligence signals.
- Acknowledge, resolve, or dismiss alerts.

## K. Dashboard
- Alert-first overview of your restaurant's margin health.
- KPIs, active alerts, menu health, price activity, impact cascade summary.

## L. CSV Import/Export
- Download ingredient template → fill → upload → preview → apply.
- Export ingredients, recipes, menu analytics, price log, or alerts as CSV.
