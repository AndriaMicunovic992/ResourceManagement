import { FastifyPluginAsync } from 'fastify';
import { resourceService } from '../services/resource.service.js';
import { createResourceSchema, updateResourceSchema } from '../schemas/resource.schema.js';
import { requireRole } from '../middleware/requireRole.js';

export const resourceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/resources', async (req) => {
    return resourceService.list(req.orgId);
  });

  app.get('/me/resource', async (req) => {
    return resourceService.getByUserId(req.orgId, req.userId);
  });

  app.post('/resources', { preHandler: requireRole('member') }, async (req) => {
    const data = createResourceSchema.parse(req.body);
    return resourceService.create(req.orgId, data);
  });

  app.patch('/resources/:id', { preHandler: requireRole('member') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateResourceSchema.parse(req.body);
    return resourceService.update(req.orgId, id, data);
  });

  app.delete('/resources/:id', { preHandler: requireRole('member') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await resourceService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
