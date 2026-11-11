import { z } from "zod";

export const chatRequestSchema = z.object({
  conversationId: z.uuid(),
  requestId: z.uuid(),
  content: z.string().trim().min(1).max(4000),
}).strict();
export const chatMessageSchema = z.object({
  id: z.string(), role: z.enum(["user", "assistant"]), content: z.string(), created_at: z.string(),
});
export const conversationSchema = z.object({ id: z.string(), title: z.string(), updated_at: z.string() });
export const chatRunSchema = z.object({ id: z.string(), status: z.string(), error_code: z.string().nullable(), created_at: z.string() });
export const claimSchema = z.object({ run_id: z.string(), status: z.string(), should_execute: z.boolean() });
export const finishSchema = z.object({ run_id: z.string(), status: z.string() });
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type ChatRun = z.infer<typeof chatRunSchema>;
