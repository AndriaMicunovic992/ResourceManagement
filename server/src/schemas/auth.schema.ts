import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email(),
  // At least 8 chars; capped so an over-long value can't be used to burn CPU in
  // bcrypt (which only uses the first 72 bytes anyway).
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(100),
  orgName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const impersonateSchema = z.object({
  userId: z.string().min(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
