import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ConfirmForm } from "@/components/auth/confirm-form";
import { confirmationSchema, codeConfirmationSchema } from "@/lib/auth/validation";
import { readSupabaseEnv } from "@/lib/env";

export default async function Confirm({ searchParams }: {
  searchParams: Promise<{ token_hash?: string; type?: string; code?: string; sb_flow_id?: string }>;
}) {
  const params = await searchParams;
  const parsed = params.code !== undefined
    ? codeConfirmationSchema.safeParse(params)
    : confirmationSchema.safeParse(params);
  return <AuthShell title="Confirm your email" description="Continue to verify this link and open your account. Links can only be used once.">
    {parsed.success
      ? <ConfirmForm confirmation={parsed.data} configured={readSupabaseEnv().success} />
      : <p role="alert" className="text-sm leading-6 text-red-700">This link is missing valid confirmation details. <Link href="/forgot-password" className="underline">Request a password reset</Link> or <Link href="/signup" className="underline">return to sign up</Link>.</p>}
  </AuthShell>;
}
