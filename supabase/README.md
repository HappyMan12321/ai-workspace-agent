# Database boundary

Version-controlled application migrations begin in Phase 2. No tables, buckets,
policies or Realtime publications are created in Phase 1. Do not create user-owned
tables without RLS. Storage setup and policies arrive in Phase 5.

For a hosted development project, install the Supabase CLI, log in, and link:

```sh
npx supabase login
npx supabase init
npx supabase link --project-ref YOUR_DEVELOPMENT_PROJECT_REF
```

Run these from the application directory when beginning Phase 2. Review migrations
before `npx supabase db push`. Never push development changes directly to production.
