import { z } from 'zod';

export const LOG_KINDS = [
  'good',
  'bad',
  'suggestion',
  'observation',
  'win',
  'down',
  'blocker',
] as const;

export const EMPLOYEE_LOG_KINDS = ['win', 'down', 'blocker'] as const;
export const ONE_ON_ONE_LOG_KINDS = ['good', 'bad', 'suggestion'] as const;

const kindSchema = z.enum(LOG_KINDS);
const dimensionCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[A-Za-z0-9_-]+$/);

const isOneOnOneKind = (k: string): boolean =>
  (ONE_ON_ONE_LOG_KINDS as readonly string[]).includes(k);

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
  .refine((data) => !data.oneOnOneId || isOneOnOneKind(data.kind), {
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
