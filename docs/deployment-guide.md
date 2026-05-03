# Deployment Guide — Build 2.0

## A. Required Environment Variables

```bash
# .env.local (never commit)
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=<project-ref>
```

**Never set:** `VITE_SUPABASE_SERVICE_ROLE_KEY`

## B. Supabase Setup Checklist

1. Create Supabase project
2. Apply all 10 migrations in chronological order (see `docs/supabase-self-owned-migration.md`)
3. Configure Auth → URL Configuration → Site URL and Redirect URLs
4. Configure Auth → Email Templates if needed
5. Verify email confirmation setting (on/off)
6. Verify RLS policies with `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`
7. Create first user account via signup
8. Complete restaurant onboarding
9. Run all QA routes

## C. Local Validation Commands

```bash
npx tsc --noEmit    # TypeScript check
npm run build       # Production build
npm run dev         # Development server (port 8085)
```

## D. Pre-Deploy Validation

- [ ] No secrets in git (`git diff --cached` shows no `.env` values)
- [ ] `.env` not staged
- [ ] `.env.local` not staged
- [ ] `.claude/` not staged
- [ ] No `VITE_SUPABASE_SERVICE_ROLE_KEY` in client code
- [ ] QA pages have no critical FAIL
- [ ] Database tables match expected schema (18 tables)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds

## E. Beta Deployment Checklist

- [ ] Domain selected and configured
- [ ] Supabase production project created (separate from dev)
- [ ] All migrations applied to production project
- [ ] Redirect URLs configured for production domain
- [ ] Email templates configured
- [ ] Backup policy documented
- [ ] Error monitoring selected (e.g., Sentry)
- [ ] Support/contact process defined
- [ ] First production account tested
