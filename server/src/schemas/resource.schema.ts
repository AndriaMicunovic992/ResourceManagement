import { z } from 'zod';
import { monthKey } from './common.js';

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

// Planned absences, entered in the planner as days off per month. The payload
// is a per-month delta that gets MERGED into the stored map (like assignment
// monthAllocations): 0 clears a month, so two planners editing different
// months can't clobber each other. Halves are allowed; 31 is a generous cap
// (a full working month is ~22 days).
export const setAbsencesSchema = z.object({
  months: z
    .record(monthKey, z.number().min(0).max(31))
    .refine((m) => Object.keys(m).length > 0, 'At least one month is required'),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
export type SetAbsencesInput = z.infer<typeof setAbsencesSchema>;
