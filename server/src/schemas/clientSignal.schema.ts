import { z } from 'zod';

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Expected "YYYY-MM"');

export const upsertClientSignalSchema = z.object({
  resourceId: z.string().min(1),
  month: monthSchema,
  rating: z.number().int().min(1).max(5),
  note: z.string().trim().max(2000).optional().nullable(),
});

export const listClientSignalsQuerySchema = z.object({
  from: monthSchema.optional(),
  to: monthSchema.optional(),
});

export type UpsertClientSignalInput = z.infer<typeof upsertClientSignalSchema>;
export type ListClientSignalsQuery = z.infer<typeof listClientSignalsQuerySchema>;
