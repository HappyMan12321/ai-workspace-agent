-- Phase 3: bounded text chat only. These RPCs never authorize agent tools.
begin;

alter table public.agent_runs add column run_kind text not null default 'agent'
  check (run_kind in ('chat', 'agent'));
alter table public.messages add column chat_request_id uuid;
alter table public.messages add constraint messages_chat_request_owner_fk
  foreign key (user_id, chat_request_id)
  references public.agent_runs(user_id, idempotency_key) on delete cascade;
alter table public.messages add constraint messages_chat_roles_check
  check (chat_request_id is null or role in ('user', 'assistant'));
create unique index messages_chat_role_once_idx
  on public.messages(user_id, chat_request_id, role) where chat_request_id is not null;
create index chat_runs_user_created_idx on public.agent_runs(user_id, run_kind, created_at desc);

-- Durable lazy recovery, not a scheduler. Only expired CHAT runs owned by the
-- caller can be changed. Agent/tool/approval records are outside this boundary.
create function private.expire_chat_runs() returns integer
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); affected integer;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('chat:' || uid::text, 0));
  update public.agent_runs set status = 'timed_out', error_code = 'chat_timeout', finished_at = now()
    where user_id = uid and run_kind = 'chat' and status = 'running'
      and started_at <= now() - interval '45 seconds';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create function private.start_chat_turn(p_conversation_id uuid, p_request_id uuid, p_content text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); existing public.agent_runs%rowtype; new_run uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_conversation_id is null or p_request_id is null or p_content is null
    or length(btrim(p_content)) = 0 or length(p_content) > 4000 then
    raise exception 'invalid_chat_input' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('chat:' || uid::text, 0));

  select * into existing from public.agent_runs
    where user_id = uid and idempotency_key = p_request_id;
  if found then
    if existing.run_kind <> 'chat' or existing.conversation_id <> p_conversation_id
      or not exists(select 1 from public.messages where user_id = uid
        and chat_request_id = p_request_id and role = 'user' and content = p_content) then
      raise exception 'request_conflict' using errcode = '22023';
    end if;
    perform private.expire_chat_runs();
    select * into existing from public.agent_runs where id = existing.id;
    return jsonb_build_object('run_id', existing.id, 'status', existing.status, 'should_execute', false);
  end if;

  if exists(select 1 from public.conversations where id = p_conversation_id and user_id <> uid) then
    raise exception 'conversation_not_found' using errcode = '42501';
  end if;
  perform private.expire_chat_runs();
  if exists(select 1 from public.agent_runs where user_id = uid and run_kind = 'chat' and status = 'running') then
    raise exception 'chat_busy' using errcode = 'P0001';
  end if;
  if (select count(*) from public.agent_runs where user_id = uid and run_kind = 'chat'
      and created_at > now() - interval '1 minute') >= 8 then
    raise exception 'chat_rate_limited' using errcode = 'P0001';
  end if;
  if (select count(*) from public.agent_runs where user_id = uid and run_kind = 'chat'
      and created_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')) >= 60 then
    raise exception 'chat_daily_limit' using errcode = 'P0001';
  end if;

  insert into public.conversations(id, user_id, title)
    values (p_conversation_id, uid, left(btrim(p_content), 80)) on conflict (id) do nothing;
  -- Recheck after conflict as a concurrent account may have used this UUID.
  if not exists(select 1 from public.conversations where id = p_conversation_id and user_id = uid) then
    raise exception 'conversation_not_found' using errcode = '42501';
  end if;
  insert into public.agent_runs(user_id, conversation_id, idempotency_key, run_kind,
      status, iteration_count, started_at, state)
    values (uid, p_conversation_id, p_request_id, 'chat', 'running', 1, now(),
      '{"model":"gpt-6-luna","phase":3}'::jsonb) returning id into new_run;
  insert into public.messages(user_id, conversation_id, role, content, chat_request_id)
    values (uid, p_conversation_id, 'user', p_content, p_request_id);
  update public.conversations set updated_at = now() where id = p_conversation_id and user_id = uid;
  return jsonb_build_object('run_id', new_run, 'status', 'running', 'should_execute', true);
end;
$$;

create function private.finish_chat_turn(p_run_id uuid, p_content text, p_status text,
  p_error_code text, p_input_tokens integer, p_output_tokens integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); existing public.agent_runs%rowtype;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_status not in ('completed', 'partial_failure', 'failed') or p_status is null
    or (p_content is not null and length(p_content) > 16000)
    or (p_status in ('completed', 'partial_failure') and coalesce(length(btrim(p_content)), 0) = 0)
    or (p_status = 'failed' and p_content is not null)
    or coalesce(p_input_tokens, 0) not between 0 and 2000000
    or coalesce(p_output_tokens, 0) not between 0 and 100000
    or (p_error_code is not null and p_error_code not in
      ('provider_timeout', 'provider_unavailable', 'provider_rate_limit', 'provider_quota',
       'provider_auth', 'empty_response', 'output_limit', 'save_failed', 'history_unavailable')) then
    raise exception 'invalid_chat_result' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('chat:' || uid::text, 0));
  select * into existing from public.agent_runs where id = p_run_id and user_id = uid and run_kind = 'chat' for update;
  if not found then raise exception 'chat_run_not_found' using errcode = '42501'; end if;
  perform private.expire_chat_runs();
  select * into existing from public.agent_runs where id = p_run_id;
  if existing.status <> 'running' then
    return jsonb_build_object('run_id', existing.id, 'status', existing.status);
  end if;
  if p_content is not null then
    insert into public.messages(user_id, conversation_id, role, content, chat_request_id)
      values (uid, existing.conversation_id, 'assistant', p_content, existing.idempotency_key);
  end if;
  update public.agent_runs set status = p_status, error_code = p_error_code, finished_at = now(),
    state = state || jsonb_build_object('input_tokens', coalesce(p_input_tokens,0), 'output_tokens', coalesce(p_output_tokens,0))
    where id = existing.id;
  update public.conversations set updated_at = now() where id = existing.conversation_id and user_id = uid;
  return jsonb_build_object('run_id', existing.id, 'status', p_status);
