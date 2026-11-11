import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), requireUser: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
  signInWithPassword: vi.fn(), signUp: vi.fn(), resetPasswordForEmail: vi.fn(),
  verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), from: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { signIn, signUp, requestPasswordReset, confirmEmail, updatePassword, updateProfile, signOut } from "@/app/auth/actions";

const client = { auth: mocks, from: mocks.from };
const validPassword = "a-long-unique-passphrase";
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example_configuration_only");
  vi.stubEnv("APP_URL", "https://workspace.example.com");
  mocks.createClient.mockResolvedValue(client);
  mocks.requireUser.mockResolvedValue({ supabase: client, user: { id: "verified-owner" } });
});
afterEach(() => vi.unstubAllEnvs());
describe("authentication actions", () => {
  it("rejects malformed input before contacting Auth", async () => {
    const result = await signIn({}, form({ email: "invalid", password: "" }));
    expect(result.errors?.email).toBeDefined();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("handles missing configuration without creating a client", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const result = await signIn({}, form({ email: "user@example.com", password: validPassword }));
    expect(result.message).toContain("Configure Supabase");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("does not reflect raw Auth errors or reveal credential details", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: "sensitive detail" } });
    const result = await signIn({}, form({ email: "user@example.com", password: validPassword }));
    expect(result.message).toContain("Unable to sign in");
    expect(JSON.stringify(result)).not.toContain("sensitive detail");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("redirects a successful login to a fixed destination", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    await expect(signIn({}, form({ email: "user@example.com", password: validPassword, next: "https://attacker.example" }))).rejects.toThrow("REDIRECT:/app");
  });
  it("requires matching strong passwords for registration", async () => {
    const result = await signUp({}, form({ email: "user@example.com", displayName: "Ada", password: validPassword, confirmPassword: "different" }));
    expect(result.errors?.confirmPassword).toBeDefined();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("uses a configured email origin and sends display metadata only", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const result = await signUp({}, form({ email: "user@example.com", displayName: "Ada", password: validPassword, confirmPassword: validPassword, user_id: "forged-owner" }));
    expect(result.success).toBe(true);
    expect(mocks.signUp).toHaveBeenCalledWith({ email: "user@example.com", password: validPassword, options: { data: { display_name: "Ada" }, emailRedirectTo: "https://workspace.example.com/auth/confirm" } });
  });
  it("keeps password reset responses independent of account existence", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    const result = await requestPasswordReset({}, form({ email: "unknown@example.com" }));
    expect(result.message).toContain("If an account exists");
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("unknown@example.com", { redirectTo: "https://workspace.example.com/auth/confirm" });
  });
  it("rejects unsupported confirmation types without consuming a token", async () => {
    const result = await confirmEmail({}, form({ token_hash: "a".repeat(64), type: "invite" }));
    expect(result.message).toContain("invalid");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });
  it("handles expired links without reflecting upstream errors", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { message: "raw details" } });
    const result = await confirmEmail({}, form({ token_hash: "a".repeat(64), type: "email" }));
    expect(result.message).toContain("expired");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("redirects recovery to the fixed password page", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null });
    await expect(confirmEmail({}, form({ token_hash: "a".repeat(64), type: "recovery", next: "//attacker.example" }))).rejects.toThrow("REDIRECT:/reset-password");
  });
  it("exchanges default-email codes without trusting URL redirect or recovery intent", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: { user: {} }, redirectType: null }, error: null });
    await expect(confirmEmail({}, form({ code: "a".repeat(32), type: "recovery", next: "https://attacker.example" }))).rejects.toThrow("REDIRECT:/app");
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("a".repeat(32), undefined);
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });
  it("routes verified PKCE recovery and passes an explicit valid flow ID", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: { user: {} }, redirectType: "recovery" }, error: null });
    await expect(confirmEmail({}, form({ code: "a".repeat(32), sb_flow_id: "b".repeat(32) }))).rejects.toThrow("REDIRECT:/reset-password");
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("a".repeat(32), { flowId: "b".repeat(32) });
  });
  it("rejects malformed flow IDs before exchanging a code", async () => {
    const result = await confirmEmail({}, form({ code: "a".repeat(32), sb_flow_id: "../../other" }));
    expect(result.message).toContain("invalid");
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it("reports missing-verifier or expired-code failures without exposing SDK details", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: { message: "sensitive verifier detail" } });
    const result = await confirmEmail({}, form({ code: "a".repeat(32) }));
    expect(result.message).toContain("same browser");
    expect(JSON.stringify(result)).not.toContain("sensitive verifier detail");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("verifies the session before changing a password", async () => {
    mocks.updateUser.mockResolvedValue({ error: null });
    await expect(updatePassword({}, form({ password: validPassword, confirmPassword: validPassword }))).rejects.toThrow("REDIRECT:/app?notice=password_updated");
    expect(mocks.requireUser).toHaveBeenCalled();
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: validPassword });
  });
  it("uses the verified user ID for profile changes", async () => {
    const single = vi.fn().mockResolvedValue({ error: null });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    mocks.from.mockReturnValue({ update });
    const result = await updateProfile({}, form({ displayName: "New name", user_id: "forged-owner" }));
    expect(result.success).toBe(true);
    expect(eq).toHaveBeenCalledWith("user_id", "verified-owner");
    expect(update).toHaveBeenCalledWith({ display_name: "New name" });
  });
  it("never mutates profile data if session verification fails", async () => {
    mocks.requireUser.mockRejectedValueOnce(new Error("REDIRECT:/login"));
    await expect(updateProfile({}, form({ displayName: "Ada" }))).rejects.toThrow("REDIRECT:/login");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("reports logout failure rather than claiming the session ended", async () => {
    mocks.signOut.mockResolvedValue({ error: { message: "network" } });
    await expect(signOut()).rejects.toThrow("REDIRECT:/app?notice=logout_failed");
  });
  it("signs out the current device on success", async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    await expect(signOut()).rejects.toThrow("REDIRECT:/login?notice=signed_out");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
