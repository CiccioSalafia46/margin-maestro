# E2E Testing — Build 2.3

## Framework

Playwright with Chromium.

## Setup

```bash
npm install
npx playwright install chromium
```

## Required Environment Variables

```bash
E2E_BASE_URL=http://localhost:8085
E2E_EMAIL=your-test-email@example.com
E2E_PASSWORD=your-test-password
```

Set in `.env.local` (never commit) or pass directly.

## Running Tests

```bash
npm run test:e2e          # headless
npm run test:e2e:headed   # with browser visible
npm run test:e2e:ui       # Playwright UI mode
```

## Test Specs

| Spec | What It Tests |
|------|---------------|
| `smoke.spec.ts` | All 10 operational routes load without crash |
| `qa-routes.spec.ts` | All 15 QA routes load without schema errors |
| `auth-session.spec.ts` | Login, session refresh, no forbidden localStorage |
| `settings-team.spec.ts` | Settings loads, Team tab works, no schema errors |
| `intelligence-readonly.spec.ts` | Dashboard, Menu Analytics, Price Log, etc. load |

## Rules

- Tests do not use service-role key
- Tests do not mutate data by default
- Tests skip gracefully if E2E_EMAIL/E2E_PASSWORD are missing
- Tests do not expose secrets in output
- Warnings from QA routes are acceptable; schema/permission FAILs are not

## Known Limitations

- No mutation tests by default (safe for CI)
- No Google OAuth tests
- No multi-user/role tests
- No email delivery tests
