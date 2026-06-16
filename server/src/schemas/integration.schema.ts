import { z } from 'zod';

// Connection config. Tokens are optional on save: omit to leave the stored
// (encrypted) value untouched, send "" or null to clear, send a value to set.
export const saveConnectionSchema = z.object({
  baseUrl: z.string().max(300).nullable().optional(),
  jiraEmail: z.string().max(200).nullable().optional(),
  enabled: z.boolean().optional(),
  jiraApiToken: z.string().max(2000).nullable().optional(),
  tempoApiToken: z.string().max(2000).nullable().optional(),
});

const kind = z.enum(['project', 'epic', 'issue', 'other']);

export const createWorkItemSchema = z.object({
  kind: kind.default('project'),
  externalKey: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  parentId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
});

export const updateWorkItemSchema = z.object({
  kind: kind.optional(),
  externalKey: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  parentId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
});

// Map one of our entities (customer XOR project) to a Jira work item.
export const mapEntitySchema = z
  .object({
    customerId: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    workItemId: z.string().nullable(),
  })
  .refine((d) => !!d.customerId !== !!d.projectId, {
    message: 'Provide exactly one of customerId / projectId',
  });
