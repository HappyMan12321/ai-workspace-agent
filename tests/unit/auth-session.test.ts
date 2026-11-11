import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { requireUser } from "@/lib/auth/session";
import { appOrigin } from "@/lib/auth/origin";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example_configuration_only");
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
});
afterEach(() => vi.unstubAllEnvs());
it("rejects unconfigured protected access", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  await expect(requireUser()).rejects.toThrow("REDIRECT:/login?notice=setup");
  expect(mocks.getUser).not.toHaveBeenCalled();
});
it("rejects missing or invalid verified users", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(requireUser()).rejects.toThrow("REDIRECT:/login?notice=session");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "forged" } }, error: { message: "invalid signature" } });
  await expect(requireUser()).rejects.toThrow("REDIRECT:/login?notice=session");
});
it("returns the server-verified user", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "verified" } }, error: null });
  expect((await requireUser()).user.id).toBe("verified");
});
it("accepts only canonical HTTPS or local development email origins", () => {
  for (const url of ["https://workspace.example.com", "http://localhost:3000", "http://127.0.0.1:3100"]) {
    vi.stubEnv("APP_URL", url);
    expect(appOrigin()).toBe(url);
  }
  for (const url of ["http://external.example", "https://user:password@example.com", "https://example.com/path", "https://example.com?next=evil", "javascript:alert(1)", ""]) {
    vi.stubEnv("APP_URL", url);
    expect(() => appOrigin()).toThrow();
  }
});
