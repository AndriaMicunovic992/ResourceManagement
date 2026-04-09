import { FastifyPluginAsync } from 'fastify';
import { projectService } from '../services/project.service.js';
import { createProjectSchema, updateProjectSchema } from '../schemas/project.schema.js';
import { requireRole } from '../middleware/requireRole.js';

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.get('/projects', async (req) => {
    const { customerId } = req.query as { customerId?: string };
    return projectService.list(req.orgId, customerId);
  });

  app.post('/projects', { preHandler: requireRole('member') }, async (req) => {
    const data = createProjectSchema.parse(req.body);
    return projectService.create(req.orgId, data);
  });

  app.patch('/projects/:id', { preHandler: requireRole('member') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateProjectSchema.parse(req.body);
    return projectService.update(req.orgId, id, data);
  });

  app.delete('/projects/:id', { preHandler: requireRole('member') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await projectService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
