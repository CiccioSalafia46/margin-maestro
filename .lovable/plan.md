# Restaurant Margin Intelligence Platform — MVP Plan

## 1. Product Summary

A Margin Intelligence decision layer for independent restaurant owner-operators (1–2 locations). Unlike POS, inventory, or generic recipe-costing tools that report what happened, this platform tells operators what to do next when supplier prices move.

Core promise: the moment an ingredient price changes, the operator sees which dishes are affected, how COGS and GPM shifted, which dishes fell below target GPM (default 78%), and the exact menu price required to restore target margin.

Current phase: **frontend-only mock UI shell**. No Supabase, no auth, no schema, no billing, no real backend writes. The data layer is structured so the eventual swap to Supabase + Edge Functions is mechanical.

## 2. Main User Journeys

1. **First-run setup** — Operator confirms restaurant profile, currency (USD), locale (en-US), default target GPM (78%), tax handling (ex-tax), available units.
2. **Build ingredient database** — Add Primary, Intermediate, and Fixed ingredients with supplier, pack size, total cost, original UoM, density (when needed), adjustment.
3. **Build recipes** — Create Intermediate recipes (which update a linked Intermediate ingredient cost) and Dish recipes (which feed Menu Analytics).
4. **Daily price update batch** — Operator opens a Price Update Batch, edits new supplier prices, confirms. Mock action appends to Price Log, advances Snapshot, runs Impact Cascade, generates Alerts.
5. **React to alerts** — Dashboard surfaces dishes now off-target and ingredient spikes; operator drills into Dish Analysis or Impact Cascade.
6. **Reprice decision** — Dish Analysis shows Suggested Menu Price and lets operator Apply / Override / Defer (mock).
7. **Trend review** — Price Trend shows an ingredient's unit-cost history with batch annotations.

## 3. Proposed Route Map

TanStack Start file-based routes under `src/routes/`:

```
/                        index.tsx                    Dashboard (alert-first)
/dashboard               dashboard.tsx                redirect/alias to /
/ingredients             ingredients.tsx              Ingredient list
/ingredients/$id         ingredients.$id.tsx          Ingredient detail
/recipes                 recipes.tsx                  Recipe list (Intermediate + Dish tabs)
/recipes/$id             recipes.$id.tsx              Recipe editor
/menu-analytics          menu-analytics.tsx           Menu Analytics (all dishes)
/dish-analysis/$id       dish-analysis.$id.tsx        Dish deep dive
/impact-cascade          impact-cascade.tsx           Latest cascade + history
/impact-cascade/$batchId impact-cascade.$batchId.tsx  Cascade for a specific batch
/price-trend             price-trend.tsx              Price Trend explorer
/price-log               price-log.tsx                Append-only Price Log viewer
/alerts                  alerts.tsx                   Alerts & Actions queue
/settings                settings.tsx                 Settings layout (Outlet)
/settings/restaurant     settings.restaurant.tsx
/settings/units          settings.units.tsx
/settings/targets        settings.targets.tsx
```

Each route defines its own `head()` with route-specific title and description.

## 4. Screen-by-Screen MVP Scope

**Dashboard (`/`)** — Alert-first. Header KPIs: dishes off target, recent ingredient spikes, total margin impact from latest batch, average GPM vs target. Cards: "Dishes off target", "Recent price spikes", "Suggested reprices", "Latest batch summary". Each card links to its deep view. No vanity charts.

**Ingredients (`/ingredients`)** — Table: name, type badge (Primary / Intermediate / Fixed), supplier, original pack (qty + UoM), original unit cost, recipe unit cost (after adjustment), last price change %, sparkline. Filters: type, supplier, spike status. "New ingredient" opens a guided drawer. Type-specific fields shown conditionally; Fixed ingredients accept a manually set standard cost; Intermediate ingredients show the linked recipe and are read-only on cost.

**Ingredient Detail (`/ingredients/$id`)** — Editable card: pack size, total cost, UoM, density (when relevant), adjustment, conversion switch. Right panel: price history mini-chart, recipes that consume this ingredient, link to linked Intermediate recipe (if Intermediate type).

**Recipes (`/recipes`)** — Tabs: Dishes | Intermediates. Table: name, COGS, serving qty, cost/serving; for Dishes also menu price, GP, GPM, on-target badge. "New recipe" drawer.

