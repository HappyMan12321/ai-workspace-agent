import { z } from "zod";

export const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().refine(
    (value) => value.startsWith("https://"),
    "Use an HTTPS Supabase project URL.",
  ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith("sb_publishable_").min(24),
});

// Explicit property access is required for Next.js to inline browser variables.
export function readSupabaseEnv() {
  return supabaseEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function requireSupabaseEnv() {
  const result = readSupabaseEnv();
  if (!result.success) {
    // Names only: never include environment values or Zod's full input.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path[0]))];
    throw new Error(`Configure ${fields.join(", ")} in .env.local or Vercel.`);
  }
  return result.data;
}
