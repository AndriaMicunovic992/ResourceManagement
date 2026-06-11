import { z } from 'zod';

export const createCareerEntrySchema = z.object({
  content: z.string().trim().min(1).max(5000),
  kind: z.enum(['note', 'goal']).default('note'),
  goalStatus: z.enum(['active', 'achieved', 'dropped']).optional().nullable(),
  oneOnOneId: z.string().optional().nullable(),
});

export const updateCareerEntrySchema = z.object({
  content: z.string().trim().min(1).max(5000).optional(),
  goalStatus: z.enum(['active', 'achieved', 'dropped']).optional().nullable(),
});

export type CreateCareerEntryInput = z.infer<typeof createCareerEntrySchema>;
export type UpdateCareerEntryInput = z.infer<typeof updateCareerEntrySchema>;