**Recipe Editor (`/recipes/$id`)** — Header (name, type, serving qty, menu price for dishes). Lines table: ingredient (any type, including Intermediate), quantity, recipe UoM, computed line cost. Live totals panel: COGS, cost/serving, GP, GPM, On Target badge, Suggested Menu Price. Saving an Intermediate recipe updates the linked Intermediate ingredient's cost (mock).

**Menu Analytics (`/menu-analytics`)** — All Dish recipes. Columns: dish, category, COGS/serving, menu price, GP, GPM, on-target, delta vs last snapshot. Sort by worst margin. Filter: below target only.

**Dish Analysis (`/dish-analysis/$id`)** — Single dish. Top: GPM vs target hero, GP, COGS. Middle: COGS breakdown by line (largest contributors first). What changed since last Snapshot (per-line cost delta and contribution to margin shift). Bottom: Suggested Menu Price card with Apply / Override / Defer (mock).

**Impact Cascade (`/impact-cascade`)** — Latest batch summary: ingredients changed, dishes affected, dishes newly off-target, total $ margin impact. Drilldown table per dish. History list of batches with link to per-batch view.

**Price Trend (`/price-trend`)** — Picker: ingredient. Chart: unit cost over time with batch annotations. Stats: 30 / 90 / 365-day change.

**Price Log (`/price-log`)** — Append-only table: timestamp, batch_id, ingredient name_at_time, supplier_at_time, old_unit_cost, new_unit_cost, % change, baseline_version. Read-only. Filters: ingredient, batch, date range.

**Alerts (`/alerts`)** — Queue: dish off target, ingredient spike, intermediate cost shift propagated. Severity, summary, actions (View Dish, View Ingredient, Dismiss).

**Settings** — Restaurant profile, units of measure (catalog + per-ingredient density entries managed from ingredient screens), targets (target GPM default 78, tax mode, currency USD, locale en-US).

## 5. Component Architecture

```
src/
  routes/                              (per route map)
  components/
    layout/
      AppShell.tsx                     sidebar + topbar wrapper
      Sidebar.tsx
      Topbar.tsx
    dashboard/
      KpiHeader.tsx
      OffTargetDishesCard.tsx
      PriceSpikeCard.tsx
      SuggestedRepriceCard.tsx
      LatestBatchCard.tsx
    ingredients/
      IngredientTable.tsx
      IngredientFormDrawer.tsx
      IngredientPriceSparkline.tsx
      IngredientTypeBadge.tsx
    recipes/
      RecipeTable.tsx
      RecipeFormDrawer.tsx
      RecipeLinesEditor.tsx
      RecipeMarginPanel.tsx
    menu/
      MenuAnalyticsTable.tsx
      OnTargetBadge.tsx
      MarginDeltaCell.tsx
    dish/
      DishMarginHero.tsx
      CogsBreakdown.tsx
      SinceSnapshotDelta.tsx
      SuggestedPriceCard.tsx
    impact/
      ImpactSummary.tsx
      ImpactDishTable.tsx
      BatchHistoryList.tsx
    trend/
      IngredientTrendChart.tsx
    pricelog/
      PriceLogTable.tsx
    alerts/
      AlertList.tsx
      AlertItem.tsx
    settings/
      RestaurantForm.tsx
      UnitsManager.tsx
      TargetsForm.tsx
    common/
      DataTable.tsx
      ConfirmModal.tsx
      EmptyState.tsx
      MoneyCell.tsx
      PercentCell.tsx
      UomSelect.tsx
      PageHeader.tsx
  lib/
    money.ts          format USD en-US, precision vs display rules
    units.ts          UoM catalog, conversion factors, density-aware checks
    margin.ts         GP, GPM, suggested price, on-target
    cogs.ts           line cost, recipe COGS, intermediate resolution + cycle detect
    cascade.ts        simulate impact cascade across current data
    alerts.ts         derive alerts from snapshot vs current state
    ids.ts            uuid helper (ready for Supabase)
  data/
    mock/
      restaurant.ts
      ingredients.ts          (Italian dataset)
      recipes.ts              (Italian dataset)
      priceLog.ts
      snapshots.ts
      batches.ts
    store.ts                  in-memory store + Context provider
    actions.ts                runPriceUpdateBatch, recalculateRestaurantCosts,
                              generateImpactCascade, generateAlertsForRestaurant
                              (names mirror future Edge Functions)
    selectors.ts              memoized derived data
  hooks/
    useRestaurant.ts
    useIngredients.ts
    useRecipes.ts
    useMenuAnalytics.ts
    useImpactCascade.ts
    useAlerts.ts
```

