import { FastifyPluginAsync } from 'fastify';
import { teamService } from '../services/team.service.js';
import { createTeamSchema, updateTeamSchema } from '../schemas/team.schema.js';
import { requireRole } from '../middleware/requireRole.js';
import { assertNoViewerResources } from '../services/visibility.service.js';

export const teamRoutes: FastifyPluginAsync = async (app) => {
  app.get('/teams', async (req) => {
    return teamService.list(req.orgId);
  });

  app.post('/teams', { preHandler: requireRole('admin') }, async (req) => {
    const data = createTeamSchema.parse(req.body);
    if (data.managerId) await assertNoViewerResources(req.orgId, [data.managerId]);
    return teamService.create(req.orgId, data);
  });

  app.patch('/teams/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateTeamSchema.parse(req.body);
    if (data.managerId) await assertNoViewerResources(req.orgId, [data.managerId]);
    return teamService.update(req.orgId, id, data);
  });

  app.delete('/teams/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await teamService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
