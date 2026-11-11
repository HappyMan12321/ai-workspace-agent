import { expect, test } from "@playwright/test";

test("chat API rejects foreign origins and oversized requests", async ({ request }) => {
  const body = { conversationId: "10000000-0000-4000-8000-000000000001", requestId: "10000000-0000-4000-8000-000000000002", content: "Hello" };
  const foreign = await request.post("/api/chat", { data: body, headers: { Origin: "https://attacker.example" } });
  expect(foreign.status()).toBe(403);
  const large = await request.post("/api/chat", { data: { ...body, content: "x".repeat(17000) }, headers: { Origin: "http://127.0.0.1:3100" } });
  expect(large.status()).toBe(413);
});

test("unconfigured chat returns a safe response without exposing configuration", async ({ request }) => {
  const response = await request.post("/api/chat", { headers: { Origin: "http://127.0.0.1:3100" }, data: { conversationId: "10000000-0000-4000-8000-000000000001", requestId: "10000000-0000-4000-8000-000000000002", content: "Hello" } });
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ error: "not_configured", message: "Chat setup is not complete." });
  expect(response.headers()["cache-control"]).toContain("no-store");
});