State: a single React Context store wrapping mock data. Action creator names match the future Edge Function names so the later swap is a one-file change inside `data/actions.ts`.

UI kit: existing shadcn/ui (Table, Dialog, Sheet/Drawer, Form, Tabs, Badge, Card, Sonner) + recharts. Premium B2B aesthetic: neutral surfaces, restrained accent, no playful imagery, no marketing-site tropes.

## 6. Mock Data Plan (Italian Restaurant)

Single demo restaurant, Italian concept. All money in USD, locale en-US.

Ingredients (with type):
- Primary: Mozzarella, Ground Pork, Flour, Tomato, Olive Oil, Basil, Sundried Tomatoes, Asparagus, Shallots
- Intermediate: Marinara Sauce, Pizza Dough (each linked to its Intermediate recipe)
- Fixed: Condiments

Recipes:
- Intermediate: Marinara Sauce, Pizza Dough
- Dishes: Margherita Pizza, Lasagne Tradizionali, Ravioli alla Siciliana, Tris di Bruschetta, Veal Saltimbocca, Antipasto Italiano

Recipe lines reference `ingredient_id` only (Intermediate ingredients are consumed like any other ingredient — no polymorphic lines).

Seed:
- ~90 days of price history with 2 prior batches and 1 simulated spike (e.g., Mozzarella +18%, Olive Oil +12%) so Dashboard, Impact Cascade, Alerts, and Price Trend are populated on first load.
- One Snapshot pinned to "yesterday" as the last confirmed state.
- Densities provided for Olive Oil; UoM coverage exercises Gr/Kg/Lb/Oz/Ml/Lt/Ct.
- At least one ingredient has negative adjustment (trim/waste); none equal to -1.
- No lorem ipsum anywhere.

## 7. Future Supabase Architecture (not implemented now)

Tables (UUID PKs, all tenant tables carry `restaurant_id`, RLS-on):

`profiles`, `restaurants`, `restaurant_members`, `restaurant_settings`,
`units`, `unit_conversions`,
`menu_categories`, `suppliers`,
`ingredients`, `ingredient_cost_state`, `ingredient_price_log`, `ingredient_snapshots`,
`price_update_batches`,
`recipes`, `recipe_lines`, `recipe_dependency_edges`,
`menu_items`, `menu_profitability_snapshots`,
`impact_cascade_runs`, `impact_cascade_items`,
`alerts`, `audit_events`.

Authn: `auth.users`. Tenant membership and role: `restaurant_members`. Roles in a separate roles table with `has_role()` SECURITY DEFINER — never store role on `profiles`.

RLS pattern: every tenant table policy resolves `restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid())`. `ingredient_price_log` is append-only via RLS (insert allowed, update/delete denied for everyone). Baseline reset uses `baseline_version`, never destructive history deletion.

Edge Functions (server-only authority, names match action creators above):
- `run_price_update_batch`
- `recalculate_restaurant_costs`
- `generate_impact_cascade`
- `generate_alerts_for_restaurant`

Frontend never trusts client for these writes; client may compute previews for UX only.

## 8. Critical Calculation Rules

- `original_unit_cost = total_cost / original_qty`
- If conversion ON: `recipe_qty = original_qty * conversion_factor(original_uom, recipe_uom)`; if OFF: `recipe_qty = original_qty`
- `recipe_unit_cost = total_cost / (recipe_qty * (1 + adjustment))`. Reject `adjustment = -1`.
- `line_cost = line_qty * ingredient_recipe_unit_cost` (Intermediate ingredients resolve from their linked recipe; cycle detection required).
- `recipe_cogs = sum(line_costs)`
- `cost_per_serving = recipe_cogs / serving_qty`
- `gp = menu_price - cost_per_serving`; `gpm = gp / menu_price` (guard `menu_price > 0`)
- `on_target = gpm >= target_gpm`
- `suggested_menu_price = cost_per_serving / (1 - target_gpm)`

Validation:
- original_qty > 0, serving_qty > 0, line qty > 0, adjustment != -1.
- Ct cannot convert to anything else.
- mass↔mass and volume↔volume conversions allowed.
- mass↔volume requires `density_g_per_ml` or explicit user confirmation.

