import { connection } from "next/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { readSupabaseEnv } from "@/lib/env";

export default async function Signup() {
  await connection();
  return <AuthShell title="Create your account" description="Start with a private space for your work. Confirm your email to finish signing up.">
    <AuthForm kind="signup" configured={readSupabaseEnv().success} />
  </AuthShell>;
}
