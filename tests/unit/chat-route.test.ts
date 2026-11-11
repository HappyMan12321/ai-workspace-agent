import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
const mocks=vi.hoisted(()=>({createClient:vi.fn(),getUser:vi.fn(),rpc:vi.fn(),from:vi.fn(),generateReply:vi.fn(),readModelConfig:vi.fn(),providerErrorCode:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.createClient}));
vi.mock("@/lib/chat/model",()=>({generateReply:mocks.generateReply,readModelConfig:mocks.readModelConfig,providerErrorCode:mocks.providerErrorCode}));
import { POST } from "@/app/api/chat/route";
const ids={conversationId:randomUUID(),requestId:randomUUID()};
const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),in:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),limit:vi.fn().mockReturnThis(),abortSignal:vi.fn()};
function request(body:unknown={...ids,content:"Plan my demo"},origin="http://localhost:3000"){
 return new Request("http://localhost:3000/api/chat",{method:"POST",headers:{"Content-Type":"application/json",origin},body:JSON.stringify(body)});
}
beforeEach(()=>{
 vi.clearAllMocks();
 vi.stubEnv("APP_URL","http://localhost:3000");
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://example.supabase.co");
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","sb_publishable_example_configuration_only");
 mocks.createClient.mockResolvedValue({auth:{getUser:mocks.getUser},rpc:mocks.rpc,from:mocks.from});
 mocks.getUser.mockResolvedValue({data:{user:{id:"verified-owner"}},error:null});
 mocks.readModelConfig.mockReturnValue({success:true});
 mocks.rpc.mockImplementation((name:string)=>({abortSignal:vi.fn().mockResolvedValue({data:name==="start_chat_turn"?{run_id:"run-1",status:"running",should_execute:true}:{run_id:"run-1",status:"completed"},error:null})}));
 mocks.from.mockReturnValue(query);
 query.abortSignal.mockResolvedValue({data:[{id:"message-1",role:"user",content:"Plan my demo",created_at:"2026-11-10T00:00:00Z"}],error:null});
 mocks.generateReply.mockResolvedValue({content:"A saved reply",status:"completed",inputTokens:100,outputTokens:20});
 mocks.providerErrorCode.mockReturnValue("provider_timeout");
});
afterEach(()=>vi.unstubAllEnvs());
it("rejects cross-site requests before reading credentials",async()=>{
 expect((await POST(request(undefined,"https://attacker.example"))).status).toBe(403);
 expect(mocks.getUser).not.toHaveBeenCalled();expect(mocks.generateReply).not.toHaveBeenCalled();
});
it("rejects forged fields and oversized bodies before authenticating",async()=>{
 expect((await POST(request({...ids,content:"Hi",userId:"forged",model:"expensive"}))).status).toBe(400);
 expect((await POST(request({...ids,content:"x".repeat(17000)}))).status).toBe(413);
 expect(mocks.getUser).not.toHaveBeenCalled();
});
it("rejects an invalid verified session without writing or billing",async()=>{
 mocks.getUser.mockResolvedValue({data:{user:null},error:{message:"invalid"}});
 expect((await POST(request())).status).toBe(401);
 expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.generateReply).not.toHaveBeenCalled();
});
it("does not save or call a model when its server key is missing",async()=>{
 mocks.readModelConfig.mockReturnValue({success:false});
 expect((await POST(request())).status).toBe(503);
 expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.generateReply).not.toHaveBeenCalled();
});
it("replays an existing turn without calling the model again",async()=>{
 mocks.rpc.mockReturnValue({abortSignal:vi.fn().mockResolvedValue({data:{run_id:"old-run",status:"completed",should_execute:false},error:null})});
 const response=await POST(request());
 expect(await response.json()).toMatchObject({replay:true,status:"completed"});
 expect(mocks.generateReply).not.toHaveBeenCalled();
});
it("respects durable rate limits before model execution",async()=>{
 mocks.rpc.mockReturnValue({abortSignal:vi.fn().mockResolvedValue({data:null,error:{message:"chat_daily_limit",code:"P0001"}})});
 expect((await POST(request())).status).toBe(429);expect(mocks.generateReply).not.toHaveBeenCalled();
});
it("uses only persisted owned history and saves the actual result",async()=>{
 const response=await POST(request());
 expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");
 expect(query.eq).toHaveBeenCalledWith("user_id","verified-owner");
 expect(mocks.generateReply).toHaveBeenCalledWith([{role:"user",content:"Plan my demo"}]);
 expect(mocks.rpc).toHaveBeenCalledWith("finish_chat_turn",expect.objectContaining({p_run_id:"run-1",p_content:"A saved reply",p_status:"completed",p_input_tokens:100}));
});
it("records safe timeout failure without leaking upstream details",async()=>{
 mocks.generateReply.mockRejectedValue(new Error("secret-key-and-private-prompt"));
 const response=await POST(request());
 expect(response.status).toBe(504);expect(await response.text()).not.toContain("secret-key-and-private-prompt");
 expect(mocks.rpc).toHaveBeenCalledWith("finish_chat_turn",expect.objectContaining({p_content:null,p_status:"failed",p_error_code:"provider_timeout"}));
});
it("does not call the model if persisted history cannot be read",async()=>{
 query.abortSignal.mockResolvedValue({data:null,error:{message:"database issue"}});
 expect((await POST(request())).status).toBe(502);expect(mocks.generateReply).not.toHaveBeenCalled();
});
it("reports persistence failure rather than claiming a saved assistant reply",async()=>{
 mocks.rpc.mockImplementation((name:string)=>({abortSignal:vi.fn().mockResolvedValue(name==="start_chat_turn"?{data:{run_id:"run-1",status:"running",should_execute:true},error:null}:{data:null,error:{message:"database issue"}})}));
 const response=await POST(request());
 expect(response.status).toBe(502);expect((await response.json()).message).toContain("could not be saved");
});
