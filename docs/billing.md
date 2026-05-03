# Billing — Build 2.2

## Tables

### `billing_customers`
Maps restaurant → Stripe customer. Unique per restaurant.

### `billing_subscriptions`
Current Stripe subscription state. Unique per restaurant.

### `billing_events`
Audit trail of processed Stripe webhook events. Unique by stripe_event_id.

## Architecture

- **Browser:** Reads billing state from Supabase. Calls Edge Functions for checkout/portal.
- **Edge Functions:** Use STRIPE_SECRET_KEY (server-only) to create Checkout Sessions and Customer Portal Sessions.
- **Webhook:** Verifies Stripe signature, updates billing tables.

## Edge Functions (to deploy)

| Function | Purpose | Required Secrets |
|----------|---------|-----------------|
| `create-checkout-session` | Creates Stripe Checkout for subscription | STRIPE_SECRET_KEY, STRIPE_PRICE_ID, SITE_URL |
| `create-customer-portal-session` | Opens Stripe Billing Portal | STRIPE_SECRET_KEY, SITE_URL |
| `stripe-webhook` | Processes Stripe events | STRIPE_WEBHOOK_SECRET |

## Security

- No Stripe secrets in browser code (no VITE_STRIPE_*)
- No service-role key in browser
- Owner-only billing management via RLS
- Webhook verifies Stripe signature

## Limitations

- Edge Functions must be deployed separately with Supabase CLI
- No hard paywall across the app yet
- No usage-based billing
- No invoices table
