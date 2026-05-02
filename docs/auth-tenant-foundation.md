# Auth + Tenant Foundation

Auth and multi-tenant architecture for Margin IQ.

---

## Auth Routes

| Route | Public? | Purpose |
|-------|---------|---------|
| `/login` | Public | Email + password sign-in |
| `/signup` | Public | Email + password sign-up |
| `/auth/callback` | Public | OAuth/email-link callback handler |
| `/onboarding/create-restaurant` | Auth required, no membership | Creates the user's first restaurant |
| `/qa-auth` | Public | Read-only diagnostics for auth/tenant/RLS |
| All other app routes | Auth + membership required | Operational pages |

---

## Signup / Login Behavior

### Signup (`src/routes/signup.tsx`)
1. User submits email, password, optional full name.
2. Calls `supabase.auth.signUp()` with `emailRedirectTo: /auth/callback`.
3. If immediate session returned (email confirmation disabled): calls `refreshAuth()`, navigates to `/`.
4. If email confirmation required: shows confirmation message, stays on signup page.

### Login (`src/routes/login.tsx`)
1. User submits email and password.
2. Calls `signInWithPassword(email, password)` via `authApi.ts`.
3. Calls `refreshAuth()` to update AuthProvider context.
4. Verifies `session.user` exists.
5. Navigates to `/` (AuthGate redirects to `/dashboard` or `/onboarding`).

### Auth Callback (`src/routes/auth.callback.tsx`)
1. Supabase redirects here after email confirmation or OAuth.
2. Calls `refreshAuth()` from AuthProvider.
3. Navigates to `/`.

---

## Onboarding — Create Restaurant

(`src/routes/onboarding.create-restaurant.tsx`)

- Users with zero memberships are redirected here by AuthGate.
- Form: restaurant name (required).
- Submission calls RPC `create_restaurant_with_owner(p_name)`, which inserts:
  1. `restaurants` row owned by the current user.
  2. `restaurant_members` row with `role = 'owner'`.
  3. `restaurant_settings` row with defaults (target_gpm 0.78, currency USD, locale en-US, tax_mode ex_tax, timezone America/New_York).
  4. Default reference data via `initialize_restaurant_reference_data()` (menu categories, suppliers).
- On success: calls `refreshTenants()`, navigates to `/dashboard`.

---

## Tenant Model

### Profiles (`profiles`)
- 1:1 with `auth.users`.
- Auto-created by trigger `on_auth_user_created` on signup.
- Fields: id, email, full_name, avatar_url.
- RLS: user reads/updates only own row.

### Restaurants (`restaurants`)
- Tenant root. Every future operational table carries `restaurant_id`.
- Fields: id, name, created_by, created_at, updated_at.
- RLS: members can read; owner can update.

### Restaurant Members (`restaurant_members`)
- Junction table: user ↔ restaurant with role.
- Fields: restaurant_id, user_id, role (owner/manager/viewer), created_at.
- Constraint: unique(restaurant_id, user_id).
- Trigger: `protect_sole_owner` prevents removal of the last owner.
- RLS: members can read; owner can manage.

### Restaurant Settings (`restaurant_settings`)
- 1:1 with restaurants. Per-tenant configuration.
- Fields: restaurant_id (PK), currency_code, locale, target_gpm, tax_mode, timezone, ingredient_spike_threshold_percent, gpm_drop_threshold_percent, gp_floor_amount.
- RLS: members read; owner update.

---

## Roles

| Capability | Owner | Manager | Viewer |
|------------|:-----:|:-------:|:------:|
| Read everything in tenant | Yes | Yes | Yes |
| Manage members + roles | Yes | No | No |
| Update restaurant + settings | Yes | No | No |
| CRUD categories / suppliers | Yes | Yes | No |
| Future: CRUD ingredients / recipes / menu | Yes | Yes | No |
| Future: Run price update batch | Yes | Yes | No |
| Future: Reset baseline | Yes | No | No |
| Future: Acknowledge/resolve alerts | Yes | Yes | No |

Role checks flow through SECURITY DEFINER helpers (`is_restaurant_member()`, `has_restaurant_role()`) to avoid recursive RLS policies.

---

## Active Restaurant Behavior

- The active restaurant is held in `AuthProvider` React state only.
- It defaults to the first membership returned by `listMyRestaurants()`.
- It is **not** persisted to `localStorage`, `sessionStorage`, or cookies.
- Reloading the tab resets the active restaurant to the default.
- The topbar shows the active restaurant name with a dropdown to switch.
- The switcher only re-points in-memory `activeRestaurantId`. Operational pages still render mock data and do not re-query per restaurant until their respective builds.

**Future consideration:** A server-side user preference for "last active restaurant" may be added, but `activeRestaurantId` must never come from localStorage.

---

## Sign Out Behavior

- `signOut()` calls `supabase.auth.signOut()`.
- Clears all React auth state: session, profile, memberships, activeRestaurantId, restaurantSettings.
- Redirects to `/login`.

---

## AuthGate Behavior

(`src/auth/AuthGate.tsx`)

| State | Path | Action |
|-------|------|--------|
| `loading` | any | No redirect — wait for hydration |
| `unauthenticated` | non-public | Redirect to `/login` |
| `unauthenticated` | public path | Allow |
| `authenticated`, no memberships | non-onboarding | Redirect to `/onboarding/create-restaurant` |
| `authenticated`, has restaurant | public/onboarding/root | Redirect to `/dashboard` |
| `authenticated`, has restaurant | other | Allow |

Public paths: `/login`, `/signup`, `/auth/callback`, `/qa-auth`.

---

## RLS Helper Functions

### `is_restaurant_member(user_id, restaurant_id)`
Returns `true` if the user has any membership in the restaurant. SECURITY DEFINER.

### `has_restaurant_role(user_id, restaurant_id, role)`
Returns `true` if the user has the specified role or higher. Role hierarchy: viewer < manager < owner. SECURITY DEFINER.

### `create_restaurant_with_owner(p_name)`
Inserts restaurant + owner membership + settings + reference data in one transaction. SECURITY DEFINER.

---

## SECURITY DEFINER Notes

All SECURITY DEFINER functions:
- Set `search_path = public` to prevent search_path injection.
- Have EXECUTE revoked from PUBLIC and anon.
- Have EXECUTE granted to `authenticated` role only.
- Are used in RLS policies to avoid recursive subqueries on `restaurant_members`.

---

## Current Known Limitation: Session Persistence Bug

As of Build 1.0E (branch `build-1.0e-auth-session-fix`), the Supabase Auth session is lost on page refresh and navigation. The Supabase client is configured with `persistSession: true` and `storage: localStorage` (conditional on `typeof window !== 'undefined'`), but the Proxy singleton pattern combined with TanStack Start's SSR architecture may cause the client to initialize with `storage: undefined` in a server context.

**This is the current blocker.** Build 1.0E aims to fix this.

---

## activeRestaurantId Policy

`activeRestaurantId` must remain in React memory only. It is derived from `restaurant_members` on each session load. It must NOT be stored in:
- `localStorage`
- `sessionStorage`
- Cookies
- URL search params (as authoritative source)

A future server-side user preference (stored in `profiles` or a separate table) may be added to remember the last-used restaurant across sessions, but this is not in scope until explicitly approved.
