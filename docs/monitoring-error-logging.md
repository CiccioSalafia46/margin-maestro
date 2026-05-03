# Monitoring & Error Logging — Build 2.7

## Architecture

- **Config:** `src/lib/monitoring/config.ts` — optional, config-driven via env vars
- **Logger:** `src/lib/monitoring/logger.ts` — sanitized logging with redaction
- **Sentry stub:** `src/lib/monitoring/sentry.ts` — provider-neutral stubs (install `@sentry/react` to activate)
- **Error Boundary:** `src/components/errors/AppErrorBoundary.tsx` — wraps root component

## Environment Variables (all optional)

| Variable | Purpose |
|----------|---------|
| `VITE_SENTRY_DSN` | Sentry Data Source Name (not a secret — safe in browser) |
| `VITE_APP_ENV` | Environment label (development/staging/production) |
| `VITE_APP_RELEASE` | Release version |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | Performance sampling rate (0.0–1.0) |
| `VITE_SUPPORT_EMAIL` | Support contact email |

## Redaction Rules

These fields are always redacted in log context:
token, access_token, refresh_token, authorization, password, secret, service_role, api_key, stripe, webhook, supabase, jwt, invite_token, session, cookie

## What Must NEVER Be Logged

- Auth tokens / refresh tokens
- Supabase service-role key
- Stripe secret key / webhook secret
- Invite tokens
- Raw session JSON
- Full request/response bodies with user data
- Database passwords

## Error Boundary

`AppErrorBoundary` catches React render errors, logs them safely, and shows a friendly fallback with "Try again" and "Go to Dashboard" buttons. Dev mode shows the error message; production does not.
