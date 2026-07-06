import { z } from 'zod';

// domain/role/seniority are validated as free strings — the allowed values are
// the org's editable taxonomy (Domain/JobRole/Seniority), not a fixed enum.
const roleSchema = z.object({
  domain: z.string().min(1),
  role: z.string().min(1),
  seniority: z.string().min(1),
});

export const createResourceSchema = z.object({
  name: z.string().min(1).max(100),
  capacity: z.number().min(0.1).max(1.0),
  teamIds: z.array(z.string()).optional(),
  directManagerUserIds: z.array(z.string()).optional(),
  userId: z.string().nullable().optional(),
  // Identifier in the external actual-hours system (e.g. Jira accountId).
  externalWorkId: z.string().max(200).nullable().optional(),
  roles: z.array(roleSchema).min(1),
});

export const updateResourceSchema = createResourceSchema.partial().extend({
  // Offboarding toggle — archived people keep their history but leave the
  // active roster and the planner pool.
  archived: z.boolean().optional(),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
