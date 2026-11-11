# Phase 2 — accounts and database ownership

## 1. Create a development project

1. Sign in at https://supabase.com/dashboard and create a project for development.
   Pick an appropriate region, save the database password securely, and wait for
   the project to become ready. The app does not need the database password.
2. In the Connect dialog/API settings, copy the HTTPS project URL and publishable
   key. Add them to `.env.local` using the names in `.env.example`.
3. Set `APP_URL=http://localhost:3000`. Restart `npm run dev`. Open `/` and click
   **Check connection**. HTTP 200 from `/api/health` verifies only Auth reachability.
4. Keep production in a separate project. The connected development project is
   documented below; create another project only for a separate environment.

## 2. Apply the migration

From the application directory, use the Supabase CLI against a fresh development
project:

```sh
npx supabase login
npx supabase init
npx supabase link --project-ref YOUR_DEVELOPMENT_PROJECT_REF
npx supabase db push --remote --dry-run
npx supabase db push --remote
```

The CLI may request your database password. Enter it in the local terminal prompt,
not in chat or source. If `config.toml` already exists, skip `supabase init`.
Inspect the dry-run and confirm the linked project is development before pushing.
Do not run destructive database reset commands against a hosted project.

Migration: `supabase/migrations/20261110000100_phase2_auth_schema.sql`.
It creates `profiles`, `conversations`, `messages`, `agent_runs`, `tool_executions`,
`approval_requests`, `workspace_files`, `workspace_folders`, `tasks`, `user_settings`.
It is intended for a fresh application schema; do not apply it blindly over
pre-existing tables. Supabase manages `auth.users`; do not recreate that table.

The migration wraps its changes in a transaction, explicitly enables RLS on all ten
tables, removes anonymous access, and grants authenticated users owner-filtered
reads. Users can update only their own profile name and preference columns.
Profiles/settings are automatically created for new Auth users, with a backfill
for accounts that existed before this migration. Authentication sign-up depends on
the trigger succeeding, so inspect Auth/database logs if new-user creation fails.

Related rows carry composite foreign keys with `user_id`, so an owned message
cannot point to another person's conversation and an approval cannot point to
another person's run/tool execution. File metadata uses one personal workspace per
user, where `workspace_id = user_id`, and derives object keys from owner + workspace
+ validated relative path. Storage buckets/policies and actual file operations
remain Phase 5. No migrations schedule background work.

All future workflow tables remain read-only to normal API callers. Later phases
must explicitly implement secure write operations and approvals; do not solve a
permission error by granting unrestricted writes or adding a service-role key.

Optional post-migration type generation for later development:

```sh
npx supabase gen types typescript --remote > src/lib/database.generated.ts
```

## 3. Configure email/password Auth

In Supabase Authentication:

1. Enable Email authentication and keep email confirmation enabled.
2. Set the Site URL to `http://localhost:3000`.
3. Add the exact redirect URL `http://localhost:3000/auth/confirm` to the allowlist.
4. Set a minimum password length of 12 in the provider/security settings to match
   the application's registration/password-update validation.
5. Configure Auth rate limits for your development use. Before wider testing,
   configure your own SMTP sender and review email-delivery/rate-limit settings;
   the built-in development mail service has delivery restrictions. The app uses
   Supabase Auth's protections and introduces no in-memory rate limiter.

### Default emails (no custom SMTP required)

Keep Supabase's default signup and password-reset templates. They return a PKCE
`code` to `/auth/confirm`. The app shows **Continue securely** and exchanges that
code server-side using the verifier cookie stored when the email was requested.
If an `sb_flow_id` is included, it is validated and passed to the SDK. Recovery
intent comes from the SDK's stored verifier rather than a caller-supplied type.

Open the email link in the **same browser** where you signed up/requested recovery.
When using the in-app browser, copy the email link into a new tab in that same
browser instead of opening it in Chrome/Safari. A different browser has no verifier
cookie and cannot finish the exchange. Do not paste email tokens into chat.

The project dashboard currently requires custom SMTP or Pro to edit templates.
No paid upgrade or SMTP sender was configured. Built-in mail has rate and recipient
restrictions; start with the email associated with your Supabase organization.
The dashboard's default verification URL can be visited by email scanners before
reaching the app; the app itself does not exchange the resulting code on a GET.

