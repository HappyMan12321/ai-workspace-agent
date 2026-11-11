"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, CheckCircle2, Layers3, MessageSquare, Plus, RefreshCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage, Conversation, ChatRun } from "@/lib/chat/schemas";

type Props = {
  conversationId?: string;
  conversations: Conversation[];
  messages: ChatMessage[];
  runs: ChatRun[];
  configured: boolean;
  loadFailed: boolean;
};
const runLabels: Record<string, string> = {
  running: "Reply in progress. Refresh to check the saved status.",
  failed: "The last reply could not finish. Your message is saved.",
  timed_out: "The last reply timed out. You can send a new request.",
  partial_failure: "The last reply reached its output limit and may be incomplete.",
};

export function ChatWorkspace({ conversationId, conversations, messages, runs, configured, loadFailed }: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [pendingText, setPendingText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const attempt = useRef<{ conversationId: string; requestId: string; content: string } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const latest = runs[0];
  const active = latest?.status === "running";
  const disabled = busy || refreshing || active || !configured || loadFailed;

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = content.trim();
    if (!text || disabled) return;
    // Preserve the exact attempt across transport failures. A retry must not bill
    // a second model request if the first response was lost after it committed.
    if (!attempt.current || attempt.current.content !== text) {
      attempt.current = { conversationId: conversationId ?? crypto.randomUUID(), requestId: crypto.randomUUID(), content: text };
    }
    const submitted = attempt.current;
    setBusy(true); setPendingText(text); setError("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitted), signal: AbortSignal.timeout(50000),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.message === "string" ? result.message : "The reply could not finish.");
        if (response.status === 401) { router.push("/login?notice=session"); return; }
        if (!result.conversationId) return;
      }
      if (result.conversationId) {
        // The backend has persisted the request. The transcript on the next page
        // comes from the database, including explicit failed/partial run status.
        setContent(""); attempt.current = null;
        startRefresh(() => {
          if (!conversationId) router.replace(`/app/chat/${submitted.conversationId}`);
          else router.refresh();
        });
      }
    } catch {
      setError("The connection ended before a result arrived. Retry this same message to check its saved result without starting it twice.");
    } finally { setBusy(false); setPendingText(""); }
  }

  return <main className="mx-auto grid min-h-screen max-w-7xl md:grid-cols-[260px_1fr]">
    <aside className="border-b border-border bg-white p-5 md:border-b-0 md:border-r">
      <Link href="/app" className="flex items-center gap-2.5 py-2 text-sm font-semibold"><Layers3 className="text-primary" size={23} aria-hidden />AI Workspace Agent</Link>
      <Button asChild className="mt-6 w-full"><Link href="/app/chat"><Plus size={16} aria-hidden />New conversation</Link></Button>
      <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-widest text-slate-400">Recent conversations</h2>
      <nav aria-label="Conversations" className="flex gap-2 overflow-x-auto md:block md:space-y-1">
        {conversations.map(item => <Link key={item.id} href={`/app/chat/${item.id}`} aria-current={item.id === conversationId ? "page" : undefined}
          className={`flex min-w-40 items-center gap-2 rounded-lg px-3 py-3 text-sm md:min-w-0 ${item.id === conversationId ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-50"}`}>
          <MessageSquare size={15} className="shrink-0" aria-hidden /><span className="truncate">{item.title}</span>
        </Link>)}
        {!conversations.length && <p className="text-sm leading-6 text-slate-500">Your conversations will appear here after your first message.</p>}
      </nav>
      <Link href="/app" className="mt-8 inline-flex items-center gap-2 text-sm text-slate-500 underline underline-offset-4"><UserRound size={15} aria-hidden />Account</Link>
    </aside>
    <section className="flex min-w-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-5 md:px-10">
        <div><h1 className="text-lg font-semibold">Workspace chat</h1><p className="mt-1 text-xs text-slate-500">Text chat · GPT-6 Luna</p></div>
        <Button variant="outline" size="sm" onClick={() => startRefresh(() => router.refresh())} disabled={busy || refreshing}><RefreshCw size={14} aria-hidden />Refresh</Button>
      </header>
      <div className="flex-1 px-6 py-8 md:px-10">
        {loadFailed && <p role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Conversations are temporarily unavailable. Your account is still accessible. Refresh after workspace setup is complete.</p>}
        {!configured && <p role="status" className="mb-6 rounded-xl border border-border bg-white p-4 text-sm text-slate-600">Chat is waiting for the workspace owner to finish setup. Your conversations will stay private to your account.</p>}
        {!messages.length && !pendingText && <div className="mx-auto max-w-lg py-14 text-center">
          <span className="mb-5 inline-flex rounded-2xl bg-primary/10 p-4 text-primary"><MessageSquare size={27} aria-hidden /></span>
          <h2 className="text-3xl font-semibold tracking-tight">Make room for your next idea.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">Ask for a plan, explain a concept, or work through a draft. Your conversation is saved as you go.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">{["Help me plan my week", "Outline my project demo", "Explain a concept clearly"].map(prompt => <button key={prompt} onClick={() => setContent(prompt)} className="rounded-full border border-border bg-white px-3 py-2 text-xs text-slate-600 hover:border-primary">{prompt}</button>)}</div>
        </div>}
        <ol aria-label="Messages" className="mx-auto max-w-3xl space-y-6">
          {messages.map(message => <li key={message.id} className={message.role === "user" ? "ml-6 rounded-2xl bg-primary/10 p-5 md:ml-16" : "mr-4 rounded-2xl border border-border bg-white p-5 md:mr-12"}>
            <p className="mb-2 text-xs font-semibold text-primary">{message.role === "user" ? "You" : "Workspace Agent"}</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">{message.content}</p>
          </li>)}
          {pendingText && <li className="ml-6 rounded-2xl bg-primary/10 p-5 md:ml-16"><p className="mb-2 text-xs font-semibold text-primary">You · sending</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{pendingText}</p></li>}
        </ol>
        {busy && <p role="status" className="mx-auto mt-6 max-w-3xl text-sm text-slate-500">Waiting for a reply…</p>}
        {!busy && latest && runLabels[latest.status] && <p role="status" className="mx-auto mt-6 max-w-3xl rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{runLabels[latest.status]}</p>}
        {!busy && latest?.status === "completed" && <p className="mx-auto mt-5 flex max-w-3xl items-center gap-1.5 text-xs text-slate-400"><CheckCircle2 size={13} aria-hidden />Latest reply saved</p>}
      </div>
      <footer className="sticky bottom-0 border-t border-border bg-background px-6 py-5 md:px-10">
        <form ref={form} onSubmit={send} className="mx-auto max-w-3xl space-y-3">
          {error && <p role="alert" className="text-sm leading-6 text-red-700">{error}</p>}
          <label htmlFor="chat-message" className="sr-only">Your message</label>
          <div className="flex items-end gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm focus-within:border-primary">
            <textarea id="chat-message" value={content} onChange={event => setContent(event.target.value)} maxLength={4000} rows={3} placeholder="What would you like to work on?" disabled={disabled}
              aria-describedby="chat-keyboard-hint"
              onKeyDown={event => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                  event.preventDefault();
                  if (!event.repeat && !disabled && content.trim()) form.current?.requestSubmit();
                }
              }}
              className="min-w-0 flex-1 resize-y border-0 bg-transparent px-1 py-1 text-sm leading-6 outline-none disabled:opacity-50" />
            <Button type="submit" size="icon" aria-label="Send message" disabled={disabled || !content.trim()}><ArrowUp size={18} aria-hidden /></Button>
          </div>
          <p id="chat-keyboard-hint" className="text-center text-xs leading-5 text-slate-500">Enter to send · Shift+Enter for a new line. Conversations are saved.</p>
        </form>
      </footer>
    </section>
  </main>;
}
