import { connection } from "next/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { readSupabaseEnv } from "@/lib/env";

export default async function ForgotPassword() {
  await connection();
  return <AuthShell title="Reset your password" description="Enter your email and we will send instructions if you have an account.">
    <AuthForm kind="forgot" configured={readSupabaseEnv().success} />
  </AuthShell>;
}
