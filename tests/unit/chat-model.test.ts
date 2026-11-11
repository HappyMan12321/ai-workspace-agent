import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({options:vi.fn(),create:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("openai",()=>({default:class OpenAI {
 static APIConnectionTimeoutError=class extends Error {};
 static APIError=class extends Error {};
 responses={create:mocks.create};
 constructor(options:unknown){mocks.options(options);}
}}));
import { generateReply,readModelConfig } from "@/lib/chat/model";
import { modelHistory } from "@/lib/chat/history";
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv("OPENAI_API_KEY","sk-example_test_only_configuration");vi.stubEnv("OPENAI_MODEL","gpt-6-luna");
 mocks.create.mockResolvedValue({output_text:"A concise answer",status:"completed",usage:{input_tokens:100,output_tokens:20}});
});
afterEach(()=>vi.unstubAllEnvs());
it("uses bounded stateless requests and disables automatic provider retries",async()=>{
 await generateReply([{role:"user",content:"Hello"}]);
 expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({timeout:20000,maxRetries:0}));
 expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({model:"gpt-6-luna",store:false,max_output_tokens:800,reasoning:{effort:"none"}}));
 expect(mocks.create.mock.calls[0][0]).not.toHaveProperty("tools");
});
it("marks incomplete output explicitly",async()=>{
 mocks.create.mockResolvedValue({output_text:"Partial",status:"incomplete"});
 expect((await generateReply([{role:"user",content:"Hi"}])).status).toBe("partial_failure");
});
it("rejects missing keys and unexpected models without a provider call",async()=>{
 vi.stubEnv("OPENAI_API_KEY","");expect(readModelConfig().success).toBe(false);
 await expect(generateReply([])).rejects.toThrow("model_not_configured");
 vi.stubEnv("OPENAI_API_KEY","sk-example_test_only_configuration");vi.stubEnv("OPENAI_MODEL","unexpected-expensive-model");
 expect(readModelConfig().success).toBe(false);expect(mocks.create).not.toHaveBeenCalled();
});
it("bounds model history by both count and character budget",()=>{
 const history=Array.from({length:20},(_,i)=>({role:"user" as const,content:`${i}:`+"x".repeat(1997)}));
 const selected=modelHistory(history);
 expect(selected.length).toBeLessThanOrEqual(12);
 expect(selected.reduce((sum,item)=>sum+item.content.length,0)).toBeLessThanOrEqual(12000);
 expect(selected.at(-1)?.content).toBe(history.at(-1)?.content);
});
