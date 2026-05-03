# Support Playbook — Beta

## Cannot Log In
- **Cause:** Wrong email/password, email not confirmed, account not created.
- **Fix:** Check email, reset password via Supabase dashboard if needed.

## Session Not Restored After Refresh
- **Cause:** Supabase client `persistSession` issue or browser localStorage blocked.
- **Fix:** Verify `persistSession: true` in client config. Check browser privacy settings.

## No Active Restaurant
- **Cause:** User hasn't completed onboarding.
- **Fix:** Navigate to `/onboarding/create-restaurant`.

## Wrong Role / Permission Denied
- **Cause:** User is viewer/manager trying an owner-only action.
- **Fix:** Owner must change the user's role in Settings → Team.

## Invitation Link Mismatch
- **Cause:** User signed in with a different email than the invitation.
- **Fix:** Sign out, sign in with the invited email, then visit the link.

## CSV Import Errors
- **Cause:** Missing required columns, invalid values, duplicate names.
- **Fix:** Review preview error messages. Fix CSV and re-upload.

## Ingredient Cost Calculation Warning
- **Cause:** Missing quantity, invalid UoM conversion, adjustment = -1.
- **Fix:** Edit ingredient to provide valid values.

## Recipe Conversion Warning
- **Cause:** Line UoM incompatible with ingredient recipe UoM without density.
- **Fix:** Set density on ingredient or change line UoM.

## Missing Menu Price
- **Cause:** Dish recipe has no menu_price set.
- **Fix:** Edit recipe or use Apply Price from Menu Analytics/Dish Analysis.

## No Affected Dishes in Impact Cascade
- **Cause:** No dish recipes consume the changed ingredients.
- **Fix:** Verify recipe lines reference the updated ingredients.

## No Alerts Generated
- **Cause:** Alert generation is manual — click "Generate Alerts" on /alerts.
- **Fix:** Run Generate Alerts after creating dishes and running price updates.

## Billing Not Configured
- **Cause:** Stripe Edge Functions not deployed or secrets not set.
- **Fix:** Run `supabase secrets set` and `supabase functions deploy` per docs/billing.md.

## QA Route Shows WARN
- **Normal:** Warnings indicate deferred features or empty datasets. Not failures.

## QA Route Shows FAIL
- **Investigate:** Check the specific check detail. Common causes: missing tables, RLS errors, secrets exposure.
- **Escalate** if the failure is schema/security related.

## Supabase Migration Mismatch
- **Cause:** Migration not applied or applied out of order.
- **Fix:** Apply migrations in chronological order per docs/supabase-self-owned-migration.md.
