import { z } from 'zod';
import { monthKey, monthAllocations } from './common.js';

export const upsertAssignmentSchema = z.object({
  needId: z.string().min(1),
  resourceId: z.string().min(1),
  month: monthKey.optional(),
  months: z.array(monthKey).optional(),
  fte: z.number().min(0).max(2.0).optional(),
  monthAllocations: monthAllocations.optional(),
});

export const updateAssignmentSchema = z.object({
  monthAllocations,
});

export type UpsertAssignmentInput = z.infer<typeof upsertAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
