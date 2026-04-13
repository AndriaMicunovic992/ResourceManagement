import { FastifyPluginAsync } from 'fastify';
import { teamService } from '../services/team.service.js';
import { createTeamSchema, updateTeamSchema } from '../schemas/team.schema.js';
import { requireRole } from '../middleware/requireRole.js';

export const teamRoutes: FastifyPluginAsync = async (app) => {
  app.get('/teams', async (req) => {
    return teamService.list(req.orgId);
  });

  app.post('/teams', { preHandler: requireRole('member') }, async (req) => {
    const data = createTeamSchema.parse(req.body);
    return teamService.create(req.orgId, data);
  });

  app.patch('/teams/:id', { preHandler: requireRole('member') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateTeamSchema.parse(req.body);
    return teamService.update(req.orgId, id, data);
  });

  app.delete('/teams/:id', { preHandler: requireRole('member') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await teamService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
