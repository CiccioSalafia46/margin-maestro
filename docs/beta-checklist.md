# Beta Checklist — Build 2.0

Manual acceptance flows for beta readiness.

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
