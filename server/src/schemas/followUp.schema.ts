import { z } from 'zod';

export const createFollowUpSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  oneOnOneId: z.string().optional().nullable(),
});

export const updateFollowUpSchema = z.object({
  content: z.string().trim().min(1).max(2000).optional(),
  status: z.enum(['open', 'resolved']).optional(),
  // 1:1 in which it was resolved (set together with status: resolved).
  resolvedInOneOnOneId: z.string().optional().nullable(),
});

export const listFollowUpsQuerySchema = z.object({
  status: z.enum(['open', 'resolved']).optional(),
});

export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>;