Precision:
- Store full precision; round only on display.
- Money totals (menu price, GP, COGS totals): 2 decimals.
- Recipe unit costs / per-gram costs: higher precision when needed.
- GPM comparisons against target use a small epsilon to avoid float drift.

## 9. Security Principles (for later)

- All tenant data partitioned by `restaurant_id`; RLS enforced on every tenant table.
- Roles in a separate table; check via `has_role()` SECURITY DEFINER. Never trust client claims or localStorage for role.
- Price batch apply, snapshot confirm, cascade run, alert generation are Edge Functions — frontend cannot directly write `ingredient_price_log`, `ingredient_snapshots`, `impact_cascade_runs`, `alerts`.
- `ingredient_price_log` append-only at RLS level; baseline reset via `baseline_version`, never DELETE.
- Validate every Edge Function input with Zod; reject invalid adjustments, non-positive quantities, cross-tenant references.
- Preserve `name_at_time` and `supplier_at_time` in logs for audit readability after renames.
- Secrets only in server env, never in the client bundle.

## 10. Step-by-Step Implementation Sequence

1. App shell: sidebar, topbar, route stubs for every route in the map, per-route `head()` metadata.
2. Design tokens + shared primitives (DataTable, MoneyCell, PercentCell, OnTargetBadge, EmptyState, ConfirmModal, PageHeader, drawers).
3. `lib/units.ts`, `lib/money.ts`, `lib/margin.ts`, `lib/cogs.ts` as pure functions.
4. Mock Italian dataset + in-memory store + Context provider + selectors + action creators (named to match future Edge Functions).
5. Settings screens (drives target GPM, currency, tax mode, locale used everywhere).
6. Ingredients list + detail + guided form drawer (type-aware: Primary / Intermediate / Fixed).
7. Recipes list + editor (Intermediate save updates linked Intermediate ingredient cost; live margin panel; suggested price).
8. Menu Analytics table.
9. Dish Analysis deep dive (snapshot delta + Suggested Menu Price actions).
10. Price Log viewer (read-only) + Price Update Batch flow (mock action appends log, advances snapshot, triggers cascade + alerts).
11. Impact Cascade screen wired to latest batch + per-batch view.
12. Price Trend explorer.
13. Alerts engine + Alerts screen + Dashboard cards.
14. Polish: empty states, confirmation modals, toasts, focus rings, tablet layout pass.
15. Demo dev action "Simulate price spike" to make demos repeatable.

(Out of scope this phase: Supabase wiring, auth, schema, billing, real backend writes.)

## 11. Risks and Edge Cases

- **Intermediate cycles** — a sub-recipe referencing itself; cascade must detect and refuse with a clear error.
- **UoM conversion gaps** — mass↔volume without density must block, not silently miscalculate; Ct never converts.
- **Adjustment = -1** — division by zero; validated at form layer and compute layer.
- **Menu price = 0/null** for a Dish — GPM undefined; show "Set menu price" state, never NaN.
- **Renamed ingredients/suppliers** — Price Log preserves name_at_time / supplier_at_time so history stays readable.
- **Float drift** — keep raw precision; round only on render; epsilon comparisons.
- **Snapshot vs live drift** — alerts compute against last confirmed Snapshot, not in-progress edits.
- **Large batches** — memoized selectors keep UI responsive when many recipes recompute.
- **Tenant scoping** — even in mock, route every read/write through `restaurant_id` so the eventual RLS swap is mechanical.
- **User overrides Suggested Menu Price** — record override + timestamp + reason in mock for later analytics.
- **Baseline reset** — must use `baseline_version`, never delete log rows.

## 12. Project Knowledge (paste into Lovable Project Knowledge)

