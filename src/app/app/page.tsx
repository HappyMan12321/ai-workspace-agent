import { connection } from "next/server";
import Link from "next/link";
import { Layers3, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { signOut } from "@/app/auth/actions";
import { ProfileForm } from "@/components/auth/profile-form";
import { Button } from "@/components/ui/button";

export default async function Workspace({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await connection();
  const { supabase, user } = await requireUser();
  const [{ data: profile, error: profileError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("user_id", user.id).single(),
    supabase.from("user_settings").select("timezone, theme").eq("user_id", user.id).single(),
  ]);
  const { notice } = await searchParams;
  const databaseReady = !profileError && !settingsError;
  return <main className="mx-auto max-w-5xl px-6 py-8">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
      <Link href="/" className="flex items-center gap-3 font-semibold"><Layers3 className="text-primary" aria-hidden />AI Workspace Agent</Link>
      <form action={signOut}><Button type="submit" variant="outline">Sign out</Button></form>
    </header>
    <section className="py-12">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your account</p>
      <h1 className="text-3xl font-semibold tracking-tight">Welcome to your workspace.</h1>
      <p className="mt-3 text-sm text-slate-600">Signed in as {user.email}</p>
      <Button asChild className="mt-6"><Link href="/app/chat">Open workspace chat</Link></Button>
      {notice === "password_updated" && <p role="status" className="mt-6 rounded-xl bg-green-50 p-4 text-sm text-green-900">Your password has been updated.</p>}
      {notice === "logout_failed" && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">Sign-out could not finish. Please try again.</p>}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-white p-6"><h2 className="mb-5 text-lg font-semibold">Profile</h2>
          {databaseReady ? <ProfileForm displayName={profile?.display_name ?? ""} /> : <p role="alert" className="text-sm leading-6 text-amber-900">Your account is verified, but profile data could not be loaded. Apply the Phase 2 database migration and refresh. No private records are shown.</p>}
        </section>
        <section className="rounded-2xl border border-border bg-white p-6"><ShieldCheck className="mb-4 text-primary" aria-hidden /><h2 className="text-lg font-semibold">Private by default</h2><p className="mt-3 text-sm leading-6 text-slate-600">Account data is scoped to your verified user. Agent tools, files, tasks, and approval workflows arrive in the following phases.</p>
          {databaseReady && <dl className="mt-5 flex gap-8 text-sm"><div><dt className="text-slate-500">Timezone</dt><dd className="mt-1">{settings?.timezone}</dd></div><div><dt className="text-slate-500">Theme preference</dt><dd className="mt-1">{settings?.theme}</dd></div></dl>}
        </section>
      </div>
    </section>
  </main>;
}
