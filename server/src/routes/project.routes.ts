import { FastifyPluginAsync } from 'fastify';
import { projectService } from '../services/project.service.js';
import { createProjectSchema, updateProjectSchema } from '../schemas/project.schema.js';
import { requireRole } from '../middleware/requireRole.js';
import { assertResponsibleUserAllowed } from '../services/visibility.service.js';

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.get('/projects', async (req) => {
    const { customerId } = req.query as { customerId?: string };
    const list = await projectService.list(req.orgId, customerId);
    if (req.visibility.isAdmin) return list;
    return list.filter((p) => req.visibility.visibleProjectIds.has(p.id));
  });

  app.post('/projects', { preHandler: requireRole('admin') }, async (req) => {
    const data = createProjectSchema.parse(req.body);
    await assertResponsibleUserAllowed(req.orgId, data.responsibleUserId);
    return projectService.create(req.orgId, data);
  });

  app.patch('/projects/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateProjectSchema.parse(req.body);
    await assertResponsibleUserAllowed(req.orgId, data.responsibleUserId);
    return projectService.update(req.orgId, id, data);
  });

  app.delete('/projects/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await projectService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
