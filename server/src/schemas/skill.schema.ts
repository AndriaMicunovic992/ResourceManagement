import { z } from 'zod';

export const createSkillSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().max(50).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
});

export const updateSkillSchema = createSkillSchema.partial();

export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;
