import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { readSupabaseEnv } from "@/lib/env";

const notices: Record<string, string> = {
  setup: "Supabase must be configured before you can access the workspace.",
  session: "Sign in to continue to your workspace.",
  signed_out: "You have signed out on this device.",
};
export default async function Login({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  return <AuthShell title="Welcome back" description="Sign in to your private workspace.">
    {notice && notices[notice] && <p role="status" className="mb-5 rounded-lg bg-slate-100 p-3 text-sm">{notices[notice]}</p>}
    <AuthForm kind="login" configured={readSupabaseEnv().success} />
  </AuthShell>;
}
