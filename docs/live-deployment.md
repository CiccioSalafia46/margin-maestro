# Live Deployment

**Build:** 2.8A — Google OAuth + Live Accepted
**Last update:** 2026-05-10

This document describes the live beta deployment of Margin IQ.

---

## Hosting

| Layer | Provider | Identifier |
|---|---|---|
| Frontend / SSR | Vercel | project `margin-maestro` (scope `salafiafrancescos-projects`) |
| Backend / Database / Auth | Supabase | project `margin-maestro-dev` (ref `atdvrdhzcbtxvzgvoxhb`, region eu-west-1) |
| Source repo | GitHub | `CiccioSalafia46/margin-maestro` (Vercel auto-deploy on push to `main`) |

**Live URL:** https://margin-maestro.vercel.app

---

## Build adapter

Margin IQ is a TanStack Start SSR app. The repo includes Cloudflare Workers wiring (`@cloudflare/vite-plugin`, `wrangler.jsonc`), but for the Vercel target the Cloudflare plugin is disabled at build time:

```ts
// vite.config.ts
export default defineConfig({
  cloudflare: false,
  vite: { server: { port: 8085 }, build: { target: "es2022" } },
});
```

The SSR bundle is emitted at `dist/server/server.js` (Web Fetch handler). It is wrapped by a Vercel Node.js Function:

```
api/server.mjs   →  Node.js (req, res) → Web Request → server.fetch(request) → Response → Node res
```

`vercel.json` declares:
- `buildCommand: npm run build`
- `outputDirectory: dist/client`
- `functions.api/server.mjs.includeFiles: dist/server/**` so the SSR bundle is deployed alongside the function.
- `rewrites`: every path that is not `/api/...`, `/assets/...`, `favicon.ico`, or `robots.txt` is sent to `/api/server`.

---

## Vercel environment variables

Configured via `vercel env add` for both Production and Preview. Values are not displayed here.

| Name | Production | Preview | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | ✓ | ✓ | Browser-visible Supabase URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✓ | ✓ | Browser-visible anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | ✓ | ✓ | Browser-visible project ref |
| `SUPABASE_URL` | ✓ | ✓ | Server-side fallback |
| `SUPABASE_PUBLISHABLE_KEY` | ✓ | ✓ | Server-side fallback |

**Not configured in Vercel frontend env (intentional):**

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `VITE_GOOGLE_CLIENT_SECRET`
- `VITE_SUPABASE_SERVICE_ROLE_KEY`
- `VITE_STRIPE_SECRET_KEY`

These must never be added to the Vercel project as frontend-visible variables. Stripe edge functions are deployed to Supabase via `supabase secrets set` separately.

---

## Supabase Auth URL configuration

Configured via `supabase config push` from `supabase/config.toml [auth]`.

**Site URL:** `https://margin-maestro.vercel.app`

**Additional redirect URLs (16):**

Production (7): root, `/**`, `/dashboard`, `/login`, `/signup`, `/accept-invite`, `/auth/callback`.

Vercel preview (1): `https://*-salafiafrancescos-projects.vercel.app/**` (covers all preview branches).

Local dev (7): `http://localhost:8085` + the same five paths.

Legacy sandbox (1): `http://localhost:8082/**`.

**Other auth settings preserved at remote defaults** (push diff verified): `enable_signup=true`, `enable_confirmations=true` (email), `mfa.totp.enroll_enabled=true`, `mfa.totp.verify_enabled=true`, `email.max_frequency=1m0s`, `email.otp_length=8`, `enable_refresh_token_rotation=true`, `jwt_expiry=3600`.

---

## Auth surface

| Method | Status |
|---|---|
| Email + password sign-up | ✓ enabled, email confirmation required |
| Email + password sign-in | ✓ enabled |
| Google OAuth | ✓ enabled — manually verified live |
| Magic link / OTP | ✓ available via Supabase defaults |
| Apple / GitHub / etc. | ☐ not enabled |

Authorization continues to come exclusively from Supabase Auth + RLS + `restaurant_members`. No tenant, role, membership, or provider-token data is persisted in `localStorage`.

---

## Edge Functions

