# Auth Session Debug Plan — Build 1.0E

Plan to fix the Supabase Auth session persistence bug.

---

## Symptoms

1. After login, the session is present and the app works.
2. On page refresh (F5), the session is lost. User is redirected to `/login`.
3. On page navigation between routes, the session may be lost.
4. `/qa-auth` shows: "Auth QA requires sign in" / "Not signed in. Sign in first to run Auth QA."
5. `sessionRestored` is `false` after refresh.

---

## Observed Behavior

- Login flow works: `signInWithPassword()` succeeds, `refreshAuth()` returns a valid session.
- Immediately after login, `/qa-auth` shows authenticated status.
- After any full-page refresh, `/qa-auth` shows unauthenticated status.
- AuthGate redirects to `/login` because `status === "unauthenticated"` after `hydrated` becomes `true` with `session === null`.

---

## Likely Root Causes

### 1. Proxy Singleton + SSR Context (Primary Suspect)

**File:** `src/integrations/supabase/client.ts` (lines 30-39)

The Supabase client is created lazily via a Proxy pattern. The `storage` option is determined at client-creation time:

```typescript
storage: typeof window !== 'undefined' ? localStorage : undefined,
```

In TanStack Start (SSR on Cloudflare Workers), if ANY code path triggers the Proxy's `get` handler in a server context, the singleton is created with `storage: undefined`. Once cached in `_supabase`, the broken client is reused for all subsequent calls, including browser-side `getSession()`.

### 2. SSR Module Sharing

The `@lovable.dev/vite-tanstack-config` is opaque. It may configure Vite's module resolution in a way that shares module instances between SSR and client contexts during development, causing the server-side `_supabase` singleton to persist into the client hydration.

### 3. AuthProvider Hydration Timing

**File:** `src/auth/AuthProvider.tsx` (lines 105-167)

If `getSession()` returns `null` (because the client has `storage: undefined`), `setHydrated(true)` is called, which sets `status = "unauthenticated"`. AuthGate then redirects to `/login` before any session restoration can occur.

---

## Files to Inspect

| File | What to Check |
|------|---------------|
| `src/integrations/supabase/client.ts` | Proxy pattern, `typeof window` check, singleton caching |
| `src/data/api/supabaseClient.ts` | Re-export, `AUTH_SESSION_CONFIG` accuracy |
| `src/auth/AuthProvider.tsx` | `useEffect` initialization, `getSession()` result handling, `hydrated` flag |
| `src/auth/AuthGate.tsx` | Redirect timing relative to `status === "loading"` |
| `src/routes/login.tsx` | Post-login `refreshAuth()` call, navigation |
| `src/routes/signup.tsx` | Post-signup `refreshAuth()` call |
| `src/routes/__root.tsx` | AuthProvider/AuthGate composition, SSR shell |
| `vite.config.ts` | Opaque `@lovable.dev/vite-tanstack-config` — SSR behavior |
| `wrangler.jsonc` | Server entry point |

---

## Supabase Client Audit Checklist

- [ ] `persistSession` is `true` in actual `createClient()` call
- [ ] `autoRefreshToken` is `true` in actual `createClient()` call
- [ ] `storage` resolves to `localStorage` on the browser (not `undefined`)
- [ ] `detectSessionInUrl` is `true` (default or explicit)
- [ ] No second Supabase client is created that could interfere
- [ ] The Proxy singleton does not cache a server-side client that gets reused on the browser
- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are present and correct
- [ ] No `VITE_SUPABASE_SERVICE_ROLE_KEY` is set

---

## AuthProvider Checklist

- [ ] `onAuthStateChange` is registered before `getSession()` is called
- [ ] `getSession()` returns a valid session when localStorage has tokens
- [ ] `hydrated` is NOT set to `true` before `getSession()` completes
- [ ] `sessionRestored` is `true` when `getSession()` finds a session
- [ ] `status` transitions: loading → authenticated (not loading → unauthenticated → authenticated)
- [ ] `loadTenantData` is called with the correct `userId` after session restoration
- [ ] No state is cleared between `onAuthStateChange` and `getSession()` completion

---

## AuthGate Checklist

- [ ] `status === "loading"` returns early with no redirect
- [ ] No redirect fires before `hydrated === true`
- [ ] `/qa-auth` is in `PUBLIC_PATHS` and does not trigger redirect
- [ ] Redirect to `/login` only happens after confirmed `status === "unauthenticated"`

---

## Login Checklist

- [ ] `signInWithPassword()` returns a session
- [ ] `refreshAuth()` successfully reads the new session
- [ ] Session is written to localStorage by Supabase client
- [ ] Navigation to `/` triggers AuthGate redirect to `/dashboard`
- [ ] No full-page reload happens during navigation

---

## Signup Checklist

- [ ] `signUp()` returns a session (if email confirmation disabled)
- [ ] `refreshAuth()` successfully reads the new session
- [ ] Navigation to `/` triggers AuthGate redirect to onboarding
- [ ] If email confirmation required: user stays on signup with message

---

## /qa-auth Checklist

- [ ] Shows "PASS" for "Session present" after login
- [ ] Shows "PASS" for "Session restored from getSession" after login
- [ ] Shows "PASS" for all above after page refresh
- [ ] Shows "PASS" for all above after navigation from another page
- [ ] Shows "PASS" for "persistSession enabled"
- [ ] Shows "PASS" for "autoRefreshToken enabled"
- [ ] Shows "PASS" for "Service-role key not exposed to client"
- [ ] `lastAuthEvent` shows a meaningful event name (not "initializing")

---

## Route Navigation Checklist

- [ ] `/dashboard` → `/settings` preserves session (client-side navigation)
- [ ] `/settings` → `/qa-auth` preserves session
- [ ] `/qa-auth` → `/dashboard` preserves session
- [ ] Direct URL entry (e.g. paste `/dashboard` in address bar) restores session
- [ ] Back/forward browser buttons preserve session

---

## localStorage Audit Checklist

After login, verify in browser DevTools → Application → Local Storage:

- [ ] Supabase auth keys are present (e.g. `sb-<project>-auth-token`)
- [ ] Keys contain valid JSON with `access_token` and `refresh_token`
- [ ] No `activeRestaurantId` key exists
- [ ] No `role` key exists
- [ ] No `membership` key exists
- [ ] No `restaurant_settings` key exists
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` or similar exists

After sign out:

- [ ] Supabase auth keys are removed from localStorage
- [ ] No stale session data remains

---

## Manual Acceptance Criteria

After Build 1.0E fix is applied:

1. `/login` renders.
2. Login with valid credentials succeeds.
3. `/qa-auth` after login shows "Session present" = PASS.
4. Refresh `/qa-auth` (F5) — session survives, still shows PASS.
5. Navigate `/dashboard` → `/settings` → `/qa-auth` — session survives.
6. Close tab, reopen `/qa-auth` — session survives (if token not expired).
7. Sign out — clears session, redirects to `/login`.
8. After sign out, `/qa-auth` shows "Sign in required."
9. No `activeRestaurantId`, role, membership, or settings in localStorage.
10. No service-role secret exposed in client env.
11. `/qa-calculations` still passes (A through S).
12. `/qa-data-integrity` still passes.
