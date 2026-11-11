# Supabase migrations

Apply `migrations/20261110000100_phase2_auth_schema.sql` to a fresh hosted development
project using the reviewed `supabase db push --linked` workflow in
[Phase 2 setup](../docs/phase-2.md). No cloud migration has been applied automatically.

All ten tables have RLS. Anonymous access is denied. Authenticated users can read
their own rows and update only profile name / settings preference columns. Future
workflow tables are read-only until later phases introduce narrowly scoped write
operations with authorization, validation, approvals and audit behavior.

Security-definer provisioning runs in a private schema with a pinned empty search
path and revoked public execution. Ownership is based on `auth.uid()` and foreign
keys, never display metadata. The migration provisions profiles/settings for new
and existing Auth accounts.

`tests/database/ownership.test.ts` applies this exact migration to test-only,
in-memory PostgreSQL and exercises grants, RLS, triggers and ownership constraints.
It does not substitute for a hosted Supabase integration check. Storage buckets and
Realtime publications are intentionally not created in Phase 2.
