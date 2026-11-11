import Link from "next/link";
import { Layers3 } from "lucide-react";

export function AuthShell({ title, description, children }: {
  title: string; description: string; children: React.ReactNode;
}) {
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
    <Link href="/" className="mb-8 flex items-center gap-3 self-start font-semibold"><span className="rounded-xl bg-primary p-2.5 text-white"><Layers3 size={21} aria-hidden /></span>AI Workspace Agent</Link>
    <section className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mb-7 mt-2 text-sm leading-6 text-slate-600">{description}</p>
      {children}
    </section>
    <p className="mt-6 text-center text-xs text-slate-500">Your workspace stays private to your account.</p>
  </main>;
}
