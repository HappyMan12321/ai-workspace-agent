import type { ChatMessage } from "@/lib/chat/schemas";

// Whole recent messages only. Never accept a browser-supplied system prompt/history.
export function modelHistory(messages: Pick<ChatMessage, "role" | "content">[]) {
  const result: { role: "user" | "assistant"; content: string }[] = [];
  let remaining = 12000;
  for (const message of messages.slice(-12).reverse()) {
    if (message.content.length > remaining) break;
    result.unshift({ role: message.role, content: message.content });
    remaining -= message.content.length;
  }
  return result;
}
