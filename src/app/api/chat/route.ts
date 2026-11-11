import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseEnv } from "@/lib/env";
import { chatRequestSchema, chatMessageSchema, claimSchema, finishSchema } from "@/lib/chat/schemas";
import { generateReply, providerErrorCode, readModelConfig } from "@/lib/chat/model";
import { modelHistory } from "@/lib/chat/history";
import { BodyError, readChatBody, sameOrigin } from "@/lib/chat/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
function json(body: object, status = 200) { return NextResponse.json(body, { status, headers }); }

export async function POST(request: Request) {
  try { return await handleChat(request); }
  catch { return json({ error: "chat_unavailable", message: "Chat is temporarily unavailable. Refresh to check any saved request before retrying." }, 503); }
}

async function handleChat(request: Request) {
  if (!sameOrigin(request)) return json({ error: "origin_rejected", message: "This request cannot be accepted." }, 403);
  let input;
  try {
    const parsed = chatRequestSchema.safeParse(await readChatBody(request));
    if (!parsed.success) return json({ error: "invalid_message", message: "Enter a message of 1–4,000 characters." }, 400);
    input = parsed.data;
  } catch (error) {
    if (error instanceof BodyError) return json({ error: "invalid_request", message: error.message }, error.status);
    return json({ error: "invalid_request", message: "The message request could not be read." }, 400);
  }
  if (!readSupabaseEnv().success) return json({ error: "not_configured", message: "Chat setup is not complete." }, 503);
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return json({ error: "unauthorized", message: "Sign in to continue." }, 401);
  if (!readModelConfig().success) return json({ error: "model_not_configured", message: "Chat is waiting for workspace setup." }, 503);

  const claim = await supabase.rpc("start_chat_turn", {
    p_conversation_id: input.conversationId, p_request_id: input.requestId, p_content: input.content,
  }).abortSignal(AbortSignal.timeout(5000));
  if (claim.error) {
    const code = claim.error.message;
    if (code === "chat_busy") return json({ error: code, message: "A reply is already in progress. Refresh before sending again." }, 409);
    if (code === "chat_rate_limited" || code === "chat_daily_limit") return json({ error: code, message: "Your chat limit has been reached. Please try later." }, 429);
    if (code === "request_conflict") return json({ error: code, message: "This request identifier was already used for another message." }, 409);
    if (claim.error.code === "42501") return json({ error: "not_found", message: "This conversation is unavailable." }, 404);
    return json({ error: "storage_unavailable", message: "The message could not be saved. Refresh before retrying." }, 503);
  }
  const parsedClaim = claimSchema.safeParse(claim.data);
  if (!parsedClaim.success) return json({ error: "storage_unavailable", message: "The run could not be confirmed. Refresh for its saved status." }, 503);
  const run = parsedClaim.data;
  if (!run.should_execute) return json({ conversationId: input.conversationId, runId: run.run_id, status: run.status, replay: true });

  async function finish(content: string | null, status: string, errorCode: string | null, inputTokens = 0, outputTokens = 0) {
    const result = await supabase.rpc("finish_chat_turn", {
      p_run_id: run.run_id, p_content: content, p_status: status, p_error_code: errorCode,
      p_input_tokens: inputTokens, p_output_tokens: outputTokens,
    }).abortSignal(AbortSignal.timeout(5000));
    if (result.error) throw new Error("save_failed");
    return finishSchema.parse(result.data).status;
  }
  let failureCode = "provider_unavailable";
  try {
    const history = await supabase.from("messages").select("id,role,content,created_at")
      .eq("user_id", auth.user.id).eq("conversation_id", input.conversationId).in("role", ["user", "assistant"])
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(12)
      .abortSignal(AbortSignal.timeout(5000));
    if (history.error) { failureCode = "history_unavailable"; throw new Error("history_unavailable"); }
    const messages = z.array(chatMessageSchema).parse(history.data).reverse();
    let reply;
    try { reply = await generateReply(modelHistory(messages)); }
    catch (error) { failureCode = providerErrorCode(error); throw error; }
    if (!reply.content) { failureCode = "empty_response"; throw new Error("empty_response"); }
    failureCode = "save_failed";
    const status = await finish(reply.content, reply.status, reply.status === "partial_failure" ? "output_limit" : null, reply.inputTokens, reply.outputTokens);
    return json({ conversationId: input.conversationId, runId: run.run_id, status });
  } catch {
    // Persist a safe code only. Never return/log provider errors, prompts or keys.
    let saved = true;
    try { await finish(null, "failed", failureCode); } catch { saved = false; }
    return json({
      error: failureCode,
      message: saved ? "The reply could not finish. Your message is saved; you can send a new request." : "The reply could not be saved. Refresh to check its status before sending again.",
      conversationId: input.conversationId, runId: run.run_id,
    }, failureCode === "provider_timeout" ? 504 : 502);
  }
}