| Function | Build | Purpose | Required secrets |
|---|---|---|---|
| `create-checkout-session` | 2.2A | Stripe checkout (deferred test verification) | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `SITE_URL` |
| `create-customer-portal-session` | 2.2A | Stripe customer portal | `STRIPE_SECRET_KEY`, `SITE_URL` |
| `stripe-webhook` | 2.2A | Stripe webhook handler | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `send-team-invitation` | **3.1** | Transactional team invitation emails (Resend) | `RESEND_API_KEY` (optional), `FROM_EMAIL` (optional), `SITE_URL` |

All secrets are managed via `supabase secrets set --project-ref atdvrdhzcbtxvzgvoxhb ...`. None of them belong in Vercel frontend env.

## SQL functions added at Build 3.4 (accepted at Build 3.4A)

`public.apply_dish_menu_price_with_audit(uuid, uuid, numeric, text, text, jsonb)` — atomic dish menu_price update + menu_price_audit_log insert. `SECURITY INVOKER`. Owner/manager only via defensive `has_restaurant_role` check + RLS. `REVOKE`d from `public`/`anon`, `GRANT EXECUTE` to `authenticated`. **Migration applied live** at Build 3.4A — `pg_proc` confirms function signature, security mode, and ACL.

## Expected public tables (23 — unchanged at Build 3.4)

`profiles`, `restaurants`, `restaurant_members`, `restaurant_settings`, `restaurant_invitations`, `units`, `unit_conversions`, `menu_categories`, `suppliers`, `ingredients`, `ingredient_cost_state`, `recipes`, `recipe_lines`, `price_update_batches`, `ingredient_price_log`, `ingredient_snapshots`, `impact_cascade_runs`, `impact_cascade_items`, `alerts`, `billing_customers`, `billing_subscriptions`, `billing_events`, `menu_price_audit_log` (Build 2.9 — verified live at 2.9A; Build 3.0 added recipe CSV import code paths but no schema changes).

**Intentionally not present:** `menu_items`, `invoices`, `usage_billing`, supplier marketplace tables.

All tables have RLS enabled.

---

## Known live limitations / risks

1. **Single Supabase backend reused for live beta (intentional).** `margin-maestro-dev` was chosen as the live backend by intentional user decision to avoid an additional Supabase project cost during beta. Test/demo/beta data may coexist with real beta data. Mitigation for this phase: stronger backup + QA discipline. Migration to a separate `margin-maestro-prod` (Build 3.2) is **future optional hardening** to revisit before wider commercial rollout, not an immediate next build.
2. **Stripe verification deferred.** Billing UI and Edge Function stubs exist but the Stripe test-mode flow has not been exercised end-to-end on the live URL.
3. **Sentry DSN optional / unset.** Monitoring helpers are no-ops without `VITE_SENTRY_DSN`.
4. **Google OAuth production hardening.** OAuth consent screen and authorized domains have not been audited for production verification status.
5. **Transactional invite emails.** Team invitation emails are not sent; invite links are copied manually.

---

## Operational runbook

**Routine deploy.** Push to `main` → GitHub triggers Vercel auto-deploy → production alias `margin-maestro.vercel.app` updates after ~40s build.

**Hotfix.**
- `vercel deploy --prod` from a clean local checkout if GitHub auto-deploy is not desirable.
- `vercel rollback` to revert to a previous Production deployment.

**Rotating env vars.**
- `vercel env rm <NAME> production` then `vercel env add <NAME> production --value "..." --yes`. Redeploy required for new value to take effect.

**Updating Supabase Auth URLs.**
- Edit `supabase/config.toml [auth]`, then `supabase config push --project-ref atdvrdhzcbtxvzgvoxhb --yes`. The push prints a diff before applying — confirm only the URL changes are applied (and not unintended drift on `mfa`, `email.enable_confirmations`, `otp_length`, etc.).

**Inspecting deployments.**
- `vercel ls` lists recent Production + Preview deploys.
- `vercel logs <deployment-url>` streams runtime function logs.
- `vercel inspect <deployment-url> --logs` shows build logs.

**Database access.**
- Supabase dashboard for the `margin-maestro-dev` project.
- `supabase` CLI (linked) for migrations and SQL via `psql` if needed. `supabase db reset` against the linked remote is forbidden.
