import { FastifyPluginAsync } from 'fastify';
import { performanceLogCategoryService } from '../services/performanceLogCategory.service.js';
import {
  createPerformanceLogCategorySchema,
  updatePerformanceLogCategorySchema,
} from '../schemas/performanceLogCategory.schema.js';
import { requireRole } from '../middleware/requireRole.js';

export const performanceLogCategoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/log-categories', { preHandler: requireRole('viewer') }, async (req) => {
    return performanceLogCategoryService.list(req.orgId);
  });

  app.post('/log-categories', { preHandler: requireRole('admin') }, async (req, reply) => {
    const data = createPerformanceLogCategorySchema.parse(req.body);
    const created = await performanceLogCategoryService.create(req.orgId, data);
    return reply.status(201).send(created);
  });

  app.patch('/log-categories/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updatePerformanceLogCategorySchema.parse(req.body);
    return performanceLogCategoryService.update(req.orgId, id, data);
  });

  app.delete('/log-categories/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await performanceLogCategoryService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
