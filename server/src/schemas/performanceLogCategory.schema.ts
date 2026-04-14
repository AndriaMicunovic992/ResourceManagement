import { z } from 'zod';

export const createPerformanceLogCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  grouping: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  weight: z.number().min(0).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const updatePerformanceLogCategorySchema = createPerformanceLogCategorySchema.partial();

export type CreatePerformanceLogCategoryInput = z.infer<typeof createPerformanceLogCategorySchema>;
export type UpdatePerformanceLogCategoryInput = z.infer<typeof updatePerformanceLogCategorySchema>;
