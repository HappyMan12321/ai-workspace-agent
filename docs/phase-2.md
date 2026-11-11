# Phase 2 — accounts and database ownership

## 1. Create a development project

1. Sign in at https://supabase.com/dashboard and create a project for development.
   Pick an appropriate region, save the database password securely, and wait for
   the project to become ready. The app does not need the database password.
2. In the Connect dialog/API settings, copy the HTTPS project URL and publishable
   key. Add them to `.env.local` using the names in `.env.example`.
3. Set `APP_URL=http://localhost:3000`. Restart `npm run dev`. Open `/` and click
   **Check connection**. HTTP 200 from `/api/health` verifies only Auth reachability.
4. Keep production in a separate project. No Supabase account or cloud project was
   created automatically by this delivery.

## 2. Apply the migration

From the application directory, use the Supabase CLI against a fresh development
project:

```sh
npx supabase login
npx supabase init
npx supabase link --project-ref YOUR_DEVELOPMENT_PROJECT_REF
npx supabase db push --linked --dry-run
npx supabase db push --linked
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
npx supabase gen types typescript --linked > src/lib/database.generated.ts
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

Update **Confirm signup** email to include this link:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Confirm your account</a>
```

Update **Reset password** email to include:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
```

The app supplies `${APP_URL}/auth/confirm` as RedirectTo in both requests. Use
those templates with app-initiated sign-up/recovery flows. Generic dashboard invites
and OAuth are not implemented. Existing default templates which return a token in
a URL fragment are incompatible with the server-only confirmation page.

The page displays **Continue securely**. Only submitting that form calls `verifyOtp`
and sets the session cookies. Mail scanners merely opening the link do not consume
the token. Recovery redirects to `/reset-password`; ordinary confirmation redirects
to `/app`. A valid signed-in user may also change their password at
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

Live integration awaits a user-created Supabase project. Chat, OpenAI, execution,
Storage, tasks, approval actions, audit-history UI, Realtime and deployment remain
subsequent phases. Phase 3 should begin only after these account flows have been
verified with the development project.
