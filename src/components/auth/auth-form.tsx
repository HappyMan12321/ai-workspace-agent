"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, requestPasswordReset, updatePassword } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import type { AuthState } from "@/lib/auth/validation";

const actions = { login: signIn, signup: signUp, forgot: requestPasswordReset, reset: updatePassword };
const labels = { login: "Sign in", signup: "Create account", forgot: "Send reset email", reset: "Save new password" };
export function AuthForm({ kind, configured }: { kind: keyof typeof actions; configured: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(actions[kind], {});
  const field = (name: string, label: string, type: string, autoComplete: string, minLength?: number) => <div className="space-y-2">
    <label htmlFor={name} className="block text-sm font-medium">{label}</label>
    <input id={name} name={name} type={type} autoComplete={autoComplete} required
      minLength={minLength} maxLength={name === "displayName" ? 80 : type === "email" ? 254 : 128}
      aria-invalid={Boolean(state.errors?.[name])} aria-describedby={state.errors?.[name] ? `${name}-error` : undefined}
      className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
    {state.errors?.[name] && <p id={`${name}-error`} className="text-sm text-red-700">{state.errors[name]?.join(" ")}</p>}
  </div>;
  return <form action={action} className="space-y-5">
    {!configured && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Accounts need Supabase configuration. <Link className="underline" href="/">Open setup instructions</Link>.</p>}
    {kind === "signup" && field("displayName", "Your name", "text", "name")}
    {kind !== "reset" && field("email", "Email address", "email", "email")}
    {kind !== "forgot" && field("password", kind === "reset" ? "New password" : "Password", "password", kind === "login" ? "current-password" : "new-password", kind === "login" ? 1 : 12)}
    {(kind === "signup" || kind === "reset") && <>
      {field("confirmPassword", "Confirm password", "password", "new-password", 12)}
      <p className="text-xs text-slate-500">Use 12–128 characters. A long, unique passphrase works well.</p>
    </>}
    {state.message && <p role={state.success ? "status" : "alert"} className={`rounded-lg p-3 text-sm ${state.success ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800"}`}>{state.message}</p>}
    <Button type="submit" disabled={pending || !configured} className="w-full">{pending ? "Please wait…" : labels[kind]}</Button>
    {kind === "login" && <div className="flex flex-wrap justify-between gap-3 text-sm text-primary"><Link href="/forgot-password" className="underline underline-offset-4">Forgot password?</Link><Link href="/signup" className="underline underline-offset-4">Create account</Link></div>}
    {(kind === "signup" || kind === "forgot") && <p className="text-center text-sm text-slate-600"><Link href="/login" className="text-primary underline underline-offset-4">Back to sign in</Link></p>}
  </form>;
}
