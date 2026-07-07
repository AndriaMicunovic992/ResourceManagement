import { z } from 'zod';
import { outboundUrlProblem } from '../utils/ssrf.js';

// Connection config. Tokens are optional on save: omit to leave the stored
// (encrypted) value untouched, send "" or null to clear, send a value to set.
export const saveConnectionSchema = z.object({
  baseUrl: z
    .string()
    .max(300)
    .nullable()
    .optional()
    // Reject internal/reserved hosts up front (SSRF). Empty / null clears it.
    .refine((v) => !v || outboundUrlProblem(v) === null, {
      message: 'Base URL must be a public http(s) address',
    }),
  jiraEmail: z.string().max(200).nullable().optional(),
  enabled: z.boolean().optional(),
  autoSyncEnabled: z.boolean().optional(),
  jiraApiToken: z.string().max(2000).nullable().optional(),
  tempoApiToken: z.string().max(2000).nullable().optional(),
});

// Microsoft Teams bot credentials. appType mirrors Bot Framework's
// MicrosoftAppType; a managed-identity bot (UserAssignedMSI) has no secret. Like
// the Jira tokens, botAppPassword is optional on save: omit to keep the stored
// (encrypted) secret, "" / null clears.
export const saveTeamsConnectionSchema = z.object({
  appType: z.enum(['MultiTenant', 'SingleTenant', 'UserAssignedMSI']).optional(),
  botAppId: z.string().max(200).nullable().optional(),
  tenantId: z.string().max(200).nullable().optional(),
  botAppPassword: z.string().max(2000).nullable().optional(),
});

const kind = z.enum(['project', 'epic', 'issue', 'other']);
// What hours under this item mean — client work (maps to a customer/project),
// internal work, or absences. Non-client items never carry a customer/project.
const workType = z.enum(['client', 'internal', 'absence']);

export const createWorkItemSchema = z.object({
  kind: kind.default('project'),
  workType: workType.optional(),
  externalKey: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  parentId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
});

export const updateWorkItemSchema = z.object({
  kind: kind.optional(),
  workType: workType.optional(),
  externalKey: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  parentId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
});

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
// Pull worklogs created/updated on or after this date (delta cursor).
export const syncHoursSchema = z.object({ updatedFrom: ymd });
