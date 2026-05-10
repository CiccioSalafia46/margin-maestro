# Current State

**Date:** 2026-05-10
**Build:** 2.8A — Google OAuth + Live Accepted
**Branch:** `main` (last accepted commit on `build-2.8-google-oauth` merged)
**Backend:** Self-owned Supabase project `margin-maestro-dev` (`atdvrdhzcbtxvzgvoxhb`) — currently reused as live backend by explicit user choice.
**Frontend hosting:** Vercel project `margin-maestro` — https://margin-maestro.vercel.app

---

## Actual State

**Beta live on Vercel.** Email/password + Google OAuth sign-in, both verified on the live URL. All 22 expected public tables present, RLS enforced. Operational chain Supabase-backed end-to-end (Ingredients → Recipes → Menu Analytics → Price Log → Snapshot → Price Trend → Dish Analysis → Impact Cascade → Alerts → Dashboard). Team management, Apply Price, CSV import/export, monitoring foundation, billing foundation all in place.

## Live deployment summary

- **Live URL:** https://margin-maestro.vercel.app
- **Vercel project:** `margin-maestro`
- **Vercel function wrapper:** `api/server.mjs` (Node.js Function wrapping the TanStack Start SSR fetch handler)
- **Build adapter:** Cloudflare plugin disabled (`vite.config.ts: cloudflare: false`); SSR output bundled into the Vercel function via `vercel.json:functions.api/server.mjs.includeFiles`.
- **Supabase Auth Site URL + Redirect URLs:** configured for prod, Vercel preview, and local dev (see `supabase/config.toml` `[auth]`).
- **Vercel env vars (names only — values not shown):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. None of these is a service role / Stripe / Google secret.

## Known live limitations / risks

- Live backend reuses the dev Supabase project. Test/demo/beta data may coexist with real beta data. Migration to a separate `margin-maestro-prod` project is recommended before wider production rollout.
- Stripe verification is deferred. Billing UI is present but test-mode flow is not yet exercised end-to-end.
- Sentry DSN is optional and not configured.
- Google OAuth provider production hardening (consent screen, authorized domains review) recommended before wider rollout.

## Next Steps

1. Beta tester onboarding on the live URL.
2. Build 2.9 — Menu Price Audit Trail.
3. Build 2.2B — Stripe Test Verification.
4. Build 3.0 — Recipe CSV Import.
5. Build 3.1 — Transactional Invite Emails.
6. Build 3.2 — Separate Production Supabase Migration.
7. Build 3.3 — Production Monitoring Provider Setup.
