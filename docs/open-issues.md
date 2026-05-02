# Open Issues

Known issues and limitations for Margin IQ.

---

## Resolved

### OI-01 — Auth session lost on refresh / navigation

**Severity:** Critical
**Status:** Resolved — Build 1.0E/1.0F
**Resolution:** Removed Proxy singleton and explicit `storage` option from Supabase client. Removed `/qa-auth` from AuthGate's `PUBLIC_PATHS`.

---

### OI-02 — /qa-auth shows sign-in required after login

**Severity:** Critical
**Status:** Resolved — Build 1.0E-A/1.0F
**Resolution:** `/qa-auth` removed from `PUBLIC_PATHS` so authenticated users are no longer redirected to `/dashboard`.

---

## High

### OI-03 — Settings/Admin pending re-acceptance

**Severity:** High
**Status:** Resolved — Build 1.1A
**Resolution:** Settings/Admin re-accepted. `/qa-settings-admin` checks A through U pass (or warn for non-critical/role-specific items). Auth stable since Build 1.0F.

---

## Medium

### OI-04 — Operational data still mock

**Severity:** Medium
**Affected area:** Dashboard, ingredients, recipes, menu analytics, dish analysis, impact cascade, price log, price trend, alerts
**Status:** By design — migration planned per build
**Planned build:** Builds 1.2 through 1.8

**Description:** All operational pages render from `src/data/mock.ts`. Data is not tenant-scoped and does not reflect real restaurant data.

**Acceptance criteria:** Each domain migrates to Supabase in its designated build.

---

### OI-05 — Google OAuth not enabled

**Severity:** Medium
**Affected area:** `/login`, `/signup`
**Status:** Open
**Planned build:** Not yet scheduled

**Description:** Auth is email/password only. Google OAuth redirect URL is configured in code (`emailRedirectTo: /auth/callback`) but Google provider is not enabled in the Supabase project.

**Acceptance criteria:** Google sign-in works end-to-end with proper redirect handling.

---

### OI-06 — Restaurant switcher limited

**Severity:** Medium
**Affected area:** Topbar, all operational pages
**Status:** Open — by design for current builds
**Planned build:** Build 1.2+ (when operational data is tenant-scoped)

**Description:** The restaurant switcher only changes the in-memory `activeRestaurantId`. Operational pages still render mock data and do not re-query per restaurant.

**Acceptance criteria:** Switching restaurants re-scopes all data queries to the selected tenant.

---

### OI-07 — Production session strategy

**Severity:** Medium
**Affected area:** Auth
**Status:** Open
**Planned build:** Build 1.0E (initial fix), future hardening

**Description:** Current session persistence uses `localStorage` via Supabase's built-in mechanism. Production deployment on Cloudflare Workers may require additional considerations for cookie-based sessions or token refresh strategy.

**Acceptance criteria:** Sessions persist reliably in production deployment.

---

## Low

### OI-08 — Team management placeholder

**Severity:** Low
**Affected area:** `/settings` → Team tab
**Status:** Placeholder UI
**Planned build:** Not yet scheduled

**Description:** The Team tab in Settings shows a read-only list of current members and their roles. No invite, role change, or member removal functionality.

**Acceptance criteria:** Owner can invite members, change roles, and remove members.

---

### OI-09 — Suppliers not linked to ingredients

**Severity:** Low
**Affected area:** `/settings` → Suppliers, future `/ingredients`
**Status:** By design for current builds
**Planned build:** Build 1.2

**Description:** Suppliers exist as reference data in Settings but are not yet linked to ingredients via a foreign key.

**Acceptance criteria:** Ingredients reference `supplier_id` from the `suppliers` table.

---

### OI-10 — Custom unit management not exposed

**Severity:** Low
**Affected area:** `/settings` → Units tab
**Status:** By design
**Planned build:** Not yet scheduled

**Description:** The Units tab is read-only. Custom units cannot be added or modified by users. The `units` table is global (not per-restaurant).

**Acceptance criteria:** TBD — may remain read-only if the standard unit set covers all use cases.

---

### OI-11 — Mobile polish

**Severity:** Low
**Affected area:** All pages
**Status:** Functional but not polished
**Planned build:** Not yet scheduled

**Description:** The app is functional on mobile via responsive layout but not optimized for mobile-first workflows.

**Acceptance criteria:** Key workflows (dashboard, alerts, price log) are comfortable on mobile.
