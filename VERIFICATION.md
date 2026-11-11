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

The user completed account creation and email confirmation. The private workspace
loaded with the verified account, profile and default preferences. A profile save
success was visible; after a full page reload, the saved name remained and the user
was still authenticated. No password or session token was read or recorded.

An independent HTTP request without browser cookies to the configured `/app`
returned HTTP 307 to `/login?notice=session` with `Cache-Control: no-store`.
This confirms the running connected app still rejects unauthenticated access.

Remaining live checks: a fresh password login/logout cycle, password-recovery email
and update, refresh after token expiry, and two-account isolation through the hosted
API. Isolation remains covered by the PostgreSQL test suite and hosted policy/grant
inspection. No production deployment was performed. SQL Editor application does not
record CLI history; see the setup guide before pushing subsequent migrations to
this same database.

## Phase 1 baseline

The initial setup, read-only health probe, environment validation and cookie client
foundation were previously verified with 7 unit and 2 browser tests, a production
build and mobile smoke check. Those tests remain in the current passing suite.

The delivered application never uses PGlite or local files for persistent data.
PGlite is only a development dependency for executable PostgreSQL tests.

## Phase 3 — November 10, 2026

- ESLint and TypeScript: passed.
- Vitest: 64 tests across 8 files passed. Includes 20 PostgreSQL security tests
  covering both migrations, ownership, idempotency, rate limits, expiry recovery,
  terminal states and isolation of chat writes from agent/tool/approval records.
- Production build: passed with the authenticated chat routes and server-only SDK.
- Playwright: 9 tests passed with OpenAI disabled and isolated empty Supabase settings.
- Hosted Phase 3 migration applied successfully to development via SQL Editor.
- Hosted catalog: all six public/private chat functions have anonymous execution
  denied; public wrappers are invoker functions, private implementations are definer
  functions. Authenticated grants match the owner-scoped implementation.
- Development logging adjusted to omit auth callback URLs and server-action inputs.

The user configured a restricted OpenAI key in the ignored local environment file.
A real authenticated chat request to GPT-6 Luna returned “Chat connection works.”
Both the prompt and reply remained visible after a full browser reload, confirming
the live provider connection and conversation persistence. Billing totals were not
inspected. The composer was also verified disabled before the key was configured.
The initial screenshot was inspected and no horizontal overflow was detected.
Production dependency audit reported zero advisories.
Phase 3's configured per-user request caps do not constitute an aggregate monetary
spending cap. No service-role credential or user OpenAI key has been committed.

This phase does not implement tool execution, storage/task actions, approvals,
Realtime, a durable worker or production deployment. Conversations remain untrusted
text; chat RPCs do not prove that an external operation or model call occurred.
