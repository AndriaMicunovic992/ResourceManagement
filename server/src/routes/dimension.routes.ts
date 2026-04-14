import { FastifyPluginAsync } from 'fastify';
import { dimensionService } from '../services/dimension.service.js';
import {
  createDimensionSchema,
  updateDimensionSchema,
} from '../schemas/dimension.schema.js';
import { requireRole } from '../middleware/requireRole.js';

export const dimensionRoutes: FastifyPluginAsync = async (app) => {
  app.get('/dimensions', { preHandler: requireRole('viewer') }, async (req) => {
    return dimensionService.list(req.orgId);
  });

  app.post('/dimensions', { preHandler: requireRole('admin') }, async (req, reply) => {
    const data = createDimensionSchema.parse(req.body);
    const created = await dimensionService.create(req.orgId, data);
    return reply.status(201).send(created);
  });

  app.patch('/dimensions/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateDimensionSchema.parse(req.body);
    return dimensionService.update(req.orgId, id, data);
  });

  app.delete('/dimensions/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await dimensionService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
