# AI Workspace Agent

Next.js App Router + TypeScript, Supabase, Tailwind CSS and shadcn/ui.
**Phases 1–2 are implemented.** This is an account and database foundation, not yet
an operational agent. OpenAI integration begins in Phase 3.

## Run locally

Use Node.js 24 and npm. From this directory:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The setup and account pages load without Supabase;
account submission remains disabled until configuration is present. See
[Phase 2 setup](docs/phase-2.md) for creating a hosted project, applying the schema,
configuring confirmation emails, and verifying sign-in.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
APP_URL=http://localhost:3000
```

Use a real `sb_publishable_…` key. Legacy JWT, secret and service-role keys are
rejected in public configuration. No service-role or OpenAI key is required for
Phase 2. `.env.local` is ignored by Git; never put credentials in source or chat.
Restart the server after changing settings. Public variables are embedded at build
time, so Vercel environment changes require a new build/deployment.

## What works

- Responsive setup screen and an on-demand, read-only Auth connectivity probe.
- Email/password sign-up and sign-in, email confirmation, password recovery,
  password updates, and device-local logout using server actions.
- Cookie-based browser/server Supabase clients and verified session refresh.
- Protected `/app` and `/reset-password` pages, with independent server-side user
  verification in mutations. No client-supplied user ID grants authority.
- A minimal account screen that reads the profile and settings and saves a name
  through the caller's session; refreshing reloads PostgreSQL data.
- One migration creating all ten requested tables, RLS, owner-scoped read policies,
  column-specific profile/preferences updates, composite ownership foreign keys,
  indexes, and automatic profile/settings provisioning for Auth users.
- Vitest, in-memory PostgreSQL security tests, and Playwright browser checks.

Future agent, file, task and approval tables are deliberately read-only to the
`authenticated` role at this stage. Later migrations must add narrowly scoped
operations together with authorization, validation, approval, and audit behavior.
There is no general write or delete permission that bypasses those future controls.

## Routes and code

| Path | Purpose |
| --- | --- |
| `/` | Setup instructions and phase roadmap |
| `/login`, `/signup` | Account entry points |
| `/forgot-password`, `/reset-password` | Request recovery and update password |
| `/auth/confirm` | Validate email-link details; confirm with an explicit POST |
| `/app` | Verified account, profile update and logout |
| `/api/health` | Auth settings connectivity; does not verify data/storage readiness |
| `src/app/auth/actions.ts` | Validated authentication and profile server actions |
| `src/lib/auth/` | Input schemas, verified-user guard, canonical email origin |
| `src/lib/supabase/`, `src/proxy.ts` | Session-aware clients and refresh |
| `supabase/migrations/` | Version-controlled application schema |
| `tests/database/` | Executable PostgreSQL ownership/security tests |

Confirmation targets are fixed: account confirmation goes to `/app`, recovery to
`/reset-password`. Redirect query parameters are ignored. Confirmation uses a form
so the app exchanges a code or verifies a token only after an explicit POST. Default
Supabase emails use PKCE and require the browser that requested the email; the SDK
checks its verifier cookie. Custom token-hash templates are also supported. Auth errors are
sanitized; reset messages do not disclose whether an email is registered. Email
origins come only from validated `APP_URL`. Server actions use Next.js origin checks
and a 32KB body limit. Referrer suppression protects email-link query strings.

## Verify

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

PostgreSQL tests use PGlite **only as an in-memory development test dependency**.
Application persistence always uses hosted Supabase PostgreSQL; no local app
storage or SQLite is introduced. Tests bootstrap a minimal Auth schema to exercise
the actual migration, grants, policies, constraints and triggers. They do not
replace live Supabase Auth/email validation.

Playwright runs on port 3100 with empty Supabase settings so it cannot contact or
alter a real account. It checks setup behavior, account-page navigation, private
route redirects and confirmation-link guards. Auth unit tests mock only Supabase
network calls; database ownership tests execute SQL in PostgreSQL.

[Verification results](VERIFICATION.md) distinguish passed checks from pending
additional account checks. The development project is connected, the migration is
applied, and real account confirmation plus profile persistence after refresh are
verified; see the project status in the setup guide.

## Deployment target and phase boundary

The target is Vercel with Node.js 24 and standard Next.js hosting. Development and
production must use separate Supabase projects. Store environment values in their
corresponding Vercel environments; keep `APP_URL` server-side. Use supported Webpack
build/dev scripts and Tailwind PostCSS. Deployment and deployed-domain checks remain
Phase 8 work; no deployment has been performed.

The remaining phases are chat/OpenAI (3), execution engine (4), Storage/task tools
(5), approvals/audit/Realtime (6), complete dashboard (7), and deployed demonstration
(8). Schema columns anticipate these phases; they do not implement their behavior.

## References

- [Next.js](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase cookie clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)
- [Password authentication](https://supabase.com/docs/guides/auth/passwords)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [shadcn/ui](https://ui.shadcn.com/docs/installation/next)
