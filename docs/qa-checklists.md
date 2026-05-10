# QA Checklists

Manual and automated QA checklists for Margin IQ.

> **Build 2.8A update.** New automated route `/qa-live-deployment` (checks A–O) covers live deploy config, Vercel env naming, Supabase Auth URL setup, and forbidden secret/localStorage scans. The route is linked from Settings → Developer QA. The existing `/qa-google-oauth`, `/qa-mvp-readiness`, `/qa-beta-launch`, and `/qa-auth` routes were extended to reference live verification. See `docs/live-deployment.md`.

> **Build 2.9A update.** `/qa-menu-price-audit` accepted — live-verified. `pg_policies` shows SELECT + INSERT only on `menu_price_audit_log` (no UPDATE, no DELETE). `/qa-mvp-readiness` check Y and `/qa-beta-launch` check AH report "accepted". See `docs/menu-price-audit-trail.md`.

> **Build 3.0 update.** New automated route `/qa-recipe-import` (checks A–Y) covers parsers, validators (synthetic in-memory rows), preview-doesn't-mutate, role gating, side-effect absence (no ingredient creation, no `ingredient_price_log`, no `price_update_batches`, no `billing_*`), `menu_price_audit_log source='import'` integration, `menu_items` absence, secret exposure, localStorage persistence. `/qa-mvp-readiness` adds check Z; `/qa-beta-launch` adds check AI; `/qa-import-export` adds checks W–X. See `docs/recipe-csv-import.md`.

> **Build 3.0A update.** Recipe CSV Import accepted live. `/qa-recipe-import` description + footer bumped to 3.0A; `/qa-mvp-readiness` check Z and `/qa-beta-launch` check AI report "accepted". `/qa-import-export` adds check Y (XLS/XLSM remains future). `/qa-mvp-readiness` check X and `/qa-beta-launch` check AG reframed: single-backend live reuse is an **intentional cost decision**, not an open recommendation. See `docs/recipe-csv-import.md`.

> **Build 3.4 update.** New automated route `/qa-atomic-rpc` (22 checks A–V) probes the new `apply_dish_menu_price_with_audit` SQL RPC, documents grant model, covers defensive role/kind/price/source validation, atomicity guarantee, API integration, recipe-import audit atomicity, manual recipe edit limitation, side-effect absence. `/qa-apply-price` adds T+U; `/qa-menu-price-audit` and `/qa-recipe-import` rephrased; `/qa-mvp-readiness` adds AA; `/qa-beta-launch` adds AJ. See `docs/atomic-rpc-hardening.md`.

---

## Auth QA

**Route:** `/qa-auth`
**Checks:** Automated (session, profile, membership, RLS, security) + manual checklist.

### Automated Checks
- Session present (authenticated status)
- User ID available
- Session restored from `getSession()`
- Profile loaded
- At least one membership
- Active restaurant selected
- Active role known
- Restaurant settings loaded
- RLS: Read own profile
- RLS: Read own restaurants
- RLS: Read active restaurant_settings
- RLS: Read own membership rows
- Service-role key not exposed to client
- `persistSession` enabled
- `autoRefreshToken` enabled

### Manual Acceptance
- [ ] Anonymous `/dashboard` redirects to `/login`
- [ ] `/login` renders
- [ ] `/signup` renders
- [ ] New signup reaches `/onboarding/create-restaurant`
- [ ] `create_restaurant_with_owner` creates restaurant, owner membership, and settings
- [ ] After onboarding, `/dashboard` renders
- [ ] Topbar shows active restaurant name
- [ ] Sign out redirects to `/login`
- [ ] Refresh preserves session
- [ ] Navigation preserves session
- [ ] `/qa-calculations` renders after login
- [ ] `/qa-data-integrity` renders after login

### Build 1.0F Final Acceptance Checklist

- [ ] Login works — credentials accepted, session created
- [ ] `/qa-auth` shows authenticated diagnostics after login
- [ ] Refresh `/qa-auth` (F5) — session survives, page stays on `/qa-auth`
- [ ] Navigate `/dashboard` → `/settings` → `/qa-auth` — session persists throughout
- [ ] Sign out — clears session, redirects to `/login`
- [ ] `/qa-auth` after sign out — shows "Auth QA requires sign in" with 0 fails
- [ ] Browser DevTools → Application → Local Storage: no `activeRestaurantId` key
- [ ] Browser DevTools → Application → Local Storage: no `role` key
- [ ] Browser DevTools → Application → Local Storage: no `membership` key
- [ ] Browser DevTools → Application → Local Storage: no `restaurant_settings` key
- [ ] No `VITE_SUPABASE_SERVICE_ROLE_KEY` in client env (verified by `/qa-auth` security check)

---

## Calculation QA

**Route:** `/qa-calculations`
**Checks:** A through S (19 checks). All operate against mock data.

| Check | Name | What It Tests |
|-------|------|---------------|
| A | Ground Pork Lb→Gr | Unit conversion accuracy (mass) |
| B | Asparagus trim loss | Adjustment (-10%) on unit costing |
| C | Ct → Gr blocked | Cross-family conversion rejection |
| D | Ct → Ct allowed | Same-unit conversion (no conversion flag needed) |
| E | Volume → mass no density | Cross-family without density rejected |
| F | Volume → mass with density | Density-based conversion (oil, 0.91 g/ml) |
| G | adjustment = -1 blocked | Division-by-zero guard |
| H | menu_price = 0 → GP/GPM blank | Zero price returns null, not NaN |
| I | Suggested menu price | Formula: COGS / (1 - target_gpm) |
| J | Helpers are pure | Input mutation detection |
| K | Impact cascade direct path | Sundried Tomatoes → Bruschetta |
| L | Impact cascade indirect path | Tomato → Marinara → Dish |
| M | Off-menu excluded from benchmarks | avg_gpm uses only on-menu dishes |
| N | Alerts match derived menu analytics | Below-target alerts alignment |
| O | Price trend largest increase | Max price increase derivation |
| P | Dashboard below-target count | KPI matches menu analytics |
| Q | Latest cascade summary | Summary matches history[0] |
| R | Margin impact labels | Per-serving/monthly/has_sales_data flags |
| S | No duplicate dish double-counting | Unique dish aggregation in batch summary |

