# Current State — Build 1.0B

**Phase:** Auth + tenant foundation accepted. Operational data is still
the frontend mock dataset.

**Backend scope (Supabase, live):**
- Authentication (email/password)
- `profiles`
- `restaurants`
- `restaurant_members`
- `restaurant_settings`

**Backend scope (NOT yet implemented):**
- ingredients
- recipes / recipe lines
- menu_items
- price log
- ingredient snapshots
- impact cascade persistence
- alerts persistence
- billing / subscriptions
- CSV import/export
- Edge Functions

## Auth / tenant behavior

- Sign in with email + password.
- New users are routed to `/onboarding/create-restaurant`.
- `create_restaurant_with_owner` creates the restaurant, owner membership,
  and default `restaurant_settings` row in one transaction.
- After onboarding, users land on `/dashboard` and see the Italian mock
  dataset, scoped to the active restaurant in the topbar switcher.

## Sessions

- Sessions are currently **in-memory only** (`persistSession: false`,
  `storage: undefined`) to comply with the no-localStorage rule of this build
  phase. Hard reload requires re-login.
- **Production session persistence is a future task** (cookie-based or
  approved storage). Tracked as a Build 1.x item, not in 1.0.

## Operational pages (still mock)

`/dashboard`, `/ingredients`, `/recipes`, `/menu-analytics`,
`/dish-analysis`, `/impact-cascade`, `/price-trend`, `/price-log`,
`/alerts`, `/settings`, `/qa-calculations`, `/qa-data-integrity` continue
to read from `src/data/mock.ts` and the derived selectors. No writes hit
Supabase from these pages.

## Known limitations carried from earlier builds

- All write actions on operational pages are UI-only ("Demo only").
- "Run Price Update" intentionally disabled.
- Alerts cannot be acknowledged/resolved.
- Snapshot reset / Price Log append not wired to any backend.
- No multi-tenant data scoping in mock pages — switching restaurants in the
  topbar does not change the displayed mock data yet.
- Google OAuth is not enabled.
- Mobile is functional but not polished.
