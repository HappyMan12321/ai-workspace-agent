import { NextResponse } from "next/server";
import { readSupabaseEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  const env = readSupabaseEnv();
  const headers = { "Cache-Control": "no-store" };
  if (!env.success) {
    return NextResponse.json(
      { status: "not_configured", supabase: "missing_or_invalid_configuration" },
      { status: 503, headers },
    );
  }
  try {
    // Read-only Auth settings probe. Does not claim database/RLS/storage readiness.
    const response = await fetch(
      new URL("/auth/v1/settings", env.data.NEXT_PUBLIC_SUPABASE_URL),
      {
        headers: { apikey: env.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error("Supabase rejected the probe");
    return NextResponse.json(
      { status: "ok", supabase: "auth_reachable" },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", supabase: "unreachable_or_invalid_key" },
      { status: 503, headers },
    );
  }
}
