import { z } from 'zod';

const roleSchema = z.object({
  domain: z.enum(['Data', 'Web', 'General']),
  role: z.string().min(1),
  seniority: z.enum(['Junior', 'Medior', 'Senior', 'Senior Principal']),
});

export const createResourceSchema = z.object({
  name: z.string().min(1).max(100),
  capacity: z.number().min(0.1).max(1.0),
  teamId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  roles: z.array(roleSchema).min(1),
});

export const updateResourceSchema = createResourceSchema.partial();

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
