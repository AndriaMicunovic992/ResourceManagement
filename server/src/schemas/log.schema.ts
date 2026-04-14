import { z } from 'zod';

export const LOG_KINDS = [
  'good',
  'bad',
  'incident',
  'observation',
  'win',
  'down',
  'blocker',
] as const;

export const EMPLOYEE_LOG_KINDS = ['win', 'down', 'blocker'] as const;
export const OBSERVER_LOG_KINDS = ['good', 'bad', 'incident', 'observation'] as const;

const kindSchema = z.enum(LOG_KINDS);

export const createLogSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  kind: kindSchema,
  categoryId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  jiraUrl: z.string().url().max(500).optional().nullable(),
  oneOnOneId: z.string().optional().nullable(),
});

export const updateLogSchema = z.object({
  content: z.string().trim().min(1).max(5000).optional(),
  kind: kindSchema.optional(),
  categoryId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  jiraUrl: z.string().url().max(500).optional().nullable(),
});

export const listLogsQuerySchema = z.object({
  kind: kindSchema.optional(),
  categoryId: z.string().optional(),
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
