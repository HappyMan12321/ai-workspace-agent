import { connection } from "next/server";
import { CheckCircle2, Circle, Layers3, ArrowUpRight } from "lucide-react";
import { ConnectionCheck } from "@/components/connection-check";
import { readSupabaseEnv } from "@/lib/env";

const phases = ["Project foundation", "Authentication & data", "Chat & OpenAI", "Agent execution", "Files & tasks", "Approvals & live status", "Workspace dashboard", "Testing & deployment"];

export default async function Home() {
  await connection();
  const configured = readSupabaseEnv().success;
  return <main className="mx-auto max-w-6xl px-6 py-8 md:py-12">
    <header className="flex items-center justify-between gap-4 border-b border-border pb-6">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-primary p-2.5 text-white"><Layers3 size={22} aria-hidden /></span><span className="font-semibold tracking-tight">AI Workspace Agent</span></div>
      <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium">Phase 01 / 08</span>
    </header>
    <div className="grid gap-12 py-12 md:grid-cols-[1fr_280px]">
      <section className="space-y-8">
        <div className="space-y-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your cloud workspace starts here</p><h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">A foundation for getting things done.</h1><p className="max-w-lg leading-7 text-slate-600">The application shell is ready. Connect your Supabase project to prepare for secure accounts, persistent files, and agent-powered work.</p></div>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Supabase connection</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{configured ? "Configured · unverified" : "Setup required"}</span></div>
          <ol className="mb-6 space-y-3 text-sm leading-6 text-slate-600"><li>1. Create a development project in Supabase.</li><li>2. Copy <code>.env.example</code> to <code>.env.local</code>.</li><li>3. Add your project URL and publishable key, then restart.</li></ol>
          <ConnectionCheck />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">{[["Next.js", "App Router + TypeScript"], ["Supabase", "Auth, PostgreSQL & Storage"], ["Vercel", "Deployment target"]].map(([title, detail]) => <div key={title} className="rounded-xl border border-border p-4"><h2 className="mb-2 text-sm font-semibold">{title}</h2><p className="text-xs leading-5 text-slate-600">{detail}</p></div>)}</div>
        <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">Open Supabase dashboard <ArrowUpRight size={16} aria-hidden /></a>
      </section>
      <aside className="rounded-2xl border border-border bg-white p-6 self-start"><h2 className="mb-6 font-semibold">Build roadmap</h2><ol className="space-y-5">{phases.map((phase, i) => <li key={phase} className="flex items-start gap-3">{i === 0 ? <CheckCircle2 className="mt-0.5 shrink-0 text-primary" size={17} aria-hidden /> : <Circle className="mt-0.5 shrink-0 text-slate-300" size={17} aria-hidden />}<div><p className={`text-sm ${i === 0 ? "font-semibold" : "text-slate-500"}`}>{phase}</p><p className="mt-1 text-xs text-slate-400">{i === 0 ? "Implemented · connection pending" : `Phase ${i + 1} · upcoming`}</p></div></li>)}</ol></aside>
    </div>
    <footer className="border-t border-border pt-5 text-xs leading-6 text-slate-500">Phase 1 foundation. Sign-in, agent tools, workspace data, and production deployment arrive in subsequent phases.</footer>
  </main>;
}
