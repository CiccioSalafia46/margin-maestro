# Security Review — Build 3.1 (transactional invite emails)

> **Build 3.1 update.** New Supabase Edge Function `send-team-invitation`. Auth: requires authenticated JWT; defensive `verifyRestaurantOwner` server-side. Reads invitation server-side via service-role admin client; validates `status='pending'` + not expired. Returns sanitized `{ sent, provider_configured, message }`; never returns raw provider response; never logs invite tokens or provider secrets. Provider secrets (`RESEND_API_KEY`, `FROM_EMAIL`, `SITE_URL`) live exclusively in Edge Function env — never `VITE_`-prefixed, never in Vercel frontend env. Manual clipboard copy is the source of truth; email failure does not block invitation creation. See `docs/transactional-invite-emails.md`.

---

# Security Review — Build 3.4A (atomic RPC accepted)

> **Build 3.4A update.** SQL function `public.apply_dish_menu_price_with_audit(...)` live-verified. `pg_proc` confirms `security = INVOKER`, correct argument signature, and ACL `postgres=X, authenticated=X, service_role=X` (no `public` or `anon` grant). Probe call rejects unauthenticated callers with `42501` from the defensive auth check inside the function body. No service-role usage; no client-exposed secrets. No new tables. No RLS changes. See `docs/atomic-rpc-hardening.md`.

---

## Build 2.8A baseline

> **Live update (Build 2.8A).** Live URL https://margin-maestro.vercel.app. Vercel env vars set for the frontend contain only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, and the non-prefixed `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` fallbacks. Service role, Stripe, and Google secrets are explicitly NOT configured in Vercel frontend env. See `docs/live-deployment.md` for the env table. `.env` is no longer tracked in git (was previously committed pointing at a stale Lovable sandbox; cleaned in Build 2.8A — see OI-15).

---

## Build 2.0 baseline (preserved below)

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
