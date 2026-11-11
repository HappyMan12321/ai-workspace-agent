# Verification — November 10, 2026

## Phase 2 automated checks

- ESLint: passed without warnings.
- TypeScript and Next.js route generation: passed.
- Vitest: 40 tests passed across 5 files.
- PostgreSQL security suite: 10 tests passed using the exact migration in test-only,
  in-memory PGlite. Tested all ten tables for RLS and cross-user visibility, anonymous
  denial, profile/settings provisioning and backfill, allowed column updates,
  ownership reassignment denial, direct approval/audit write denial, composite
  foreign keys, idempotency, object keys, traversal and file-size constraints.
- Auth unit checks: validation, server-verified sessions, safe email origins, signup,
  recovery, expired tokens, fixed redirects, profile ownership and logout outcomes.
- Next.js production build: passed using Webpack and Tailwind PostCSS. All private
  routes are dynamic, including builds without configured Supabase credentials.
- Playwright Chromium: 7 tests passed. Covered setup, account navigation, private
  route redirects, confirmation link validation and referrer protection.
- Production browser smoke check: account screens returned HTTP 200; private pages
  redirected to login without configuration. No horizontal overflow at 390px.
- Production login screenshot inspected: `../phase2-preview.png`.
- Production dependency audit: 0 advisories. Installation reported 7 moderate
  development-tool advisories; no forced tooling downgrade was performed.

## Hosted development connection

Project `ai-workspace-agent-dev` (`sadzijzrmzsjdonkvrbd`) is connected through
ignored `.env.local`. No publishable key, secret key, database password or account
password was committed. The exact version-controlled Phase 2 SQL was applied via
the dashboard SQL Editor to an initially empty public application schema.

Verified in the hosted catalog: all 10 tables exist with RLS enabled; anonymous
SELECT is denied, authenticated SELECT is granted with owner-filtered policies;
profiles/settings have the expected update policies. A direct anonymous profiles
REST request returned HTTP 401 and PostgreSQL `42501`. An initial multi-request
probe timed out; the single-request retry succeeded. Local `/api/health` returned
HTTP 200 with `auth_reachable`.

Email provider, signup and confirmation are enabled. Site URL and exact callback
are configured for localhost:3000; password minimum is 12. Free dashboard template
editing requires custom SMTP or Pro, so the app now also supports default-email
PKCE callbacks. Tests cover code exchange, explicit flow IDs, recovery intent from
the SDK verifier, rejected external redirect input and sanitized missing-verifier
errors. Custom token-hash templates remain supported. No paid service was enabled.

User signup, real email delivery, password recovery, real session refresh and
profile persistence through an authenticated hosted account still require the
user's account-creation step. No production deployment was performed. SQL Editor
application does not record CLI history; see the setup guide's history-repair
instructions before pushing subsequent migrations to this same database.

## Phase 1 baseline

The initial setup, read-only health probe, environment validation and cookie client
foundation were previously verified with 7 unit and 2 browser tests, a production
build and mobile smoke check. Those tests remain in the current passing suite.

The delivered application never uses PGlite or local files for persistent data.
PGlite is only a development dependency for executable PostgreSQL tests.
