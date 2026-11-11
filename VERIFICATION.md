# Verification — November 10, 2026

## Phase 2 automated checks

- ESLint: passed without warnings.
- TypeScript and Next.js route generation: passed.
- Vitest: 36 tests passed across 5 files.
- PostgreSQL security suite: 10 tests passed using the exact migration in test-only,
  in-memory PGlite. Tested all ten tables for RLS and cross-user visibility, anonymous
  denial, profile/settings provisioning and backfill, allowed column updates,
  ownership reassignment denial, direct approval/audit write denial, composite
  foreign keys, idempotency, object keys, traversal and file-size constraints.
- Auth unit checks: validation, server-verified sessions, safe email origins, signup,
  recovery, expired tokens, fixed redirects, profile ownership and logout outcomes.
- Next.js production build: passed using Webpack and Tailwind PostCSS. All private
  routes are dynamic, including builds without configured Supabase credentials.
- Playwright Chromium: 6 tests passed. Covered setup, account navigation, private
  route redirects, confirmation link validation and referrer protection.
- Production browser smoke check: account screens returned HTTP 200; private pages
  redirected to login without configuration. No horizontal overflow at 390px.
- Production login screenshot inspected: `../phase2-preview.png`.
- Production dependency audit: 0 advisories. Installation reported 7 moderate
  development-tool advisories; no forced tooling downgrade was performed.

No Supabase development project exists yet. No cloud project, migration, storage
bucket, production deployment, or real account was created or modified. Hosted
sign-up/login, SMTP delivery, token refresh with real sessions, password recovery,
and profile persistence through the hosted API remain unverified. Follow
`docs/phase-2.md` to configure a development project and complete those checks.

## Phase 1 baseline

The initial setup, read-only health probe, environment validation and cookie client
foundation were previously verified with 7 unit and 2 browser tests, a production
build and mobile smoke check. Those tests remain in the current passing suite.

The delivered application never uses PGlite or local files for persistent data.
PGlite is only a development dependency for executable PostgreSQL tests.
