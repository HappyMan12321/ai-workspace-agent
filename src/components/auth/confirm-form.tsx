"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmEmail } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import type { AuthState } from "@/lib/auth/validation";

export function ConfirmForm({ tokenHash, type, configured }: { tokenHash: string; type: string; configured: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(confirmEmail, {});
  return <form action={action} className="space-y-5">
    <input type="hidden" name="token_hash" value={tokenHash} />
    <input type="hidden" name="type" value={type} />
    {!configured && <p role="alert" className="text-sm text-amber-900">Supabase is not configured. <Link href="/" className="underline">Open setup</Link>.</p>}
    {state.message && <p role="alert" className="text-sm text-red-700">{state.message}</p>}
    <Button type="submit" className="w-full" disabled={pending || !configured}>{pending ? "Confirming…" : "Continue securely"}</Button>
  </form>;
}