end;
$$;

-- No general INSERT/UPDATE/DELETE grants. Narrow invoker wrappers expose only
-- these owner-scoped CHAT primitives. Conversational text is not an audit log,
-- provider attestation, tool result or source of permission. It is untrusted input.
grant usage on schema private to authenticated;
revoke all on function private.expire_chat_runs() from public, anon, authenticated;
revoke all on function private.start_chat_turn(uuid,uuid,text) from public, anon, authenticated;
revoke all on function private.finish_chat_turn(uuid,text,text,text,integer,integer) from public, anon, authenticated;
grant execute on function private.expire_chat_runs() to authenticated;
grant execute on function private.start_chat_turn(uuid,uuid,text) to authenticated;
grant execute on function private.finish_chat_turn(uuid,text,text,text,integer,integer) to authenticated;

create function public.expire_chat_runs() returns integer
language sql security invoker set search_path = '' as $$ select private.expire_chat_runs(); $$;
create function public.start_chat_turn(p_conversation_id uuid, p_request_id uuid, p_content text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.start_chat_turn(p_conversation_id,p_request_id,p_content); $$;
create function public.finish_chat_turn(p_run_id uuid, p_content text, p_status text,
  p_error_code text, p_input_tokens integer, p_output_tokens integer) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.finish_chat_turn(p_run_id,p_content,p_status,p_error_code,p_input_tokens,p_output_tokens);
$$;
revoke all on function public.expire_chat_runs() from public, anon, authenticated;
revoke all on function public.start_chat_turn(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.finish_chat_turn(uuid,text,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.expire_chat_runs() to authenticated;
grant execute on function public.start_chat_turn(uuid,uuid,text) to authenticated;
grant execute on function public.finish_chat_turn(uuid,text,text,text,integer,integer) to authenticated;

commit;
