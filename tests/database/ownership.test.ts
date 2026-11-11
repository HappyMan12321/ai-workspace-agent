import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

const owner = "10000000-0000-0000-0000-000000000001";
const other = "20000000-0000-0000-0000-000000000002";
const tables = ["profiles", "user_settings", "conversations", "messages", "agent_runs", "tool_executions", "approval_requests", "workspace_folders", "workspace_files", "tasks"];
let db: PGlite;

async function asOwner() {
  await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${owner}', false)`);
}
beforeAll(async () => {
  // PGlite is test-only, in-memory PostgreSQL. App data never uses this engine.
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values ('${owner}', '{"display_name":"Existing account"}');
  `);
  await db.exec(await readFile(new URL("../../supabase/migrations/20261110000100_phase2_auth_schema.sql", import.meta.url), "utf8"));
  await db.exec(`insert into auth.users values ('${other}', '{"display_name":"Other user"}');`);
  for (const [user, n] of [[owner, "1"], [other, "2"]]) {
    await db.exec(`
      insert into public.conversations(id, user_id) values ('${n}0000000-0000-0000-0000-000000000010', '${user}');
      insert into public.messages(user_id, conversation_id, role, content) values ('${user}', '${n}0000000-0000-0000-0000-000000000010', 'user', 'private');
      insert into public.agent_runs(id, user_id, conversation_id, idempotency_key) values ('${n}0000000-0000-0000-0000-000000000020', '${user}', '${n}0000000-0000-0000-0000-000000000010', gen_random_uuid());
      insert into public.tool_executions(id, user_id, agent_run_id, tool_call_id, tool_name, risk_level) values ('${n}0000000-0000-0000-0000-000000000030', '${user}', '${n}0000000-0000-0000-0000-000000000020', 'call-1', 'delete_file', 'high');
      insert into public.approval_requests(user_id, agent_run_id, tool_execution_id, operation_digest) values ('${user}', '${n}0000000-0000-0000-0000-000000000020', '${n}0000000-0000-0000-0000-000000000030', repeat('a', 64));
      insert into public.workspace_folders(id, user_id, workspace_id, path) values ('${n}0000000-0000-0000-0000-000000000040', '${user}', '${user}', 'projects');
      insert into public.workspace_files(user_id, workspace_id, folder_id, path) values ('${user}', '${user}', '${n}0000000-0000-0000-0000-000000000040', 'projects/readme.md');
      insert into public.tasks(user_id, title) values ('${user}', 'Private task');
    `);
  }
}, 30000);
afterAll(async () => { await db?.close(); });

it("enables RLS on all ten application tables", async () => {
  await db.exec("reset role");
  const result = await db.query<{ relname: string; relrowsecurity: boolean }>("select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'");
  expect(result.rows).toHaveLength(10);
  expect(result.rows.every(row => row.relrowsecurity)).toBe(true);
});
it("backfills existing accounts and provisions new profiles/settings", async () => {
  await db.exec("reset role");
  expect((await db.query("select * from public.profiles")).rows).toHaveLength(2);
  expect((await db.query("select * from public.user_settings")).rows).toHaveLength(2);
});
it("returns only the owner’s rows on every table, even when querying another owner", async () => {
  await asOwner();
  for (const table of tables) {
    const result = await db.query<{ user_id: string }>(`select user_id from public.${table}`);
    expect(result.rows.length, table).toBeGreaterThan(0);
    expect(result.rows.every(row => row.user_id === owner), table).toBe(true);
    expect((await db.query(`select user_id from public.${table} where user_id = '${other}'`)).rows, table).toHaveLength(0);
  }
});
it("does not grant anonymous access to any user-owned table", async () => {
  await db.exec("reset role; set role anon");
  for (const table of tables) {
    await expect(db.query(`select * from public.${table}`)).rejects.toThrow(/permission denied/);
  }
});
it("allows own profile changes, denies cross-user changes and ownership reassignment", async () => {
  await asOwner();
  expect((await db.query(`update public.profiles set display_name = 'Saved name' where user_id = '${owner}' returning display_name`)).rows).toEqual([{ display_name: "Saved name" }]);
  expect((await db.query(`update public.profiles set display_name = 'Intrusion' where user_id = '${other}' returning user_id`)).rows).toHaveLength(0);
  await expect(db.query(`update public.profiles set user_id = '${other}' where user_id = '${owner}'`)).rejects.toThrow(/permission denied/);
  await db.exec("reset role");
  expect((await db.query(`select display_name from public.profiles where user_id = '${other}'`)).rows).toEqual([{ display_name: "Other user" }]);
});
it("allows only own preference updates", async () => {
  await asOwner();
  expect((await db.query(`update public.user_settings set theme = 'dark' where user_id = '${owner}' returning theme`)).rows).toEqual([{ theme: "dark" }]);
  expect((await db.query(`update public.user_settings set theme = 'dark' where user_id = '${other}' returning user_id`)).rows).toHaveLength(0);
});
it("prevents direct writes that could forge runs, approve operations or erase audit history", async () => {
  await asOwner();
  for (const table of tables) {
    await expect(db.query(`delete from public.${table} where user_id = '${owner}'`)).rejects.toThrow(/permission denied/);
  }
  await expect(db.query(`update public.approval_requests set status = 'approved' where user_id = '${owner}'`)).rejects.toThrow(/permission denied/);
  await expect(db.query(`insert into public.tasks(user_id,title) values ('${owner}', 'Bypass')`)).rejects.toThrow(/permission denied/);
});
it("rejects cross-owner conversation, run and folder references at the database boundary", async () => {
  await db.exec("reset role");
  await expect(db.query(`insert into public.messages(user_id,conversation_id,role) values ('${owner}', '20000000-0000-0000-0000-000000000010', 'user')`)).rejects.toThrow(/foreign key/);
  await expect(db.query(`insert into public.tool_executions(user_id,agent_run_id,tool_call_id,tool_name,risk_level) values ('${owner}', '20000000-0000-0000-0000-000000000020', 'cross', 'read_file', 'low')`)).rejects.toThrow(/foreign key/);
  await expect(db.query(`insert into public.workspace_files(user_id,workspace_id,folder_id,path) values ('${owner}', '${owner}', '20000000-0000-0000-0000-000000000040', 'bad.md')`)).rejects.toThrow(/foreign key/);
});
it("enforces run idempotency and ownership-derived object keys", async () => {
  await db.exec("reset role");
  const rows = (await db.query<{ object_key: string }>(`select object_key from public.workspace_files where user_id='${owner}'`)).rows;
  expect(rows[0].object_key).toBe(`${owner}/${owner}/projects/readme.md`);
  await expect(db.query(`insert into public.agent_runs(user_id,conversation_id,idempotency_key) select user_id,conversation_id,idempotency_key from public.agent_runs where user_id='${owner}'`)).rejects.toThrow(/unique constraint/);
});
it("rejects traversal paths and oversize file metadata", async () => {
  await db.exec("reset role");
  for (const path of ["../secret", "/absolute", "a/../b", "a//b", "a/", "./a", "a\\b"]) {
    await expect(db.query("insert into public.workspace_files(user_id,workspace_id,path) values ($1,$1,$2)", [owner,path])).rejects.toThrow(/check constraint/);
  }
  await expect(db.query(`insert into public.workspace_files(user_id,workspace_id,path,size_bytes) values ('${owner}','${owner}','big.bin',10485761)`)).rejects.toThrow(/check constraint/);
});
