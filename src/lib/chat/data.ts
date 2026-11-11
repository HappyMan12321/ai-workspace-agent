import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { chatMessageSchema, chatRunSchema, conversationSchema } from "@/lib/chat/schemas";

export async function loadChat(supabase: SupabaseClient, userId: string, conversationId?: string) {
  const expiration = await supabase.rpc("expire_chat_runs").abortSignal(AbortSignal.timeout(5000));
  if (expiration.error) throw new Error("chat_schema_unavailable");
  const { data: conversations, error: listError } = await supabase.from("conversations")
    .select("id,title,updated_at").eq("user_id", userId).order("updated_at", { ascending: false })
    .limit(30).abortSignal(AbortSignal.timeout(5000));
  if (listError) throw new Error("conversation_list_unavailable");
  if (!conversationId) return { conversations: z.array(conversationSchema).parse(conversations), messages: [], runs: [], found: true };
  const [selected, messages, runs] = await Promise.all([
    supabase.from("conversations").select("id,title,updated_at").eq("user_id", userId).eq("id", conversationId).abortSignal(AbortSignal.timeout(5000)).maybeSingle(),
    supabase.from("messages").select("id,role,content,created_at").eq("user_id", userId).eq("conversation_id", conversationId)
      .in("role", ["user", "assistant"]).order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(30).abortSignal(AbortSignal.timeout(5000)),
    supabase.from("agent_runs").select("id,status,error_code,created_at").eq("user_id", userId).eq("conversation_id", conversationId)
      .eq("run_kind", "chat").order("created_at", { ascending: false }).limit(5).abortSignal(AbortSignal.timeout(5000)),
  ]);
  if (selected.error || messages.error || runs.error) throw new Error("conversation_unavailable");
  const list = z.array(conversationSchema).parse(conversations);
  if (selected.data && !list.some(item => item.id === conversationId)) list.unshift(conversationSchema.parse(selected.data));
  return {
    conversations: list,
    messages: z.array(chatMessageSchema).parse(messages.data).reverse(),
    runs: z.array(chatRunSchema).parse(runs.data),
    found: Boolean(selected.data),
  };
}
