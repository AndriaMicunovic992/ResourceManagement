import { z } from 'zod';

export const customerDetailQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const customerTrendQuerySchema = customerDetailQuerySchema.extend({
  bucket: z.enum(['month', 'quarter']).optional(),
});

export type CustomerDetailQuery = z.infer<typeof customerDetailQuerySchema>;
export type CustomerTrendQuery = z.infer<typeof customerTrendQuerySchema>;
