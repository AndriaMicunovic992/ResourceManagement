import { z } from 'zod';

export const createNeedSchema = z.object({
  projectId: z.string().min(1),
  // domain/seniority are the org's editable taxonomy, not a fixed enum.
  domain: z.string().min(1),
  role: z.string().min(1),
  seniority: z.string().min(1),
  label: z.string().optional().nullable(),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  endMonth: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  ftePerMonth: z.number().min(0.01).max(2.0),
  status: z.enum(['realised', 'potential']).default('realised'),
});

export const updateNeedSchema = z.object({
  domain: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  seniority: z.string().min(1).optional(),
  label: z.string().optional().nullable(),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  endMonth: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  ftePerMonth: z.number().min(0.01).max(2.0).optional(),
  status: z.enum(['realised', 'potential']).optional(),
  monthAllocations: z.record(z.string(), z.number()).optional(),
});

export type CreateNeedInput = z.infer<typeof createNeedSchema>;
export type UpdateNeedInput = z.infer<typeof updateNeedSchema>;
