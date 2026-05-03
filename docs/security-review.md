# Security Review — Build 2.0

## A. Supabase Client Safety

- Browser client uses publishable/anon key only (`VITE_SUPABASE_PUBLISHABLE_KEY`)
- No `VITE_SUPABASE_SERVICE_ROLE_KEY` exists in client env
- `client.server.ts` uses `process.env.SUPABASE_SERVICE_ROLE_KEY` (server-only, never VITE-prefixed)
- `/qa-auth` verifies `typeof import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY === "undefined"`
- No direct server secrets in browser bundle

## B. Auth / Session

- Supabase Auth `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`
- Storage: Supabase built-in default (localStorage in browser, in-memory on server)
- `activeRestaurantId` is React state only — NOT in localStorage
- Role, membership, settings derived from Supabase queries, not client storage
- Authorization flows through `restaurant_members` + RLS helpers

## C. RLS Coverage

| Table | RLS | Select | Insert | Update | Delete |
|-------|-----|--------|--------|--------|--------|
| `profiles` | Yes | Own row | — | Own row | — |
| `restaurants` | Yes | Member | — | Owner | — |
| `restaurant_members` | Yes | Member | Owner | Owner | Owner |
| `restaurant_settings` | Yes | Member | — | Owner | — |
| `units` | Yes | Authenticated | — | — | — |
| `unit_conversions` | Yes | Authenticated | — | — | — |
| `menu_categories` | Yes | Member | Owner/Manager | Owner/Manager | — |
| `suppliers` | Yes | Member | Owner/Manager | Owner/Manager | — |
| `ingredients` | Yes | Member | Owner/Manager | Owner/Manager | — |
| `ingredient_cost_state` | Yes | Member | Owner/Manager | Owner/Manager | — |
| `recipes` | Yes | Member | Owner/Manager | Owner/Manager | — |
| `recipe_lines` | Yes | Member | Owner/Manager | Owner/Manager | Owner/Manager |
| `price_update_batches` | Yes | Member | Owner/Manager | Owner/Manager | — |
| `ingredient_price_log` | Yes | Member | Owner/Manager | **None** | **None** |
| `ingredient_snapshots` | Yes | Member | Owner/Manager | Owner/Manager | — |
| `impact_cascade_runs` | Yes | Member | Owner/Manager | Owner/Manager | — |
| `impact_cascade_items` | Yes | Member | Owner/Manager | — | Owner/Manager |
| `alerts` | Yes | Member | Owner/Manager | Owner/Manager | — |

Key: `ingredient_price_log` is append-only — no UPDATE or DELETE policy.

## D. Known Security Limitations

- Google OAuth not enabled
- Team invite flow not implemented
- Production monitoring not implemented
- Formal external security audit not done
- Automated E2E security tests not complete
- No CSRF protection beyond Supabase defaults
- No rate limiting on API calls beyond Supabase defaults
