import { z } from 'zod';

// Admins may grant admin/member/viewer — never owner. This is what prevents an
// admin from minting another owner via the member endpoints.
export const ROLE_VALUES = ['admin', 'member', 'viewer'] as const;

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
});

export const switchOrgSchema = z.object({
  orgId: z.string().min(1),
});

// .strict() rejects unknown keys so the body can't mass-assign columns such as
// `slug` straight into prisma.organization.update.
export const updateOrgSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    minPlanningDate: z.string().nullable().optional(),
    maxPlanningDate: z.string().nullable().optional(),
    performanceTrendDefaultMonths: z.number().int().positive().max(120).optional(),
    performanceTrendDefaultKind: z.string().max(50).optional(),
    performanceTrendDefaultFrom: z.string().nullable().optional(),
    performanceTrendDefaultTo: z.string().nullable().optional(),
    oneOnOneReminderEvery: z.number().int().min(1).max(365).nullable().optional(),
    oneOnOneReminderUnit: z.enum(['daily', 'weekly', 'monthly']).nullable().optional(),
    oneOnOneReminderStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    pmLogReminderEvery: z.number().int().min(1).max(365).nullable().optional(),
    pmLogReminderUnit: z.enum(['daily', 'weekly', 'monthly']).nullable().optional(),
    pmLogReminderStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    teamsRemindersEnabled: z.boolean().optional(),
    // Comma-separated subset of oneOnOne,pmUpdate,clientSignal (empty = all).
    teamsReminderTypes: z.string().max(200).nullable().optional(),
  })
  .strict();

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLE_VALUES).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(ROLE_VALUES),
});

export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLE_VALUES).optional(),
});

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