**Expected:** All PASS. These checks validate pure calculation helpers and derived selectors.

---

## Data Integrity QA

**Route:** `/qa-data-integrity`
**Checks:** Automated integrity report from `getDataIntegrityReport()` selector.

Validates:
- No duplicate IDs in mock data
- All recipe line ingredient references resolve
- No NaN or Infinity values in computed costs
- Impact cascade paths reference valid ingredients and recipes
- Alert subjects reference valid entities
- Recipe serving quantities are positive
- Menu prices are non-negative where present

**Expected:** All pass or warning. Failures indicate mock data corruption.

---

## Settings/Admin QA

**Route:** `/qa-settings-admin`
**Checks:** A through U (21 checks). Operate against live Supabase data.

| Check | Section | What It Tests |
|-------|---------|---------------|
| A | Auth/Tenant | Authenticated session exists |
| B | Auth/Tenant | Active restaurant exists |
| C | Auth/Tenant | Current role detected |
| D | Settings | restaurant_settings loaded (target_gpm, currency, locale, tax, tz) |
| E | Reference | Required units present (Ct, Gr, Kg, Lb, Oz, Ml, Lt, Gl) |
| E2 | Reference | Unit families correct (count, mass, volume) |
| E3 | Reference | Unit conversion factors correct |
| F | Reference | Mass↔mass conversions exist (>=16 rules) |
| G | Reference | Volume↔volume conversions exist (>=9 rules) |
| H | Reference | Ct only converts to Ct |
| J | Reference | No silent cross-family without density |
| K | Reference | menu_categories loaded |
| L | Reference | Default categories exist (10 defaults) |
| M | Roles | Duplicate menu category name rejected |
| N | Reference | Suppliers loaded |
| O | Roles | Duplicate supplier name rejected |
| P | Roles | Owner can update settings (no-op round-trip) |
| Q | Roles | Manager/viewer cannot update settings |
| R | RLS | menu_categories are tenant-scoped |
| S | RLS | Suppliers are tenant-scoped |
| T | Security | Service-role key not exposed to client |
| U | Security | Only expected Build 1.2 operational tables present |

**Expected:** All PASS for owner role. Some role-specific checks show WARN if current role cannot exercise them.

### Build 1.1A Settings/Admin Acceptance Checklist

- [ ] Owner can open `/settings`
- [ ] Owner can update General settings (name, currency, locale, timezone, tax mode, target GPM)
- [ ] Owner can update Alert Thresholds (spike %, GPM drop %, GP floor)
- [ ] Owner can add a Menu Category
- [ ] Owner can rename a Menu Category
- [ ] Owner can deactivate/activate a Menu Category
- [ ] Owner can add a Supplier
- [ ] Owner can rename a Supplier
- [ ] Owner can deactivate/activate a Supplier
- [ ] Units & Conversions tab is read-only
- [ ] Team tab is placeholder/read-only
- [ ] Duplicate menu category name shows friendly error
- [ ] Duplicate supplier name shows friendly error
- [ ] Empty category/supplier name is rejected
- [ ] Manager can manage Categories/Suppliers
- [ ] Manager cannot update General settings or Alert Thresholds
- [ ] Viewer is read-only across all tabs
- [ ] `/qa-settings-admin` checks A through U pass (or warn for role-specific items)
- [ ] Manual no-op write smoke test passes for owner
- [ ] No cross-tenant data visible (RLS verified by checks R and S)
- [ ] No service-role key exposed (verified by check T)
- [ ] Only expected Build 1.2 tables present (verified by check U)
- [ ] Operational pages still render mock data

---

## Future: Ingredients QA (Build 1.2)

- [ ] Ingredient creation with valid parameters
- [ ] Supplier selection from existing suppliers
- [ ] Unit conversion validation (family compatibility)
- [ ] Density required for cross-family conversion
- [ ] `adjustment !== -1` validation
- [ ] `recipe_unit_cost` computed server-side
- [ ] Duplicate name rejected (same restaurant)
- [ ] Soft delete preserves data
- [ ] RLS: viewer cannot create/update
- [ ] RLS: cross-tenant access blocked

---

## Future: Recipes QA (Build 1.3)

- [ ] Recipe creation with recipe lines
- [ ] Intermediate recipe creates linked Intermediate ingredient
- [ ] Intermediate recipe propagation updates linked ingredient cost
- [ ] Circular dependency detection prevents cycles
- [ ] COGS per serving computed server-side
- [ ] Duplicate name rejected (same restaurant)
- [ ] Soft delete preserves data
- [ ] RLS enforcement

---

## Future: Price Log / Snapshot QA (Build 1.5)

- [ ] Append-only price log — no UPDATE/DELETE possible
- [ ] Price update batch commits atomically
- [ ] Baseline initialization works
- [ ] Baseline reset is non-destructive (version bump, history preserved)
- [ ] Snapshot captures current cost state
- [ ] Prior/current cost deltas compute correctly
- [ ] Batch status transitions: draft → committed or failed
