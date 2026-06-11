import { z } from 'zod';

export const createOneOnOneSchema = z.object({
  meetingDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  // 1-5 manager pulse — distinct from formal evaluation scores.
  overallScore: z.number().int().min(1).max(5).optional().nullable(),
  // 1-5 employee-reported work satisfaction.
  workSatisfaction: z.number().int().min(1).max(5).optional().nullable(),
  wentWell: z.string().max(10000).optional().nullable(),
  wentBad: z.string().max(10000).optional().nullable(),
  privateNote: z.string().max(5000).optional().nullable(),
});

export const updateOneOnOneSchema = createOneOnOneSchema.partial();

export type CreateOneOnOneInput = z.infer<typeof createOneOnOneSchema>;
export type UpdateOneOnOneInput = z.infer<typeof updateOneOnOneSchema>;
