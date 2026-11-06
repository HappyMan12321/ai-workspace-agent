import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

function configure() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example_configuration_only");
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("health endpoint", () => {
  it("does not call Supabase without configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).status).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reports a read-only Auth probe without exposing settings", async () => {
    configure();
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"private":"upstream"}'));
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok", supabase: "auth_reachable" });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://example.supabase.co/auth/v1/settings");
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("handles rejected keys without reflecting upstream responses", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("sensitive upstream error", { status: 401 })));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "degraded", supabase: "unreachable_or_invalid_key" });
  });
  it("handles timeouts and network errors without reflecting exceptions", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("sensitive detail", "TimeoutError")));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive detail");
  });
});
