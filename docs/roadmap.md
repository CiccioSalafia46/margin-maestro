# Roadmap

Forward implementation plan for Margin IQ — Restaurant Margin Intelligence SaaS.

---

## Build 2.8 — Google OAuth

**Status:** Accepted (Build 2.8A — live verification).

---

## Build 2.8A — Google OAuth + Live Accepted

**Status:** Accepted.

**Goal:** Live Vercel beta deployment with Google OAuth manually verified, deployment configuration documented, and supporting QA/docs updated.

**Highlights:**
- Live URL: https://margin-maestro.vercel.app
- Vercel project `margin-maestro`, GitHub auto-deploy on push to `main`
- Supabase Auth Site URL + Redirect URLs configured for prod, preview, local
- Google OAuth + email/password both verified live
- `/qa-live-deployment` added; QA copy refreshed across mvp-readiness, beta-launch, google-oauth, auth

**Deferred to future builds:** Stripe verification, Sentry provider setup, separate production Supabase project, transactional invite emails.

---

## Recommended next builds (post 2.8A)

- **Build 2.9 — Menu Price Audit Trail.** Append-only history of `recipes.menu_price` changes (who/when/old/new) for compliance and rollback.
- **Build 2.2B — Stripe Test Verification.** Exercise checkout + portal + webhook end-to-end on the live Vercel URL with Stripe test keys.
- **Build 3.0 — Recipe CSV Import.** Bulk import of dish recipes (header + lines) with validation and preview.
- **Build 3.1 — Transactional Invite Emails.** Real email delivery for `restaurant_invitations` (Supabase / Resend / Postmark).
- **Build 3.2 — Separate Production Supabase Migration.** Cut over from `margin-maestro-dev` to `margin-maestro-prod`. Migrate schema, then re-point Vercel env.
- **Build 3.3 — Production Monitoring Provider Setup.** Configure Sentry DSN + verify capture in production deploy.

---

## Build 1.0E — Persistent Supabase Session Hard Fix

**Status:** Accepted.

---

## Build 1.0F — Auth Acceptance Final

**Status:** Accepted.

---

## Build 1.1A — Settings/Admin Acceptance

**Status:** Accepted.

**Goal:** Re-verify Settings/Admin reference data layer after Auth is stable.

**Scope:**
- Run `/qa-settings-admin` full suite — all checks PASS
- Verify units, unit_conversions, menu_categories, suppliers
- Verify role-based access (owner/manager/viewer)
- Verify RLS tenant scoping
- Update `docs/current-state.md`

**Acceptance criteria:**
- All `/qa-settings-admin` checks A through U PASS
- Settings tabs render and save correctly
- Reference data is correctly seeded for new restaurants
- No cross-tenant data leakage

**Out of scope:** Ingredients, recipes, operational data.

---

## Build 1.2 / 1.2A — Ingredients Database

**Status:** Accepted.

---

## Build 1.3 / 1.3A — Recipes

**Status:** Accepted.

---

## Build 1.4 / 1.4A — Menu Analytics

**Status:** Accepted.

---

## Build 1.5 / 1.5A / 1.5B — Price Log + Snapshot + Price Trend

**Status:** Accepted.

---

## Build 1.6 — Dish Analysis

**Status:** Accepted.

---

## Build 1.7 — Impact Cascade

**Status:** Accepted.

---

## Build 1.8 / 1.8A — Alerts

**Status:** Accepted.

**Goal:** Supabase-backed alerts with generation from Menu Analytics, Impact Cascade, and Price Log. Status workflow: open → acknowledged → resolved/dismissed.

---

## Build 1.9 / 1.9A — Dashboard & MVP

**Status:** Accepted.

**Goal:** Supabase-backed dashboard. All operational pages now live. MVP feature-complete.

---

## Build 2.0 — Production Hardening & Beta Readiness

**Status:** Accepted.

**Goal:** Security review, deployment guide, beta checklist, production readiness documentation, MVP QA route.

---

## Build 2.1 / 2.1A — Team Management

**Status:** Accepted.

**Goal:** Invitation-based team management with role assignment, app-level invite links, and sole owner protection.

---

## Build 2.2 / 2.2A — Billing

**Status:** Accepted.

---

## Build 2.3 — Automated E2E QA

**Status:** Accepted.

---

## Build 2.4 / 2.4A — Apply Price Workflow

**Status:** Accepted.

---

## Build 2.5 / 2.5A — CSV Import/Export

**Status:** Accepted.

---

## Build 1.3 — Recipes

**Goal:** Introduce `recipes`, `recipe_lines`, `recipe_dependency_edges` in Supabase.

