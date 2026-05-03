# Beta Launch Prep — Build 2.6

## Pre-Launch Checklist

### Infrastructure
- [ ] Supabase production project created (separate from dev)
- [ ] All 14 migrations applied in chronological order
- [ ] Auth redirect URLs configured for production domain
- [ ] Email confirmation setting configured
- [ ] `.env.local` with production credentials (never committed)

### Billing (optional for beta)
- [ ] Stripe test-mode account ready
- [ ] `supabase secrets set` for STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, SITE_URL
- [ ] Edge Functions deployed: create-checkout-session, create-customer-portal-session, stripe-webhook
- [ ] Stripe webhook endpoint registered in Stripe Dashboard

### Security
- [ ] No secrets in git
- [ ] No `VITE_SUPABASE_SERVICE_ROLE_KEY`
- [ ] No `VITE_STRIPE_SECRET_KEY`
- [ ] RLS verified on all 22 tables
- [ ] QA routes show no critical FAIL

### Testing
- [ ] Create test account → onboarding → full workflow
- [ ] All QA routes checked
- [ ] E2E tests pass (if env configured)
- [ ] CSV import/export tested

### Documentation
- [ ] Beta release notes ready
- [ ] Beta user guide ready
- [ ] Support playbook ready
- [ ] Deployment guide current

### Communication
- [ ] Beta tester list defined
- [ ] Support contact established
- [ ] Feedback collection method decided
