import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseEnv } from "@/lib/env";

// Every protected page and mutation checks Auth independently of the proxy.
export async function requireUser() {
  if (!readSupabaseEnv().success) redirect("/login?notice=setup");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login?notice=session");
  return { supabase, user: data.user };
}