```
Product: Restaurant Margin Intelligence Platform.
Category: Margin Intelligence. Not POS, not inventory, not generic recipe costing.
A decision layer for independent restaurant operators.

Core promise: existing systems tell operators what happened; this platform tells
them what to do next.

Target user: independent owner-operator, 1–2 locations, no finance team,
responsible for supplier decisions, ingredient costs, recipe costing, and menu
pricing.

Primary JTBD: when a supplier price changes, instantly show (1) affected dishes,
(2) COGS delta, (3) GPM delta, (4) dishes now below target GPM,
(5) menu price required to restore target GPM.

MVP modules: Dashboard, Ingredient Database, Recipe List, Menu Analytics,
Price Log, Snapshot, Price Trend, Dish Analysis, Impact Cascade,
Basic Alerts & Actions Engine, Settings/Admin.

MVP routes: /dashboard, /ingredients, /recipes, /menu-analytics, /dish-analysis,
/impact-cascade, /price-trend, /price-log, /alerts, /settings.

Excluded: POS integration, supplier marketplace, automated invoice processing,
AI substitutions, mobile-native app, multi-location UI, advanced demand
forecasting, reservations, ordering, delivery, staff scheduling, table management.

Defaults: currency USD, locale en-US, target GPM 78%, menu price ex-tax.
UoMs: Ct, Gr, Kg, Lb, Oz, Gl, Lt, Ml.

Demo restaurant: Italian.
Demo ingredients: Mozzarella, Ground Pork, Flour, Tomato, Olive Oil, Basil,
Sundried Tomatoes, Asparagus, Shallots, Marinara Sauce, Pizza Dough, Condiments.
Demo recipes: Marinara Sauce (Intermediate), Pizza Dough (Intermediate),
Margherita Pizza, Lasagne Tradizionali, Ravioli alla Siciliana, Tris di Bruschetta,
Veal Saltimbocca, Antipasto Italiano.

Ingredient types: Primary (raw supplier purchase), Intermediate (house-made,
cost from a recipe, reused as ingredient), Fixed (manually set standard cost).
Recipe types: Intermediate, Dish.
All recipe lines reference ingredient_id only. Intermediate recipes update a
linked Intermediate ingredient. Avoid polymorphic recipe lines.

Formulas:
  original_unit_cost = total_cost / original_qty
  recipe_qty = conversion_on
               ? original_qty * factor(original_uom, recipe_uom)
               : original_qty
  recipe_unit_cost = total_cost / (recipe_qty * (1 + adjustment))
  line_cost = qty * ingredient_recipe_unit_cost
  recipe_cogs = sum(line_costs)
  cost_per_serving = recipe_cogs / serving_qty
  gp = menu_price - cost_per_serving
  gpm = gp / menu_price
  on_target = gpm >= target_gpm
  suggested_menu_price = cost_per_serving / (1 - target_gpm)

Validation: original_qty > 0, serving_qty > 0, line qty > 0, adjustment != -1.
Ct cannot convert. mass<->mass and volume<->volume allowed. mass<->volume
requires density_g_per_ml or explicit user confirmation.
Store precise values; round only on display. Money totals 2 decimals; unit costs
higher precision when needed.

Excel-to-SaaS: preserve business logic, not spreadsheet structure. Never use
ingredient or recipe names as technical PKs. Names unique per restaurant as
labels only. Preserve name_at_time in logs. Price Log append-only. Baseline
reset uses baseline_version, never deletes history. Snapshot = last confirmed
ingredient cost state. Impact Cascade runs after price update batches.

Future backend: Supabase Postgres, Auth (auth.users), RLS, Edge Functions.
profiles for app profile data; restaurant_members for tenant membership/role.
Every tenant record carries restaurant_id; all tenant tables RLS-on.
Future tables: profiles, restaurants, restaurant_members, restaurant_settings,
units, unit_conversions, menu_categories, suppliers, ingredients,
ingredient_cost_state, ingredient_price_log, ingredient_snapshots,
price_update_batches, recipes, recipe_lines, recipe_dependency_edges,
menu_items, menu_profitability_snapshots, impact_cascade_runs,
impact_cascade_items, alerts, audit_events.
Server-only Edge Functions: run_price_update_batch, recalculate_restaurant_costs,
generate_impact_cascade, generate_alerts_for_restaurant.
Frontend never trusted for these writes.

UX: alert-first dashboard, premium B2B SaaS, clean tables and cards, guided
workflows over spreadsheet editing, drawers + badges + confirmation modals +
empty/loading states, desktop and tablet first, no lorem ipsum, realistic
restaurant margin data, no playful restaurant marketing design.

Design tone: professional, clean, financial, operational, trustworthy.

Current build phase: frontend-only mock UI shell. No Supabase, no auth, no
schema, no billing, no real backend writes. Action creators in the mock store
are named to match future Edge Functions so the later swap is mechanical.
```

No clarifying questions — the brief and Project Knowledge are sufficient. On approval I will start at step 1.