# Current State

**Date:** 2026-05-03
**Build:** 2.2A — Billing Stripe Test
**Branch:** `build-2.2-billing`
**Backend:** Self-owned Supabase project `margin-maestro-dev`

---

## Actual State

**All operational pages + Team Management + Billing Supabase-backed.** 22 tables. Stripe Edge Functions deployable for checkout, portal, and webhook.

## Deploy Commands

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_ID=price_...
supabase secrets set SITE_URL=http://localhost:8085
supabase functions deploy create-checkout-session
supabase functions deploy create-customer-portal-session
supabase functions deploy stripe-webhook
```

## Next Task

**Stripe test-mode verification** then **Build 2.4 — Apply Price Workflow.**
