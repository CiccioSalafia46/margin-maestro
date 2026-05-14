# Transactional Invite Emails — Build 3.1

## Purpose

Until Build 3.1, owners had to copy the invitation link from the clipboard toast and share it with invitees manually (SMS, WhatsApp, email, etc.). Build 3.1 keeps that path as a fallback and adds a **best-effort transactional email** that delivers the accept-invite link to the invited address automatically.

This is **not** a marketing platform. There are no newsletters, no campaigns, no batch sends, no tracking pixels. It is a single transactional email per invitation, owner-triggered.

## Architecture

```
Settings → Team
  └─ Owner creates invitation
      ├─ createRestaurantInvitation()   ← Build 2.1: writes restaurant_invitations row
      ├─ navigator.clipboard.writeText() ← copies https://.../accept-invite?token=... (Build 2.1A)
      └─ sendTeamInvitationEmail()       ← Build 3.1: invokes Supabase Edge Function
              │
              ▼
  supabase.functions.invoke("send-team-invitation", { body: { restaurant_id, invitation_id } })
              │
              ▼
  Edge Function (Deno, supabase/functions/send-team-invitation/index.ts)
    1. Verify Supabase JWT (getAuthUser)
    2. Verify caller is owner of restaurant_id (verifyRestaurantOwner)
    3. Fetch invitation server-side via service-role admin client
    4. Validate: belongs to restaurant, status='pending', not expired
    5. Fetch restaurant name
    6. Build inviteUrl = SITE_URL + /accept-invite?token=<token>
    7. If RESEND_API_KEY unset → return { sent: false, provider_configured: false, message }
    8. Else POST to https://api.resend.com/emails → Resend
    9. Return { sent, provider_configured, message } — never the raw provider response
```

The clipboard copy on the frontend is the **source of truth** for sharing the invite. The email is an enhancement; failures are surfaced as warnings, not errors.

## Required Edge Function secrets

Set via the Supabase CLI on the live project (`atdvrdhzcbtxvzgvoxhb`):

```bash
supabase secrets set --project-ref atdvrdhzcbtxvzgvoxhb \
  SITE_URL=https://margin-maestro.vercel.app \
  RESEND_API_KEY=re_... \
  FROM_EMAIL="Margin Maestro <onboarding@resend.dev>"
```

