import { afterEach, describe, expect, it, vi } from "vitest";
import { readSupabaseEnv, requireSupabaseEnv, supabaseEnvSchema } from "@/lib/env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example_configuration_only",
};
afterEach(() => vi.unstubAllEnvs());
describe("Supabase environment", () => {
  it("accepts HTTPS and a publishable key", () => {
    expect(supabaseEnvSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects missing values, non-HTTPS URLs and privileged keys", () => {
    expect(supabaseEnvSchema.safeParse({}).success).toBe(false);
    expect(supabaseEnvSchema.safeParse({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "http://example.com" }).success).toBe(false);
    expect(supabaseEnvSchema.safeParse({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_do_not_expose" }).success).toBe(false);
  });
  it("reports names without exposing invalid values", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "secret-invalid-url");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_secret_sensitive");
    expect(readSupabaseEnv().success).toBe(false);
    expect(() => requireSupabaseEnv()).toThrow("NEXT_PUBLIC_SUPABASE_URL");
    try { requireSupabaseEnv(); } catch (error) {
      expect(String(error)).not.toContain("sb_secret_sensitive");
      expect(String(error)).not.toContain("secret-invalid-url");
    }
  });
});
