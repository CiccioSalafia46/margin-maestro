# Google OAuth — Build 2.8A (live verified)

> **Live status (Build 2.8A):** Google OAuth has been manually verified end-to-end on https://margin-maestro.vercel.app. Email/password sign-in remains available. Supabase Auth Site URL and Redirect URLs are configured for the live Vercel domain in `supabase/config.toml [auth]` (see `docs/live-deployment.md`).

## Overview

Google OAuth login is implemented via Supabase Auth's `signInWithOAuth({ provider: 'google' })`. Email/password auth remains available.

## Login/Signup

- Both `/login` and `/signup` show "Continue with Google" button.
- Google OAuth redirects to `/auth/callback` after authentication.
- Existing session restoration flow handles the callback.

## Setup Required (Manual)

1. **Google Cloud Console:** Create OAuth 2.0 Client ID.
2. **Authorized redirect URI:** `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
3. **Supabase Dashboard → Auth → Providers → Google:** Enable, paste Client ID and Client Secret.
4. **Supabase Dashboard → Auth → URL Configuration:** Add app URLs to redirect allow list.

## Security

- Google Client Secret is configured only in Supabase Dashboard (server-side). Never in frontend code.
- No `VITE_GOOGLE_CLIENT_SECRET` exists.
- No provider_token or Google access tokens are stored by this app.
- Session management uses standard Supabase Auth `persistSession`.

## Invitation Compatibility

- If an owner invites `user@gmail.com` and the user signs in with Google using that email, `accept_restaurant_invitation` matches the JWT email claim and accepts the invite.

## Limitations

- Google provider must be configured manually in Supabase Dashboard.
- If not configured, clicking "Continue with Google" shows a friendly error.
- No Google API access beyond authentication.
- **Production hardening pending (Build 2.8A WARN):** OAuth consent screen, authorized domains, and verification status (e.g., consent screen "Testing" vs. "In production", logo/policy URLs, PII review) have not been audited for production readiness on the Google Cloud OAuth client. Recommended before wider rollout. Tracked as OI-21 in `docs/open-issues.md`.
