import { z } from 'zod';

/** True for a valid IANA timezone name (or a null/empty value). */
function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// A member/invite role is any role key defined in the org — system or custom —
// so it's a plain string here. The services enforce the real invariants:
// the key must exist in the org (roleService.exists) and can never be 'owner',
// which is what prevents an admin from minting another owner.
const roleKey = z.string().min(1).max(50);

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
    // Default month window for the Insights → Planning tab. "rolling" spans N
    // months from the current month; "custom" uses the "YYYY-MM" start/end.
    insightsDefaultKind: z
      .enum(['rolling_months', 'calendar_quarter', 'calendar_half', 'calendar_year', 'custom'])
      .optional(),
    insightsDefaultMonths: z.number().int().positive().max(120).optional(),
    insightsDefaultStart: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
    insightsDefaultEnd: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
    oneOnOneReminderEvery: z.number().int().min(1).max(365).nullable().optional(),
    oneOnOneReminderUnit: z.enum(['daily', 'weekly', 'monthly']).nullable().optional(),
    oneOnOneReminderStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    pmLogReminderEvery: z.number().int().min(1).max(365).nullable().optional(),
    pmLogReminderUnit: z.enum(['daily', 'weekly', 'monthly']).nullable().optional(),
    pmLogReminderStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    teamsRemindersEnabled: z.boolean().optional(),
    // Comma-separated subset of oneOnOne,pmUpdate,clientSignal (empty = all).
    teamsReminderTypes: z.string().max(200).nullable().optional(),
    // Custom intro line for the Teams reminder DM (empty = built-in default).
    teamsReminderMessage: z.string().max(2000).nullable().optional(),
    // Daily send time: local hour (0-23) in an IANA timezone (null = UTC).
    teamsReminderHour: z.number().int().min(0).max(23).optional(),
    teamsReminderTimezone: z
      .string()
      .max(64)
      .nullable()
      .optional()
      .refine((v) => v == null || isValidTimeZone(v), 'Invalid timezone'),
  })
  .strict();

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: roleKey.optional(),
});

export const updateMemberRoleSchema = z.object({
  role: roleKey,
});

export const inviteSchema = z.object({
  email: z.string().email(),
  role: roleKey.optional(),
});

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
