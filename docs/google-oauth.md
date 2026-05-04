# Google OAuth — Build 2.8

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
