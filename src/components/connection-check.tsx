"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ConnectionCheck() {
  const [message, setMessage] = useState("Connection has not been checked.");
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    try {
      const response = await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(8000) });
      const body = await response.json();
      setMessage(body.status === "ok"
        ? "Supabase Auth is reachable. Database and storage checks arrive in later phases."
        : body.status === "not_configured"
          ? "Add your Supabase URL and publishable key, then restart the app."
          : "Supabase could not be reached. Check your project URL, key, and network.");
    } catch {
      setMessage("The connection check could not finish. Try again.");
    } finally { setBusy(false); }
  }
  return <div className="space-y-3">
    <Button onClick={check} disabled={busy}>{busy ? "Checking…" : "Check connection"}</Button>
    <p role="status" aria-live="polite" className="text-sm text-slate-600">{message}</p>
  </div>;
}
