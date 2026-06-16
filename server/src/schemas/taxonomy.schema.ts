import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #3B82F6');
const term = z.string().min(1).max(40);

export const createDomainSchema = z.object({ name: term, color: hexColor });
export const updateDomainSchema = z
  .object({ name: term.optional(), color: hexColor.optional() })
  .refine((d) => d.name !== undefined || d.color !== undefined, { message: 'Nothing to update' });

export const createRoleSchema = z.object({ name: term });
export const updateRoleSchema = z.object({ name: term });

export const createSenioritySchema = z.object({ name: term, shortLabel: z.string().min(1).max(8) });
export const updateSenioritySchema = z
  .object({ name: term.optional(), shortLabel: z.string().min(1).max(8).optional() })
  .refine((d) => d.name !== undefined || d.shortLabel !== undefined, { message: 'Nothing to update' });

export const moveSenioritySchema = z.object({ direction: z.enum(['up', 'down']) });
