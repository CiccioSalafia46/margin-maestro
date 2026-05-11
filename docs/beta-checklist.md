# Beta Checklist — Build 2.9

Manual acceptance flows for beta readiness.

> **Build 2.9A add-on.** When verifying Apply Price or manual recipe `menu_price` edits, also confirm a row appears in `menu_price_audit_log` for the affected dish (visible in the read-only panel on `/dish-analysis/$id`). Live-verified during Build 2.9A.

> **Build 3.0 / 3.0A add-on (accepted).** Recipe CSV Import (Settings → Import / Export → Import Recipes): live-verified. The acceptance flow: small CSV with an existing ingredient → preview shows correct counts → apply with `duplicate_mode = 'skip'` and `line_mode = 'append'` → new dish menu_price produces a `source = 'import'` row in `menu_price_audit_log` (visible on `/dish-analysis/$id`). Recipe import is owner/manager only; viewers do not see the card.

> **Build 3.4 / 3.4A add-on (accepted).** Atomic RPC deployed live and verified. Acceptance flow remains the practical test: exercise Apply Price on a live dish from `/menu-analytics` and `/dish-analysis/$id` — confirm success toast says "Menu price updated to $X and audit entry recorded.", verify the audit row appears with `audit_log_id` populated. Then run an UPDATE-mode Recipe CSV Import on an existing dish to confirm the import path also writes an atomic audit row with `source = 'import'`.

## A. Auth and Onboarding
- [ ] Signup with email/password
- [ ] Login
- [ ] Create restaurant (onboarding)
- [ ] Sign out and sign in
- [ ] Session survives refresh
- [ ] Session survives navigation

## B. Settings/Admin
- [ ] Update General settings (name, currency, target GPM)
- [ ] Verify units (8 units present)
- [ ] Add/rename/deactivate menu category
- [ ] Add/rename/deactivate supplier
- [ ] Update alert thresholds

## C. Ingredients
- [ ] Create primary ingredient
- [ ] Create fixed ingredient
- [ ] Create intermediate ingredient
- [ ] Edit ingredient
- [ ] Deactivate ingredient
- [ ] Cost state calculated correctly

## D. Recipes
- [ ] Create dish recipe
- [ ] Create intermediate recipe
- [ ] Add/edit/remove recipe lines
- [ ] Intermediate propagation updates linked ingredient cost
- [ ] Cycle detection blocks circular dependencies

## E. Menu Analytics
- [ ] Verify COGS/GP/GPM for priced dishes
- [ ] Missing price shows incomplete
- [ ] Incomplete costing shows warning
- [ ] Suggested price displays

## F. Price Log / Snapshot
- [ ] Initialize baseline
- [ ] Run price update batch
- [ ] Verify append-only log entries
- [ ] Verify snapshot update

## G. Price Trend
- [ ] Select ingredient with price history
- [ ] Chart renders
- [ ] KPIs display correctly

## H. Dish Analysis
- [ ] Line breakdown displays
- [ ] Scenario sliders work (local-only)
- [ ] Margin manager shows suggested prices

## I. Impact Cascade
- [ ] Generate cascade after price update batch
- [ ] Verify affected dishes
- [ ] Verify newly below target count

## J. Alerts
- [ ] Generate alerts
- [ ] Acknowledge alert
- [ ] Resolve alert
- [ ] Dismiss alert

## K. Dashboard
- [ ] Alert-first summary displays
- [ ] KPI cards display
- [ ] No mock data visible
- [ ] Recommended actions display
