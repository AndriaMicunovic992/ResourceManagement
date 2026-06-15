import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(100),
  status: z.enum(['realised', 'potential']).default('realised'),
  responsibleUserId: z.string().nullable().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
