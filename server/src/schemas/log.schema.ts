import { z } from 'zod';

// Entry types: polarity is inherent in the type (no good/bad labels).
//   strength        — what the person did well, with context
//   concern         — what fell short of expectations
//   incident        — dated hard fact (missed deadline, quality failure, conflict)
//   blocker         — outside their control, slowing them down (fairness context)
//   note            — neutral, fits nowhere else
//   project_checkin — per-project box filled during a 1:1; surfaces on the
//                     customer page for admins + that project's responsible
export const LOG_KINDS = [
  'strength',
  'concern',
  'incident',
  'blocker',
  'note',
  'project_checkin',
] as const;

// Kinds an employee may use on their own journal. Self-vs-observer separation
// is authorship-based now that kinds are shared (see log.service.ts).
export const EMPLOYEE_LOG_KINDS = ['strength', 'concern', 'blocker', 'note'] as const;

const kindSchema = z.enum(LOG_KINDS);

export const createLogSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  kind: kindSchema,
  // Multiple dimensions per entry (an incident can span several).
  categoryIds: z.array(z.string()).max(20).optional(),
  customerId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  jiraUrl: z.string().url().max(500).optional().nullable(),
  oneOnOneId: z.string().optional().nullable(),
  customerReviewId: z.string().optional().nullable(),
});

export const updateLogSchema = z.object({
  content: z.string().trim().min(1).max(5000).optional(),
  kind: kindSchema.optional(),
  categoryIds: z.array(z.string()).max(20).optional(),
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
  customerReviewId: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const createLogCommentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export type CreateLogInput = z.infer<typeof createLogSchema>;
export type UpdateLogInput = z.infer<typeof updateLogSchema>;
export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>;