| Secret | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | Set automatically by Supabase Edge Function runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Set automatically by Supabase Edge Function runtime — **never** copy into Vercel frontend env |
| `SITE_URL` | yes | Public origin of the deployed app. Defaults to `https://margin-maestro.vercel.app` if unset |
| `RESEND_API_KEY` | optional | When unset, function returns `{ sent: false, provider_configured: false }` — operators see the manual-copy fallback |
| `FROM_EMAIL` | optional | Defaults to `Margin Maestro <onboarding@resend.dev>` (Resend's default verified sender). Use a verified custom domain in production |

`SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` are read by the shared helper `createSupabaseFromAuth` and are also injected automatically by the Edge Function runtime.

**Never** prefix `RESEND_API_KEY` (or any other provider secret) with `VITE_`. The browser must never see provider keys.

## Provider choice

Resend was selected because:
- Single API endpoint (`POST https://api.resend.com/emails`) — no SDK needed.
- Free tier sufficient for beta volumes.
- Domain verification flow is straightforward.

The function is structured so that swapping providers is a localized change (replace the `fetch` block). For Postmark/Sendgrid/SES, swap the URL and headers — the rest of the function stays.

## Frontend API

`src/data/api/teamApi.ts`:

- `canSendTeamInvitationEmail(role)` → `true` only when role is `"owner"`.
- `sendTeamInvitationEmail(restaurantId, invitationId)` → invokes the Edge Function, returns `{ sent, provider_configured, message }`. Errors are sanitized (`auth` / `permission` / `unknown`); raw provider errors never leak.

`src/routes/settings.tsx` Team tab:

- `onInvite` now best-effort calls `sendTeamInvitationEmail` after a successful `createRestaurantInvitation`. The clipboard copy happens first so it cannot be blocked by email failure.
- Three toast outcomes:
  - **Success**: *"Invite link copied. Invitation email also sent."*
  - **Provider not configured**: *"Invite link copied. Email delivery is not configured yet, so share the link manually."*
  - **Provider failure**: *"Invite link copied, but the invitation email could not be sent. Share the link manually."*
- `onResendEmail` lets owners trigger a resend from the Pending invitations table. Same outcomes; no invitation row is mutated.

## Role behavior

| Role | Create invitation | Send / resend email | Cancel invitation | Accept invitation |
|---|---|---|---|---|
| Owner | ✓ | ✓ | ✓ | n/a |
| Manager | ✗ (Build 2.1 rule) | ✗ | ✗ | n/a (manager can be invited and then accept) |
| Viewer | ✗ | ✗ | ✗ | n/a |
| Invitee (any) | n/a | n/a | n/a | ✓ via `accept_restaurant_invitation` RPC (requires matching email JWT claim) |

The Edge Function enforces owner-only server-side with `verifyRestaurantOwner` — even if a non-owner tries to call the function directly, they will be rejected (`Only restaurant owners can send invitation emails`).

## Email content

- **Subject:** `You're invited to Margin Maestro`
- **HTML body:** clean, no tracking, no marketing. Restaurant name, role, invite link, expiration timestamp, reminder that the acceptance email must match.
- **Text body:** the same content, plain text, for clients that block HTML.
- No internal IDs, no provider metadata, no tokens beyond the one embedded in the invite URL (which is already what the operator copies to the clipboard).

## Accept-invite flow (unchanged)

`/accept-invite?token=<token>` continues to work exactly as in Build 2.1A:
1. Page reads `token` from the query string.
2. If unauthenticated → prompt to sign in.
3. Once authenticated → call `accept_restaurant_invitation(p_token)` RPC.
4. RPC verifies JWT email claim matches invitation email; on success creates `restaurant_members` row.

Build 3.1 does not change this flow.

## What this build does NOT do

- ❌ Send batch / digest / marketing emails.
- ❌ Track open or click rates.
- ❌ Persist email-delivery state in the database (no `email_events` table).
- ❌ Add new tables.
- ❌ Add a new migration.
- ❌ Expose provider secrets to the browser.
- ❌ Allow managers or viewers to send invitations.
- ❌ Mutate the invitation row when sending (no `sent_at` / `last_sent_at` field updates — that would require a schema change).

The last point is intentional. If audit-of-email-sends becomes important, a future build can add a small nullable `last_email_sent_at timestamptz` column to `restaurant_invitations` with `null` default.

## QA

- **`/qa-transactional-invites`** (new) — checks A–T. Probes Edge Function deployment by invoking with a malformed body and inspecting whether the response looks like "function not deployed" (WARN) vs. "deployed but rejected" (PASS).
- **`/qa-team-management`** — new check R confirms transactional email flow exists.
- **`/qa-auth`** footer references Build 3.1.
- **`/qa-mvp-readiness`** new check BB.
- **`/qa-beta-launch`** new check AK.
- **Settings → Developer QA** adds `/qa-transactional-invites`.

## Limitations

- Email send is **not atomic** with invitation creation by design. If the email send fails, the invitation row still exists and the clipboard copy is available. This is desirable: we never want an email failure to block an operator from finishing the invitation flow.
- No retry/queue. Each call is a single best-effort attempt.
- No bounce handling (the function never sees the bounce).
- No domain verification automation — operators must verify their sending domain via Resend dashboard before using a custom `FROM_EMAIL`.

## Recommended follow-ups

- Build 3.1A — Transactional Invite Email Acceptance (live verification on `margin-maestro.vercel.app` after deploying the Edge Function + `supabase secrets set`).
- Build 2.2B — Stripe Test Verification.
- Build 3.3 — Production Monitoring Provider Setup (Sentry DSN).
- Build 3.5 — XLS/XLSM Analysis / Formula Gap Review.
- Build 3.6 — Manual Recipe Edit Atomic Audit RPC.
