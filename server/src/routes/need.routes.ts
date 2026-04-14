import { FastifyPluginAsync } from 'fastify';
import { needService } from '../services/need.service.js';
import { createNeedSchema, updateNeedSchema } from '../schemas/need.schema.js';
import { requireRole } from '../middleware/requireRole.js';

export const needRoutes: FastifyPluginAsync = async (app) => {
  app.get('/needs', async (req) => {
    const { projectId } = req.query as { projectId?: string };
    const list = await needService.list(req.orgId, projectId);
    if (req.visibility.isAdmin) return list;
    return list.filter((n) => req.visibility.visibleProjectIds.has(n.projectId));
  });

  app.post('/needs', { preHandler: requireRole('admin') }, async (req) => {
    const data = createNeedSchema.parse(req.body);
    return needService.create(req.orgId, data);
  });

  app.patch('/needs/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateNeedSchema.parse(req.body);
    return needService.update(req.orgId, id, data);
  });

  app.delete('/needs/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await needService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
