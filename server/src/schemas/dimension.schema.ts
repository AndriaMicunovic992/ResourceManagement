import { z } from 'zod';

export const createDimensionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code must be alphanumeric (underscore/dash allowed)'),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
});

export const updateDimensionSchema = createDimensionSchema.partial();

export type CreateDimensionInput = z.infer<typeof createDimensionSchema>;
export type UpdateDimensionInput = z.infer<typeof updateDimensionSchema>;
