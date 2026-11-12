# Vercel demonstration deployment

Public origin: https://ai-workspace-agent.vercel.app

The Vercel project `ai-workspace-agent` is under the owner's existing CareCircle
Hobby team and imports this repository's root directory on `main`. No unrelated
CareCircle app or database was changed. The framework preset is Next.js; the package
requires Node.js 24 and builds with `npm run build` (Webpack).

## Configuration

The five variables below are configured for **Production only**. Preview builds
have no database or model credentials until separately configured.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `APP_URL=https://ai-workspace-agent.vercel.app`
- `OPENAI_MODEL=gpt-6-luna`
- `OPENAI_API_KEY`, stored as a Vercel Secret that cannot be revealed after saving

No credential values belong in this repository. Environment changes require a new
deployment. The existing development key was reused with the owner's authorization.
Prefer a separate production key with its own lifecycle and usage controls.

The owner explicitly chose to reuse `ai-workspace-agent-dev` after Supabase reported
the account's two-free-project limit. Existing accounts and test conversations
therefore remain in the same database. Prefer a separate database and API project
before a broader launch. Do not reapply the already-applied SQL migrations; repair
CLI migration history as described in the phase guides before future CLI pushes.

Supabase's Site URL is the public origin. Its exact redirect allowlist contains:

- `https://ai-workspace-agent.vercel.app/auth/confirm`
- `http://localhost:3000/auth/confirm` for local development

No wildcard redirect is required. Local `APP_URL` remains `http://localhost:3000`.

## Verification — November 11, 2026

- Vercel reported the initial deployment successful.
- Public `/` returned HTTP 200 without Vercel authentication.
- `/api/health` returned HTTP 200 with `auth_reachable`.
- Cookie-free `/app` and `/app/chat` returned HTTP 307 to `/login?notice=session`.
- The public login page loaded successfully.
- The saved Supabase Site URL and both redirect entries survived dashboard reload.
- Lint, TypeScript, 64 tests, and the local production build passed before deployment.

A signed-in chat call and email-link round trip on the public domain remain to be
verified. Local authenticated chat and persistence were verified previously.
Per-user limits are not an aggregate spending cap; requests use the owner's API
account. The reused OpenAI key's 30-day expiry also applies to the hosted app.