**Scope:**
- Migration: `recipes`, `recipe_lines`, `recipe_dependency_edges` tables
- Intermediate recipe resolution (Intermediate ingredient ↔ Intermediate recipe linkage)
- Cycle detection in recipe dependency graph
- Server-side `recalculate_recipe_cogs()` function
- Swap `/recipes` page from mock to Supabase

**Acceptance criteria:**
- Recipe CRUD with recipe lines
- Intermediate recipe propagation works
- Circular dependency detection prevents cycles
- COGS per serving computed server-side
- Existing QA routes still pass

**Out of scope:** Menu items, price log, snapshots, cascade, alerts, billing.

---

## Build 1.4 — Menu Analytics

**Goal:** Persist dish/menu analytics with `menu_items` and `menu_profitability_snapshots`.

**Scope:**
- Migration: `menu_items`, `menu_profitability_snapshots` tables
- Swap `/menu-analytics` page from mock to Supabase
- GP, GPM, on-target status from server-side calculations
- `recalculate_restaurant_costs()` orchestrator function

**Acceptance criteria:**
- Menu items linked to Dish recipes
- Menu price, on/off menu status
- GP and GPM computed server-side
- Profitability snapshots taken
- Existing QA routes still pass

**Out of scope:** Price log, snapshots, cascade, alerts, billing.

---

## Build 1.5 — Price Log + Snapshot

**Goal:** Append-only price log and non-destructive snapshot/baseline model.

**Scope:**
- Migration: `ingredient_price_log`, `ingredient_snapshots`, `price_update_batches` tables
- Append-only INSERT policy on price log (no UPDATE, no DELETE, ever)
- `initialize_restaurant_baseline()` function
- `reset_baseline_non_destructive()` function (bumps version, adds rows, never deletes)
- Swap `/price-log` and `/price-trend` pages from mock to Supabase

**Acceptance criteria:**
- Price log is append-only — no mutations possible
- Baseline reset is non-destructive — history preserved
- Batch grouping works
- Prior/current cost deltas compute correctly
- Existing QA routes still pass

**Out of scope:** Impact cascade persistence, alerts persistence, billing.

---

## Build 1.6 — Recalculation Cascade

**Goal:** Server-side recalculation of ingredient costs, intermediate recipes, and dish COGS on price changes.

**Scope:**
- `run_price_update_batch()` orchestrator: price log → cost state → recalculate → snapshot
- Full server-side cost propagation: ingredient → intermediate → dish
- No new tables (orchestrates existing tables from Builds 1.2–1.5)

**Acceptance criteria:**
- Price update batch commits atomically
- Cost propagation follows dependency edges
- Intermediate recipe costs update linked ingredient costs
- Menu profitability snapshots taken after batch
- Rollback on failure

**Out of scope:** Impact cascade persistence, alerts persistence, billing.

---

## Build 1.7 — Impact Cascade Persistence

**Goal:** Persist impact cascade runs and items in Supabase.

**Scope:**
- Migration: `impact_cascade_runs`, `impact_cascade_items` tables
- `generate_impact_cascade(batch_id)` function
- Swap `/impact-cascade` page from mock to Supabase

**Acceptance criteria:**
- Cascade generated for each committed batch
- Direct and indirect pathways tracked
- Per-dish COGS/GPM impact computed
- Cascade idempotent per batch_id
- Existing QA routes still pass

**Out of scope:** Alerts persistence, billing.

---

## Build 1.8 — Alerts Persistence

**Goal:** Persist alerts and status workflows in Supabase.

**Scope:**
- Migration: `alerts`, `audit_events` tables
- `generate_alerts_for_restaurant()` function
- Alert status workflow: open → acknowledged → resolved
- Swap `/alerts` page from mock to Supabase

**Acceptance criteria:**
- Alerts generated on batch commit
- Four alert types: dish_below_target, ingredient_spike, dish_needs_price_review, intermediate_cost_shift
- Status transitions enforced (only status fields writable by owner/manager)
- Audit trail for membership changes, baseline resets, batch commits
- Existing QA routes still pass

**Out of scope:** CSV import/export, billing.

---

## Build 1.9 — CSV Import/Export

**Goal:** Safe import/export workflows for ingredients, recipes, and price updates.

**Scope:**
- Streaming CSV import with validation
- CSV export for ingredients, recipes, menu analytics
- Error reporting per row

**Acceptance criteria:**
- Import validates data before committing
- Duplicate names handled
- Unit validation enforced
- Export includes all relevant fields

**Out of scope:** Billing.

---

## Build 2.0 — Billing

**Goal:** Subscription billing via Stripe, Paddle, or selected provider.

**Scope:**
- Billing provider integration
- Subscription tiers
- Webhook server routes
- `subscriptions` mirror table

**Acceptance criteria:**
- Payment flow works end-to-end
- Subscription status enforced
- Webhook handles events reliably
- No billing data leakage across tenants
