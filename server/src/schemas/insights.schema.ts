import { z } from 'zod';

export const insightsFilterQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  teamId: z.string().optional(),
  domain: z.string().optional(),
  role: z.string().optional(),
  seniority: z.string().optional(),
});

export const insightsTrendQuerySchema = insightsFilterQuerySchema.extend({
  bucket: z.enum(['month', 'quarter']).optional(),
});

export type InsightsFilterQuery = z.infer<typeof insightsFilterQuerySchema>;
export type InsightsTrendQuery = z.infer<typeof insightsTrendQuerySchema>;
