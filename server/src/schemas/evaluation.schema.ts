import { z } from 'zod';

export const EVALUATION_STATES = [
  'draft',
  'employee_submitted',
  'responsible_submitted',
  'finalized',
] as const;

export const createEvaluationSchema = z.object({
  resourceId: z.string().min(1),
  customerId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const batchCreateEvaluationSchema = z.object({
  resourceId: z.string().min(1),
  scopes: z
    .array(
      z.object({
        customerId: z.string().min(1),
        projectId: z.string().nullable().optional(),
      })
    )
    .min(1),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const scoreNumber = z
  .number()
  .min(1)
  .max(5)
  .refine((n) => Math.abs(n * 2 - Math.round(n * 2)) < 1e-9, {
    message: 'Score must be in 0.5 steps',
  });

export const updateScoreSchema = z.object({
  employeeScore: scoreNumber.nullable().optional(),
  employeeComment: z.string().max(5000).nullable().optional(),
  responsibleScore: scoreNumber.nullable().optional(),
  responsibleComment: z.string().max(5000).nullable().optional(),
  managerComment: z.string().max(5000).nullable().optional(),
});

export const finalizeEvaluationSchema = z.object({
  overrideFinal: z.number().min(1).max(5).nullable().optional(),
  overrideReason: z.string().max(2000).nullable().optional(),
});

export const listEvaluationsQuerySchema = z.object({
  resourceId: z.string().optional(),
  state: z.enum(EVALUATION_STATES).optional(),
  customerId: z.string().optional(),
  projectId: z.string().optional(),
});

export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;
export type BatchCreateEvaluationInput = z.infer<typeof batchCreateEvaluationSchema>;
export type UpdateScoreInput = z.infer<typeof updateScoreSchema>;
export type FinalizeEvaluationInput = z.infer<typeof finalizeEvaluationSchema>;
export type ListEvaluationsQuery = z.infer<typeof listEvaluationsQuerySchema>;
