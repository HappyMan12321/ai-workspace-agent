import { appOrigin } from "@/lib/auth/origin";

export class BodyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function sameOrigin(request: Request) {
  try { return request.headers.get("origin") === appOrigin(); } catch { return false; }
}
export async function readChatBody(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new BodyError(415, "Use a JSON request.");
  }
  if (!request.body) throw new BodyError(400, "A message is required.");
  const reader = request.body.getReader();
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 16384) {
        await reader.cancel();
        throw new BodyError(413, "The message request is too large.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new BodyError(400, "The message request is invalid."); }
}
