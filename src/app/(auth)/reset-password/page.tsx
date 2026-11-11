import { connection } from "next/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { requireUser } from "@/lib/auth/session";

export default async function ResetPassword() {
  await connection();
  await requireUser();
  return <AuthShell title="Choose a new password" description="You have a verified session. Set a new password for your account.">
    <AuthForm kind="reset" configured />
  </AuthShell>;
}
