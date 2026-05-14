# Team Management — Build 2.1 (transactional emails: Build 3.1)

> **Build 3.1 update.** Owner-created invitations now trigger a best-effort transactional email via the `send-team-invitation` Supabase Edge Function (Resend). The clipboard copy fallback remains the source of truth; email outcome is surfaced as toast warnings, never blocks invitation creation. Pending invitations table gains a **Resend email** button. See `docs/transactional-invite-emails.md`.

## Table: `restaurant_invitations`

App-level invitation records for adding users to a restaurant without service-role APIs.

## Roles

| Role | Access |
|------|--------|
| Owner | Full access: settings, team, all data |
| Manager | Edit operational data, manage categories/suppliers |
| Viewer | Read-only |

## Invite Flow

1. Owner creates invitation (email + role) in Settings → Team tab.
2. Invitation stored in `restaurant_invitations` with unique token.
3. Owner shares invite link: `/accept-invite?token=<token>`.
4. User signs up/logs in with the invited email.
5. User visits the link → `accept_restaurant_invitation` RPC runs.
6. RPC inserts `restaurant_members` row and marks invitation accepted.

## Accept RPC: `accept_restaurant_invitation(p_token)`

SECURITY DEFINER function that:
- Validates auth.uid() and email match
- Checks token exists and is pending
- Checks not expired
- Inserts membership (idempotent if already member)
- Marks invitation accepted

## Sole Owner Protection

`protect_sole_owner` trigger (Build 1.0) prevents removing the last owner from a restaurant.

## Limitations

- No transactional email delivery (share link manually)
- No Google OAuth
- No billing role integration
- Invitation expires after 30 days
