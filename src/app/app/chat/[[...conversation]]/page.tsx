import { connection } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { readModelConfig } from "@/lib/chat/model";
import { loadChat } from "@/lib/chat/data";
import { ChatWorkspace } from "@/components/chat/workspace";

export default async function ChatPage({ params }: { params: Promise<{ conversation?: string[] }> }) {
  await connection();
  const { supabase, user } = await requireUser();
  const { conversation } = await params;
  const id = conversation?.[0];
  if ((conversation && conversation.length !== 1) || (id && !z.uuid().safeParse(id).success)) notFound();
  let data: Awaited<ReturnType<typeof loadChat>>;
  let loadFailed = false;
  try { data = await loadChat(supabase, user.id, id); }
  catch { data = { conversations: [], messages: [], runs: [], found: true }; loadFailed = true; }
  if (!data.found) notFound();
  return <ChatWorkspace key={id ?? "new"} conversationId={id} {...data} configured={readModelConfig().success} loadFailed={loadFailed} />;
}
