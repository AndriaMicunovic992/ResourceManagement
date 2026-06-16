import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().nullable().optional(),
  managerUserId: z.string().nullable().optional(),
});

export const updateTeamSchema = createTeamSchema.partial();

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
