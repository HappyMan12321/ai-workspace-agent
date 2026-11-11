import { z } from "zod";

const email = z.email("Enter a valid email address.").max(254).trim();
const password = z.string().min(12, "Use at least 12 characters.").max(128, "Use at most 128 characters.");
export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password.").max(128) });
export const signupSchema = z.object({
  email, password, confirmPassword: z.string(),
  displayName: z.string().trim().min(1, "Enter your name.").max(80),
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"], message: "Passwords must match.",
});
export const resetRequestSchema = z.object({ email });
export const passwordSchema = z.object({ password, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"], message: "Passwords must match.",
  });
export const profileSchema = z.object({ displayName: z.string().trim().min(1, "Enter your name.").max(80) });
export const confirmationSchema = z.object({
  token_hash: z.string().regex(/^[a-fA-F0-9]{32,256}$/, "This confirmation link is invalid."),
  type: z.enum(["email", "signup", "recovery"]),
});
export const codeConfirmationSchema = z.object({
  code: z.string().min(16).max(2048).regex(/^[a-zA-Z0-9_-]+$/),
  sb_flow_id: z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/).optional(),
});
export type ConfirmationInput = z.infer<typeof confirmationSchema> | z.infer<typeof codeConfirmationSchema>;

export type AuthState = {
  message?: string;
  success?: boolean;
  errors?: Record<string, string[] | undefined>;
};
