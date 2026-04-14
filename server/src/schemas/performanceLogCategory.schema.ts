import { z } from 'zod';

export const createPerformanceLogCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  grouping: z.string().trim().max(100).optional().nullable(),
});

export const updatePerformanceLogCategorySchema = createPerformanceLogCategorySchema.partial();

export type CreatePerformanceLogCategoryInput = z.infer<typeof createPerformanceLogCategorySchema>;
export type UpdatePerformanceLogCategoryInput = z.infer<typeof updatePerformanceLogCategorySchema>;
