import { z } from 'zod';

const kindSchema = z.enum(['good', 'bad', 'suggestion', 'observation']);
const dimensionCodeSchema = z.enum(['D1', 'D2', 'D3', 'D4', 'D5', 'D6']);

export const createLogSchema = z
  .object({
    content: z.string().trim().min(1).max(5000),
    kind: kindSchema,
    dimensionCode: dimensionCodeSchema.optional().nullable(),
    customerId: z.string().optional().nullable(),
    projectId: z.string().optional().nullable(),
    jiraUrl: z.string().url().max(500).optional().nullable(),
    oneOnOneId: z.string().optional().nullable(),
  })
  .refine((data) => !data.oneOnOneId || data.kind !== 'observation', {
    message: '1:1 logs must have kind good, bad, or suggestion',
  });

export const updateLogSchema = z.object({
  content: z.string().trim().min(1).max(5000).optional(),
  kind: kindSchema.optional(),
  dimensionCode: dimensionCodeSchema.optional().nullable(),
  customerId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  jiraUrl: z.string().url().max(500).optional().nullable(),
});

export const listLogsQuerySchema = z.object({
  kind: kindSchema.optional(),
  dimensionCode: dimensionCodeSchema.optional(),
  customerId: z.string().optional(),
  projectId: z.string().optional(),
  oneOnOneId: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export type CreateLogInput = z.infer<typeof createLogSchema>;
export type UpdateLogInput = z.infer<typeof updateLogSchema>;
export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>;
