-- Phase 2: ownership boundaries. Apply to a fresh development Supabase project.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

-- Metadata paths are relative object-key suffixes, never OS paths.
create function private.valid_workspace_path(value text) returns boolean
language sql immutable set search_path = '' as $$
  select length(value) between 1 and 512
    and value !~ '(^/|/$|//|(^|/)\.{1,2}(/|$))'
    and position(chr(92) in value) = 0
    and value !~ '[[:cntrl:]]';
$$;
revoke all on function private.valid_workspace_path(text) from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'UTC' check (length(timezone) between 1 and 100),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation' check (length(title) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content text not null default '' check (octet_length(content) <= 1048576),
  tool_call_id text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (conversation_id, user_id) references public.conversations(id, user_id) on delete cascade
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  status text not null default 'queued' check (status in
    ('queued', 'planning', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled', 'partial_failure', 'timed_out')),
  idempotency_key uuid not null,
  iteration_count integer not null default 0 check (iteration_count between 0 and 20),
  tool_call_count integer not null default 0 check (tool_call_count between 0 and 50),
  cancel_requested boolean not null default false,
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, idempotency_key),
  foreign key (conversation_id, user_id) references public.conversations(id, user_id) on delete cascade
);

create table public.tool_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_run_id uuid not null,
  tool_call_id text not null check (length(tool_call_id) between 1 and 200),
  tool_name text not null check (length(tool_name) between 1 and 100),
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  status text not null default 'selected' check (status in
    ('selected', 'validated', 'awaiting_approval', 'running', 'completed', 'failed', 'cancelled', 'denied')),
  input jsonb not null default '{}'::jsonb check (jsonb_typeof(input) = 'object'),
  output jsonb,
  error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agent_run_id, user_id),
  unique (agent_run_id, tool_call_id),
  foreign key (agent_run_id, user_id) references public.agent_runs(id, user_id) on delete cascade
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_run_id uuid not null,
  tool_execution_id uuid not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired', 'consumed')),
  operation_digest text not null check (operation_digest ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  decided_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tool_execution_id, agent_run_id, user_id)
    references public.tool_executions(id, agent_run_id, user_id) on delete cascade,
  check (expires_at > created_at)
);

-- One personal workspace per user for the MVP. Multi-workspace membership needs
-- its own table/policies in a future migration; workspace_id is not authority.
create table public.workspace_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null default auth.uid(),
  parent_id uuid,
  path text not null check (private.valid_workspace_path(path)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (workspace_id = user_id),
  check (parent_id is null or parent_id <> id),
  unique (id, workspace_id, user_id),
  unique (user_id, workspace_id, path),
  foreign key (parent_id, workspace_id, user_id)
    references public.workspace_folders(id, workspace_id, user_id)
);

create table public.workspace_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null default auth.uid(),
  folder_id uuid,
  path text not null check (private.valid_workspace_path(path)),
  object_key text generated always as (user_id::text || '/' || workspace_id::text || '/' || path) stored,
  mime_type text not null default 'application/octet-stream' check (length(mime_type) between 1 and 255),
  size_bytes bigint not null default 0 check (size_bytes between 0 and 10485760),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (workspace_id = user_id),
  unique (id, user_id),
  unique (user_id, workspace_id, path),
  unique (object_key),
  foreign key (folder_id, workspace_id, user_id)
    references public.workspace_folders(id, workspace_id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  description text not null default '' check (length(description) <= 10000),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'completed')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'completed') = (completed_at is not null)),
  unique (id, user_id)
);

create index conversations_user_updated_idx on public.conversations(user_id, updated_at desc);
create index messages_conversation_created_idx on public.messages(conversation_id, user_id, created_at);
create index messages_user_created_idx on public.messages(user_id, created_at);
create index agent_runs_user_status_idx on public.agent_runs(user_id, status, created_at desc);
create index agent_runs_conversation_idx on public.agent_runs(conversation_id, user_id);
create index tool_executions_user_created_idx on public.tool_executions(user_id, created_at desc);
create index approvals_user_pending_idx on public.approval_requests(user_id, status, expires_at);
create index approvals_run_idx on public.approval_requests(agent_run_id, user_id);
create index folders_parent_idx on public.workspace_folders(parent_id, workspace_id, user_id);
create index files_folder_idx on public.workspace_files(folder_id, workspace_id, user_id);
create index tasks_user_status_idx on public.tasks(user_id, status, created_at desc);

-- Explicit grants override any permissive project defaults. User-facing access to
-- future engine/tool tables is read-only; write RPCs must arrive with later phases.
do $$
declare name text;
begin
  foreach name in array array['profiles', 'conversations', 'messages', 'agent_runs',
    'tool_executions', 'approval_requests', 'workspace_files', 'workspace_folders', 'tasks', 'user_settings']
  loop
    execute format('alter table public.%I enable row level security', name);
    execute format('revoke all on table public.%I from public, anon, authenticated', name);
    execute format('grant select on table public.%I to authenticated', name);
    execute format('create policy own_records_read on public.%I for select to authenticated using ((select auth.uid()) = user_id)', name);
  end loop;

  foreach name in array array['profiles', 'conversations', 'agent_runs', 'tool_executions',
    'approval_requests', 'workspace_files', 'workspace_folders', 'tasks', 'user_settings']
  loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', name);
  end loop;
end;
$$;

grant update (display_name) on public.profiles to authenticated;
create policy own_profile_update on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant update (timezone, theme) on public.user_settings to authenticated;
create policy own_settings_update on public.user_settings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function private.provision_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id, display_name)
    values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80));
  insert into public.user_settings(user_id) values (new.id);
  return new;
end;
$$;
revoke all on function private.provision_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.provision_user();

-- Existing accounts need records too; avoid overwriting existing profile data.
insert into public.profiles(user_id, display_name)
  select id, left(coalesce(raw_user_meta_data ->> 'display_name', ''), 80) from auth.users
  on conflict (user_id) do nothing;
insert into public.user_settings(user_id) select id from auth.users on conflict (user_id) do nothing;

commit;
