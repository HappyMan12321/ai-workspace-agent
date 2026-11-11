"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import type { AuthState } from "@/lib/auth/validation";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(updateProfile, {});
  return <form action={action} className="space-y-4">
    <label htmlFor="displayName" className="block text-sm font-medium">Your name</label>
    <input id="displayName" name="displayName" defaultValue={displayName} autoComplete="name" maxLength={80} required
      className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
    {state.errors?.displayName && <p role="alert" className="text-sm text-red-700">{state.errors.displayName.join(" ")}</p>}
    {state.message && <p role={state.success ? "status" : "alert"} className={`text-sm ${state.success ? "text-primary" : "text-red-700"}`}>{state.message}</p>}
    <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save name"}</Button>
  </form>;
}
