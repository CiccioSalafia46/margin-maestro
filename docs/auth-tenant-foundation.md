# Auth + Tenant Foundation — Build 1.0B

This document describes the auth and multi-tenant model accepted in
Build 1.0B. It is the foundation that all later operational tables
(ingredients, recipes, etc.) will build on.

## Auth routes

| Route | Public? | Purpose |
| --- | --- | --- |
| `/login` | Public | Email + password sign-in. |
| `/signup` | Public | Email + password sign-up. |
| `/auth/callback` | Public | OAuth/email-link callback handler. |
| `/onboarding/create-restaurant` | Authenticated, no membership | Creates the user's first restaurant. |
| `/qa-auth` | Authenticated | Read-only diagnostics for auth/tenant/RLS. |
| All other app routes | Authenticated + ≥1 membership | Operational mock pages. |

## Onboarding

- A signed-in user with **zero memberships** is sent to
  `/onboarding/create-restaurant`.
- Submitting the form calls the SECURITY DEFINER RPC
  `create_restaurant_with_owner(p_name)`, which inserts:
  1. `restaurants` row owned by the current user.
  2. `restaurant_members` row with `role = 'owner'`.
  3. `restaurant_settings` row with platform defaults
     (`target_gpm = 0.78`, currency `USD`, locale `en-US`,
     `tax_mode = 'ex_tax'`, `timezone = 'America/New_York'`).
- On success the client refreshes tenant data and navigates to `/dashboard`.

## Tenant model

- A **restaurant** is the tenant boundary. Every future operational table
  will carry `restaurant_id`.
- A **user** can belong to multiple restaurants via `restaurant_members`.
- Roles: `owner`, `manager`, `viewer`.

## Active restaurant

- The active restaurant is held in `AuthProvider` React state only. It
  defaults to the first membership returned by `listMyRestaurants()`.
- It is **not** persisted to `localStorage`, `sessionStorage`, or cookies.
  Reloading the tab resets the active restaurant to the default.
- The topbar shows the active restaurant name; an inline dropdown lets the
  user switch between memberships in-memory.

### Restaurant switcher — current limitation

The switcher only re-points the in-memory `activeRestaurantId`. Operational
pages still render mock data and **do not** re-query per restaurant.
Per-tenant data scoping will land with Build 1.1+ when ingredients/recipes
move to Supabase.

## Sign out

- `signOut()` calls `supabase.auth.signOut()`, clears local React auth
  state (session, profile, memberships, active restaurant), and redirects
  to `/login`.

## Route guard behavior

Implemented in `src/auth/AuthGate.tsx`:

| State | Path | Action |
| --- | --- | --- |
| `loading` | any | Render children, no redirect. |
| `unauthenticated` | non-public | Redirect to `/login`. |
| `unauthenticated` | `/login`, `/signup`, `/auth/callback` | Allow. |
| `authenticated`, no memberships | non-onboarding | Redirect to `/onboarding/create-restaurant`. |
| `authenticated`, ≥1 membership | `/login`, `/signup`, `/auth/callback`, `/onboarding/create-restaurant`, `/` | Redirect to `/dashboard`. |
| `authenticated`, ≥1 membership | other | Allow. |

No redirect loops were observed across `/login → /onboarding → /dashboard`.
