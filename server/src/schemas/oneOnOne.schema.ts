import { z } from 'zod';

export const createOneOnOneSchema = z.object({
  meetingDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  generalStatus: z.string().max(5000).optional().nullable(),
  personalNotes: z.string().max(5000).optional().nullable(),
  careerDevelopment: z.string().max(5000).optional().nullable(),
  managerPersonalNotes: z.string().max(5000).optional().nullable(),
  privateNote: z.string().max(5000).optional().nullable(),
});

export const updateOneOnOneSchema = createOneOnOneSchema.partial();

export type CreateOneOnOneInput = z.infer<typeof createOneOnOneSchema>;
export type UpdateOneOnOneInput = z.infer<typeof updateOneOnOneSchema>;
