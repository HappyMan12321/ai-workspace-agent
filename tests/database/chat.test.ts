import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";

const owner = "10000000-0000-0000-0000-000000000001";
const other = "20000000-0000-0000-0000-000000000002";
let db: PGlite;
async function actor(id: string) {
  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
async function start(conversation = randomUUID(), request = randomUUID(), content = "Plan my project") {
  const result = await db.query<{ result: { run_id: string; should_execute: boolean; status: string } }>(
    "select public.start_chat_turn($1,$2,$3) as result", [conversation,request,content]);
  return { ...result.rows[0].result, conversation, request };
}
async function finish(id: string, content: string | null = "A useful plan", status = "completed") {
  return db.query("select public.finish_chat_turn($1,$2,$3,$4,100,30) as result", [id,content,status,status === "failed" ? "provider_timeout" : null]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;`);
  for (const migration of ["20261110000100_phase2_auth_schema.sql","20261110000200_phase3_chat.sql"]) {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${migration}`,import.meta.url),"utf8"));
  }
  await db.exec(`insert into auth.users(id) values ('${owner}'),('${other}')`);
},30000);
beforeEach(async () => { await db.exec("reset role; delete from public.conversations;"); await actor(owner); });
afterAll(async () => db?.close());
it("atomically saves the user message and one owned chat run",async()=>{
  const run=await start();
  expect(run.should_execute).toBe(true);
  expect((await db.query<{ role:string; user_id:string }>("select role,user_id from public.messages")).rows).toEqual([{role:"user",user_id:owner}]);
  expect((await db.query<{ run_kind:string; status:string }>("select run_kind,status from public.agent_runs")).rows).toEqual([{run_kind:"chat",status:"running"}]);
});
it("replays an identical request without execution and rejects changed input",async()=>{
  const run=await start();
  const replay=await start(run.conversation,run.request);
  expect(replay.should_execute).toBe(false);
  expect(replay.run_id).toBe(run.run_id);
  await expect(start(run.conversation,run.request,"Different message")).rejects.toThrow("request_conflict");
  expect((await db.query("select * from public.messages")).rows).toHaveLength(1);
});
it("saves assistant output once and never overwrites a completed reply",async()=>{
  const run=await start(); await finish(run.run_id); await finish(run.run_id,"Different reply");
  const rows=(await db.query<{role:string;content:string}>("select role,content from public.messages where role='assistant'")).rows;
  expect(rows).toEqual([{role:"assistant",content:"A useful plan"}]);
  expect((await start(run.conversation,run.request)).status).toBe("completed");
});
it("isolates conversations and prevents finishing another user's chat",async()=>{
  const run=await start(); await actor(other);
  expect((await db.query("select * from public.conversations")).rows).toHaveLength(0);
  await expect(start(run.conversation)).rejects.toThrow("conversation_not_found");
  await expect(finish(run.run_id)).rejects.toThrow("chat_run_not_found");
});
it("cannot finish an agent-kind run or directly forge messages/approvals",async()=>{
  const run=await start(); await db.exec("reset role");
  const agentId=randomUUID();
  await db.query("insert into public.agent_runs(id,user_id,conversation_id,idempotency_key) values($1,$2,$3,$4)",[agentId,owner,run.conversation,randomUUID()]);
  await actor(owner);
  await expect(finish(agentId)).rejects.toThrow("chat_run_not_found");
  await expect(db.query(`insert into public.messages(user_id,conversation_id,role,content) values('${owner}','${run.conversation}','system','Bypass')`)).rejects.toThrow(/permission denied/);
  await expect(db.query("update public.approval_requests set status='approved'")).rejects.toThrow(/permission denied/);
});
it("blocks anonymous RPC access and authenticated calls without an identity",async()=>{
  await db.exec("reset role; set role anon");
  await expect(start()).rejects.toThrow(/permission denied/);
  await actor(""); await expect(start()).rejects.toThrow("not_authenticated");
});
it("allows one active chat per user and recovers expired runs without repeating them",async()=>{
  const run=await start(); await expect(start()).rejects.toThrow("chat_busy");
  await db.exec("reset role");
  await db.query("update public.agent_runs set started_at=now()-interval '46 seconds' where id=$1",[run.run_id]);
  await actor(owner);
  expect((await start(run.conversation,run.request)).status).toBe("timed_out");
  await finish(run.run_id,"Late answer");
  expect((await db.query("select * from public.messages where role='assistant'")).rows).toHaveLength(0);
  expect((await start()).should_execute).toBe(true);
});
it("enforces persistent per-minute rate limits",async()=>{
  for(let i=0;i<8;i++){const run=await start();await finish(run.run_id);}
  await expect(start()).rejects.toThrow("chat_rate_limited");
});
it("enforces the UTC daily cap independently of the per-minute cap",async()=>{
  const conversation=randomUUID();
  await db.exec("reset role");
  await db.query("insert into public.conversations(id,user_id) values($1,$2)",[conversation,owner]);
  await db.query(`insert into public.agent_runs(user_id,conversation_id,idempotency_key,run_kind,status,created_at)
    select $1,$2,gen_random_uuid(),'chat','completed',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' from generate_series(1,60)`,[owner,conversation]);
  await actor(owner); await expect(start()).rejects.toThrow("chat_daily_limit");
});
it("preserves failed and partial turns explicitly",async()=>{
  const first=await start(); await finish(first.run_id,null,"failed");
  expect((await start(first.conversation,first.request)).status).toBe("failed");
  const second=await start(); await finish(second.run_id,"A partial reply","partial_failure");
  expect((await start(second.conversation,second.request)).status).toBe("partial_failure");
});
