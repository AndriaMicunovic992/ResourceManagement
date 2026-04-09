import { FastifyPluginAsync } from 'fastify';
import { customerService } from '../services/customer.service.js';
import { createCustomerSchema, updateCustomerSchema } from '../schemas/customer.schema.js';
import { requireRole } from '../middleware/requireRole.js';

export const customerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/customers', async (req) => {
    return customerService.list(req.orgId);
  });

  app.post('/customers', { preHandler: requireRole('member') }, async (req) => {
    const data = createCustomerSchema.parse(req.body);
    return customerService.create(req.orgId, data);
  });

  app.patch('/customers/:id', { preHandler: requireRole('member') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateCustomerSchema.parse(req.body);
    return customerService.update(req.orgId, id, data);
  });

  app.delete('/customers/:id', { preHandler: requireRole('member') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await customerService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
