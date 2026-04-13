import { z } from 'zod';

export const upsertPersonSkillSchema = z.object({
  resourceId: z.string().min(1),
  skillId: z.string().min(1),
  level: z.number().int().min(1).max(5),
  note: z.string().trim().max(500).optional().nullable(),
});

export const updatePersonSkillSchema = z.object({
  level: z.number().int().min(1).max(5).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

export type UpsertPersonSkillInput = z.infer<typeof upsertPersonSkillSchema>;
export type UpdatePersonSkillInput = z.infer<typeof updatePersonSkillSchema>;
