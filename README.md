# AI Workspace Agent — Phase 1

A Next.js App Router + TypeScript foundation targeting Vercel, with Tailwind CSS,
shadcn/ui, Zod, and browser/server Supabase clients. Only Phase 1 is implemented.

## Start locally

Use Node.js 24 and npm. From this directory:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Without Supabase settings, the setup screen still loads
and the connection check reports configuration is required. This is intentional;
configuration presence is never presented as a verified live connection.

## Configure a hosted Supabase development project

1. Create a project at https://supabase.com/dashboard. Keep development and production
   in separate projects. Save the database password securely; the app does not need it.
2. In the project's Connect dialog/API settings, copy the project HTTPS URL and
   **publishable key** (`sb_publishable_…`). This starter deliberately rejects secret,
   service-role and legacy JWT keys in its public configuration.
3. Set these values in `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   APP_URL=http://localhost:3000
   ```

4. Restart the development server; Next.js embeds public values when it builds.
5. Click **Check connection**. A success means the Supabase Auth settings endpoint
   accepted the key. It does **not** verify database tables, RLS, storage, sign-in,
   or Realtime; those are not implemented yet.
6. In Supabase Auth URL Configuration, set the development Site URL to
   `http://localhost:3000`. In Phase 2, allow the exact callback/reset URLs implemented
   there. Callback and password-reset routes do not exist in Phase 1.

No Supabase project was provisioned automatically. No credentials are included.
The app uses the publishable key with the user's cookie session, preserving RLS
for future data operations. No service-role key is required for this phase.

`APP_URL` reserves the canonical origin for future server-side auth redirects; no
current feature reads it. `OPENAI_API_KEY` is documented but not used until Phase 3.
Never prefix either an OpenAI key or a Supabase secret/service-role key with
`NEXT_PUBLIC_`. Do not commit `.env.local` or paste secrets into source files.

## Implemented code

| Path | Purpose |
| --- | --- |
| `src/app/page.tsx` | Responsive setup screen with honest configuration state |
| `src/components/ui/button.tsx` | Locally owned shadcn/ui button |
| `src/components/connection-check.tsx` | On-demand connection probe with loading and error states |
| `src/lib/env.ts` | Zod validation of public Supabase configuration |
| `src/lib/supabase/client.ts` | Cookie-based browser Supabase client |
| `src/lib/supabase/server.ts` | Per-request, server-only Supabase client |
| `src/proxy.ts` | Verified token refresh and response cookie propagation |
| `src/app/api/health/route.ts` | Bounded, read-only Supabase Auth connectivity check |
| `supabase/migrations/` | Reserved migration directory for Phase 2 |
| `tests/` | Vitest configuration tests and Playwright setup checks |

The health endpoint is public and returns no credentials, user records, upstream
bodies, or exception details. It has a four-second upstream timeout, disables
caching, and makes no writes. The setup screen skips session refresh only when
configuration is absent. It contains no private application routes or data.

Server Components cannot write cookies; the proxy handles token refresh.
Future protected pages and mutation handlers must independently verify the user
and enforce ownership. Session refresh alone is not an authorization boundary.
Do not cache user-dependent responses.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts an isolated development server on port 3100 with empty Supabase
settings. Its two tests verify that the setup page loads, the button explains
missing configuration, and `/api/health` returns an explicit uncached HTTP 503.
The unit suite verifies configuration validation and credential-safe errors, plus
health success, rejection and network failures using mocked upstream responses.

For a real connection, configure `.env.local`, run `npm run dev`, then:

```sh
curl -i http://localhost:3000/api/health
```

Expected outcomes:

- Missing/invalid configuration: HTTP 503, `status: not_configured`.
- Valid project and accepted key: HTTP 200, `supabase: auth_reachable`.
- Unreachable project, rejected key, or timeout: HTTP 503, `status: degraded`.

Production smoke check: `npm run build`, then `npm start`; verify the setup page
and the same health responses. Without configured credentials, a 503 is expected.

## Vercel readiness

Deployment and deployed-domain verification belong to Phase 8. No deployment has
been performed in Phase 1. The project uses supported Next.js Webpack build/start commands
and a Node.js route handler, with `maxDuration = 10` for the health endpoint.

When preparing Vercel, select this directory as the project root, the Next.js
preset, and Node.js 24. Set `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `APP_URL` for each environment.
Preview/development must use a development Supabase project; production must use
its own project. Redeploy after changing public variables. Configure exact Auth
redirect URLs only once their handlers exist. Keep future OpenAI credentials in
server-side environment variables.

## Completion boundary and next phase

Implemented: application scaffold, UI foundation, validated Supabase configuration,
cookie-aware clients, refresh plumbing, connection probe, and test infrastructure.

External verification pending: a real Supabase project and publishable settings
must be supplied to prove connectivity. Database/storage persistence cannot yet
be verified. See `VERIFICATION.md` for checks actually run on this delivery.

Phase 2: email/password sign-up, login, logout, password reset, protected routes,
version-controlled schema, foreign keys/indexes, and ownership RLS. Phase 3 adds
chat and OpenAI; later phases add execution, tools, storage, approvals, audit logs,
Realtime, the full dashboard, and deployed academic demonstration. No agent tool
or destructive operation is exposed by this starter.

The development and production build scripts explicitly use Webpack with Tailwind's
PostCSS integration. This avoids a local Turbopack helper-process restriction.

## Official references

- https://nextjs.org/docs/app/getting-started/installation
- https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs
- https://ui.shadcn.com/docs/installation/next
