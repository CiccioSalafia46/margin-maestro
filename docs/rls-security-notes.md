# RLS & Security Notes — Build 1.0B

## Tables protected by RLS

All four tenant/auth tables have RLS **enabled**:

- `public.profiles`
- `public.restaurants`
- `public.restaurant_members`
- `public.restaurant_settings`

No other operational tables exist in this build.

## Helper functions (SECURITY DEFINER)

| Function | Purpose | Notes |
| --- | --- | --- |
| `is_restaurant_member(p_restaurant_id uuid)` | Returns true if `auth.uid()` is a member of the restaurant. | `STABLE`, `SET search_path = public`. Used by `*_select_member` policies. |
| `has_restaurant_role(p_restaurant_id uuid, p_roles text[])` | Returns true if `auth.uid()` has any of the listed roles in the restaurant. | `STABLE`, `SET search_path = public`. Used by owner-only policies. |
| `create_restaurant_with_owner(p_name text)` | Transactional onboarding: creates restaurant, owner membership, and default settings. | Validates `auth.uid()` and trimmed name. |
| `handle_new_user()` | Trigger on `auth.users` insert; creates `profiles` row. | Idempotent via `on conflict (id) do nothing`. |
| `protect_sole_owner()` | Trigger on `restaurant_members`; blocks deleting or demoting the sole owner. | Raises exception if last owner would be removed. |
| `tg_set_updated_at()` | Generic `updated_at` touch trigger. | `SET search_path = public`. |

### SECURITY DEFINER notes

- All sensitive functions set `search_path = public` to prevent
  search_path attacks.
- `EXECUTE` has been **revoked from `PUBLIC` and `anon`** on the helper
  functions. `EXECUTE` is granted **only to `authenticated`** where required
  by RLS policies.
- The Supabase linter currently reports 3 `WARN` entries
  (`0029_authenticated_security_definer_function_executable`) for
  `is_restaurant_member`, `has_restaurant_role`, and
  `create_restaurant_with_owner`. These are **intentional**: signed-in
  users must be able to call these functions for RLS and onboarding to
  work. The warnings are accepted for Build 1.0B.

## Policy summary

### `profiles`
- **SELECT** (`profiles_select_own`): a user can read only their own row
  (`id = auth.uid()`).
- **UPDATE** (`profiles_update_own`): a user can update only their own row.
- INSERT/DELETE: not allowed via RLS. Inserts happen via the
  `handle_new_user` trigger on signup.

### `restaurants`
- **SELECT** (`restaurants_select_member`): visible only to members
  (`is_restaurant_member(id)`).
- **UPDATE** (`restaurants_update_owner`): owners only.
- INSERT/DELETE: not allowed via RLS. Inserts happen through the
  `create_restaurant_with_owner` RPC.

### `restaurant_members`
- **SELECT** (`restaurant_members_select`): members can see other members
  of their own restaurant.
- **INSERT** (`restaurant_members_insert_owner`): owners only, and
  **cannot insert themselves** (`user_id <> auth.uid()`) — prevents self
  role escalation.
- **UPDATE** (`restaurant_members_update_owner`): owners only, and cannot
  edit their own membership row.
- **DELETE** (`restaurant_members_delete_owner`): owners only.
- The `protect_sole_owner` trigger additionally blocks removing or
  demoting the last owner.

### `restaurant_settings`
- **SELECT** (`restaurant_settings_select_member`): visible to members.
- **UPDATE** (`restaurant_settings_update_owner`): owners only.
- INSERT/DELETE: not allowed via RLS. The settings row is created by
  `create_restaurant_with_owner`.

## Access control invariants

- A user cannot promote themselves to a higher role in a restaurant they
  already belong to (no UPDATE policy lets them touch their own member
  row).
- A user cannot insert themselves into another restaurant.
- A non-owner cannot modify settings.
- The last owner cannot be removed or demoted (`protect_sole_owner`).

## Service role

- `SUPABASE_SERVICE_ROLE_KEY` is **not exposed to the client**. It is
  only available to server-side code (`@/integrations/supabase/client.server`),
  which is not imported anywhere in the current Build 1.0B client bundle.
- The frontend uses the publishable key only.

## Session / storage posture

- `persistSession: false` and `storage: undefined` on the browser
  Supabase client.
- **No `localStorage` activeRestaurantId is written** by the app. The
  previous `marginiq.activeRestaurantId` key has been removed from
  `tenantApi.ts` and `AuthProvider.tsx`.
- No tokens, refresh tokens, service role keys, or raw session JSON are
  rendered in any UI, including `/qa-auth`.
