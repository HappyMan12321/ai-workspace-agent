"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseEnv } from "@/lib/env";
import { appOrigin } from "@/lib/auth/origin";
import { requireUser } from "@/lib/auth/session";
import {
  loginSchema, signupSchema, resetRequestSchema, passwordSchema,
  profileSchema, confirmationSchema, codeConfirmationSchema, type AuthState,
} from "@/lib/auth/validation";

function invalid(error: z.ZodError): AuthState {
  return { message: "Check the highlighted fields.", errors: z.flattenError(error).fieldErrors };
}
function unavailable(): AuthState | undefined {
  if (!readSupabaseEnv().success) return { message: "Configure Supabase before using accounts. See the setup page." };
}

export async function signIn(_previous: AuthState, form: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalid(parsed.error);
  const missing = unavailable();
  if (missing) return missing;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { message: "Unable to sign in. Check your credentials and confirm your email, or try again later." };
  } catch { return { message: "Sign-in is temporarily unavailable. Try again." }; }
  redirect("/app");
}

export async function signUp(_previous: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalid(parsed.error);
  const missing = unavailable();
  if (missing) return missing;
  let signedIn = false;
  try {
    const supabase = await createClient();
    const { email, password, displayName } = parsed.data;
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName }, emailRedirectTo: `${appOrigin()}/auth/confirm` },
    });
    if (error) return { message: "Unable to create an account. Try again later, or sign in if you already registered." };
    signedIn = Boolean(data.session);
  } catch { return { message: "Account registration is temporarily unavailable. Check the application configuration." }; }
  if (signedIn) redirect("/app");
  return { success: true, message: "Check your email for a confirmation link. If you already registered, use sign in or password reset." };
}

export async function requestPasswordReset(_previous: AuthState, form: FormData): Promise<AuthState> {
  const parsed = resetRequestSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalid(parsed.error);
  const missing = unavailable();
  if (missing) return missing;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${appOrigin()}/auth/confirm`,
    });
    if (error) return { message: "Password reset is temporarily unavailable. Wait a moment and try again." };
  } catch { return { message: "Password reset is temporarily unavailable. Check the application configuration." }; }
  return { success: true, message: "If an account exists for this email, you will receive a password reset link." };
}

export async function confirmEmail(_previous: AuthState, form: FormData): Promise<AuthState> {
  const input = Object.fromEntries(form);
  const parsed = "code" in input
    ? codeConfirmationSchema.safeParse(input)
    : confirmationSchema.safeParse(input);
  if (!parsed.success) return { message: "This confirmation link is invalid. Request a new email." };
  const missing = unavailable();
  if (missing) return missing;
  let recovery = false;
  try {
    const supabase = await createClient();
    if ("code" in parsed.data) {
      // Default Supabase emails return a PKCE code. The SDK requires the verifier
      // cookie from the browser that requested the email; URLs cannot replace it.
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        parsed.data.code,
        parsed.data.sb_flow_id ? { flowId: parsed.data.sb_flow_id } : undefined,
      );
      if (error || !data.session) return {
        message: "This link could not be confirmed. Open it in the same browser where you requested it, or request a new email.",
      };
      // Recovery intent comes from the SDK's stored verifier, never query input.
      recovery = "redirectType" in data && data.redirectType === "recovery";
    } else {
      const { error } = await supabase.auth.verifyOtp(parsed.data);
      if (error) return { message: "This link has expired or was already used. Request a new email." };
      recovery = parsed.data.type === "recovery";
    }
  } catch { return { message: "The email could not be confirmed. Try again." }; }
  redirect(recovery ? "/reset-password" : "/app");
}

export async function updatePassword(_previous: AuthState, form: FormData): Promise<AuthState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await requireUser();
  try {
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return { message: "The password could not be updated. Request a new recovery link and try again." };
  } catch { return { message: "The password could not be updated. Try again." }; }
  redirect("/app?notice=password_updated");
}

export async function updateProfile(_previous: AuthState, form: FormData): Promise<AuthState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await requireUser();
  try {
    const { error } = await supabase.from("profiles")
      .update({ display_name: parsed.data.displayName })
      .eq("user_id", user.id).select("user_id").single();
    if (error) return { message: "Your name could not be saved. Check that the database migration has been applied." };
  } catch { return { message: "Your name could not be saved. Try again." }; }
  return { success: true, message: "Your name has been saved. Refreshing keeps this change." };
}

export async function signOut(): Promise<void> {
  const { supabase } = await requireUser();
  let failed = false;
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    failed = Boolean(error);
  } catch { failed = true; }
  if (failed) redirect("/app?notice=logout_failed");
  redirect("/login?notice=signed_out");
}
