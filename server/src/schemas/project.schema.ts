import { z } from 'zod';
import { monthKey } from './common.js';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  customerId: z.string().min(1),
  startMonth: monthKey.optional(),
  endMonth: monthKey.optional(),
  status: z.enum(['realised', 'potential']).default('realised'),
  responsibleUserId: z.string().nullable().optional(),
});

export const updateProjectSchema = createProjectSchema.partial().omit({ customerId: true });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