### Optional custom templates

If you later configure SMTP or otherwise gain template editing, token-hash links
remain supported. For **Confirm signup**:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Confirm your account</a>
```

For **Reset password**:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
```

The app supplies `${APP_URL}/auth/confirm` as RedirectTo for both requests. These
links reach the app directly, and only clicking **Continue securely** consumes the
one-time token. Generic dashboard invites, OAuth, and implicit fragment-token
callbacks are not implemented. A verified user can change their password at
`/reset-password`. Sign-out ends the current device's session, not all devices.

For production, replace localhost with the deployed HTTPS origin in `APP_URL`, Site
URL, and exact redirect allowlist. Do not allow arbitrary preview wildcard redirects
in the production Supabase project.

## 4. Live verification checklist

After applying the migration and configuring email:

1. Create account A at `/signup`. Check its email and follow the confirmation link.
   Click **Continue securely**. Confirm `/app` displays the correct account.
2. Save a new profile name and refresh. The name must persist in PostgreSQL.
3. Sign out. Direct visits to `/app` and `/reset-password` must return to `/login`.
4. Sign in with the password. Confirm the profile is still present.
5. Request a reset at `/forgot-password`. Follow the recovery email, click Continue,
   set a new matching password, and verify that the new password signs in.
6. Try an expired/reused confirmation link. The app must show a sanitized failure
   and never redirect to an external `next` parameter.
7. Create account B in a separate browser session. Its profile must be distinct;
   editing B must never change A. Review SQL/API ownership checks as well as UI
   behavior—hiding UI is not authorization.
8. Confirm all ten tables show RLS enabled in the dashboard. An anonymous client
   must have no access; an authenticated client can read only its own rows and
   cannot directly approve operations or write engine/file/task records.
9. Temporarily test with incorrect project settings; connection and sign-in should
   fail without exposing keys or internal error details. Restore settings afterward.

Automated `npm test` verifies the migration and ownership isolation in test-only
PostgreSQL. It does not prove that a hosted project's Auth settings, SMTP, redirects,
SDK refresh behavior with real tokens, or Vercel domain settings are correct.

## Completed functionality and next phase

Implemented: server-validated account flows, protected pages/mutations, cookie
sessions, account/profile UI, database migration with ownership constraints and RLS,
and automated validation/authorization/database/browser checks.

The hosted database and connection are verified; real account/email tests remain
pending user signup. Chat, OpenAI, execution,
Storage, tasks, approval actions, audit-history UI, Realtime and deployment remain
subsequent phases. Phase 3 should begin only after these account flows have been
verified with the development project.

## Connected development project — November 10, 2026

- Project: `ai-workspace-agent-dev`, Free organization, West US (North California).
- Reference: `sadzijzrmzsjdonkvrbd`.
- Project URL: `https://sadzijzrmzsjdonkvrbd.supabase.co`.
- Connection settings are in ignored local `.env.local`; no credentials were committed.
- The exact version-controlled Phase 2 SQL migration was applied via the dashboard
  SQL Editor after confirming there were no existing public application tables.
- All ten hosted tables have RLS; catalog checks confirmed anonymous SELECT denial,
  authenticated SELECT grants and owner policies. A direct anonymous profiles API
  request was rejected with HTTP 401 / PostgreSQL code `42501`.
- Local `/api/health` returned HTTP 200 with `auth_reachable`.
- Site URL is `http://localhost:3000`; the only redirect allowlist entry is
  `http://localhost:3000/auth/confirm`. Email signup and confirmation are enabled;
  minimum password length is 12. Default email templates remain in use.

Because SQL Editor applies SQL without recording CLI migration history, do not
push the initial migration to this same database again. Once you log in/link the
CLI, mark this already-applied version before using CLI migrations:

```sh
npx supabase migration repair 20261110000100 --status applied --remote
npx supabase migration list --remote
npx supabase db push --remote --dry-run
```

Only repair history after independently confirming the schema matches the migration;
it does not execute or validate SQL. Fresh environments should apply the migration
normally. No production deployment or real user account test has been completed.
