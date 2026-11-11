"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmEmail } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import type { AuthState, ConfirmationInput } from "@/lib/auth/validation";

export function ConfirmForm({ confirmation, configured }: { confirmation: ConfirmationInput; configured: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(confirmEmail, {});
  return <form action={action} className="space-y-5">
    {Object.entries(confirmation).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
    {"code" in confirmation && <p className="text-sm leading-6 text-slate-600">Use the same browser where you requested this email so your account can be verified securely.</p>}
    {!configured && <p role="alert" className="text-sm text-amber-900">Supabase is not configured. <Link href="/" className="underline">Open setup</Link>.</p>}
    {state.message && <p role="alert" className="text-sm text-red-700">{state.message}</p>}
    <Button type="submit" className="w-full" disabled={pending || !configured}>{pending ? "Confirming…" : "Continue securely"}</Button>
  </form>;
}
