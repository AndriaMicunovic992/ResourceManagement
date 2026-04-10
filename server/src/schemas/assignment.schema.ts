import { z } from 'zod';

export const upsertAssignmentSchema = z.object({
  needId: z.string().min(1),
  resourceId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  months: z.array(z.string().regex(/^\d{4}-\d{2}$/)).optional(),
  fte: z.number().min(0).max(2.0).optional(),
  monthAllocations: z.record(z.string(), z.number()).optional(),
});

export const updateAssignmentSchema = z.object({
  monthAllocations: z.record(z.string(), z.number()),
});

export type UpsertAssignmentInput = z.infer<typeof upsertAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
