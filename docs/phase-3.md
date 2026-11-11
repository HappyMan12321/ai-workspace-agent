# Phase 3 — persistent chat and OpenAI

## Implemented behavior

Sign in and open `/app/chat` from the account page. Send a message to create a
conversation or select an existing conversation in the sidebar. User messages,
assistant replies and chat-run status are persisted in Supabase. Refresh reads
that saved state. No local storage is used for application data.

This phase supports text chat. There are no registered agent tools, file/task
operations, approval actions, arbitrary code execution, background workers, or
Realtime subscriptions yet. Responses are plain text and never injected as HTML.
The model is explicitly instructed not to claim it performed unavailable actions.

## OpenAI setup

1. Sign in to the [OpenAI API dashboard](https://platform.openai.com/api-keys).
   Use a dedicated API project for this app. Create its key yourself and keep it
   private. Check API billing/credits and model availability for that project.
2. Add these values to the application's ignored `.env.local`:

   ```dotenv
   OPENAI_API_KEY=YOUR_OPENAI_PROJECT_KEY
   OPENAI_MODEL=gpt-6-luna
   ```

3. Keep `APP_URL=http://localhost:3000` for local work. The chat POST route accepts
   requests only from that exact configured origin.
4. Restart `npm run dev`. The composer stays disabled while the key/model
   configuration is missing or invalid. Never prefix the key with `NEXT_PUBLIC_`,
   paste it into chat, put it in a browser setting, or commit it to GitHub.
5. In Vercel, add the same server-only variables to the appropriate environment
   when deployment is implemented. Use a separate production Supabase/OpenAI
   project as appropriate. No deployment was performed in Phase 3.

The code allowlists `gpt-6-luna` so a client cannot select a more expensive model.
Account/model access is not assumed; the real API call must verify it. Provider
errors are sanitized. No API key is included in the delivered source.

## Database setup

Apply `supabase/migrations/20261110000200_phase3_chat.sql` after the Phase 2
migration. It adds a chat/agent run discriminator, owned chat-message references,
once-per-role message uniqueness, and these narrowly scoped authenticated RPCs:

- `start_chat_turn`: atomically owns/creates the conversation, writes a user
  message and claims one chat run, with durable limits and idempotency.
- `finish_chat_turn`: appends one reply or records a failure only for an owned
  chat-kind run; it cannot complete an agent-kind run or mutate tool/approval state.
- `expire_chat_runs`: marks the caller's stale chat runs timed out when queried.

Public RPC wrappers use invoker security. Definer implementations live in the
non-exposed `private` schema with fixed empty search paths and explicit execute
grants. Anonymous callers have no execute privileges. No blanket table write,
update or delete grants were added. Existing RLS remains enabled on all ten tables.

These are owner-scoped conversational primitives. Their contents are **not provider
attestations, audit records, approved tool calls, or authorization evidence**. An
account can invoke the RPCs for its own chat records, so all history remains
untrusted text. Phase 4 must keep tool execution/approval authority independent of
conversation text and limited to agent-kind runs with separately controlled writes.

The migration was applied to development project `sadzijzrmzsjdonkvrbd` through the
SQL Editor after PostgreSQL tests passed. The hosted catalog confirms anonymous
execute denial and the intended invoker/definer split. SQL Editor does not maintain
CLI history. Before using CLI migrations on this already-configured project, link
the correct development project and mark **both actually applied versions**:

```sh
npx supabase migration repair 20261110000100 20261110000200 --status applied --remote
npx supabase migration list --remote
npx supabase db push --remote --dry-run
```

History repair does not execute SQL. Fresh environments must apply both migration
files normally; do not blindly mark an unapplied schema as applied.

## Cost and serverless bounds

- One model call per new request; no automatic provider retries or model fallback.
- `max_output_tokens: 800`, `reasoning.effort: none`, `store: false`.
- Up to 12 recent persisted messages and 12,000 characters of conversation context.
- User messages: 4,000 characters; entire JSON request: 16KiB, enforced while read.
- Provider timeout: 20 seconds; database requests: 5 seconds each; route duration: 60
  seconds. Verify that the eventual Vercel plan supports the configured duration.
- Durable limits: one active chat per user, 8 admitted runs/minute, 60/UTC day.
- A duplicate request ID with identical input returns its saved status and never
  calls the model again. Changing input under the same key is rejected.
- Failed, partial and timed-out runs are explicit. Stale runs expire after 45 seconds
  on the next request/page load. A database record does not schedule more work.

The browser preserves its attempt ID on transport failure. Retrying the same
message checks that saved attempt; deliberately sending a new message is a new
billable attempt. If persistence fails after a provider response, the app reports
uncertainty and does not automatically call OpenAI again. Refresh checks saved
status; a new request is a user decision.

Rate limits cap admitted requests per user, not aggregate money across unlimited
accounts. Configure API billing/usage alerts as well. Actual cost depends on tokens
and account pricing. `store: false` disables response-object storage; it is not a
claim of zero provider retention. Development logs suppress auth callback URLs and
server-action arguments. Prompts, keys and raw provider errors are not logged by
application code.

The interface shows the latest 30 messages and 30 recent conversations. Older
records remain stored; broad history browsing/pagination belongs to the full
workspace dashboard phase. Model context is intentionally shorter than saved UI
history. There is no resumable background agent or tool execution in this phase.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Tests run without a real OpenAI key or billable calls. PostgreSQL tests execute the
migration and verify ownership, durable rate limits, idempotency, expired-run
recovery, run-kind separation, partial output and direct-write denial. API tests
verify origin/body limits, authentication, missing keys, duplicate requests,
provider failures, persisted history and save failures. SDK tests verify request
bounds and disabled retries. Playwright exercises protected routes and safe errors.

Live verification after adding a key:

1. Ask a short question, such as “Give me a three-step plan for my project demo.”
2. Confirm a real assistant reply is saved, then refresh and reopen the conversation.
3. Send a follow-up and confirm recent saved context is used.
4. Confirm the provider call is visible in your own API usage dashboard.
5. Test a recoverable failure in a separate development context; verify the UI never
   claims a reply was saved when persistence failed. Automated tests cover this
   path without requiring deliberate billable failures.

See `VERIFICATION.md` for checks actually performed and remaining live checks.

## Next phase

Phase 4 adds the allowlisted tool registry, Zod tool input/output validation and a
bounded agent execution engine. File/task tools, destructive-operation approvals,
audit-history UI, Realtime and Vercel deployment remain later phases.

Official references:

- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/reference/resources/responses/methods/create
- https://supabase.com/docs/guides/database/postgres/row-level-security
