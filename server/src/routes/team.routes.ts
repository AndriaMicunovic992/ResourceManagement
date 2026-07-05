import { FastifyPluginAsync } from 'fastify';
import { teamService } from '../services/team.service.js';
import { createTeamSchema, updateTeamSchema } from '../schemas/team.schema.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { canView } from '../lib/permissions.js';
import { assertManagerUsersAllowed } from '../services/visibility.service.js';

export const teamRoutes: FastifyPluginAsync = async (app) => {
  app.get('/teams', async (req) => {
    // Mirror the other list endpoints: no view permission → empty list, rather
    // than leaking the whole team roster + manager identities to any token.
    if (!canView(req.permissions, 'teams')) return [];
    return teamService.list(req.orgId);
  });

  app.post('/teams', { preHandler: requirePermission('teams', 'create') }, async (req) => {
    const data = createTeamSchema.parse(req.body);
    if (data.managerUserId) await assertManagerUsersAllowed(req.orgId, [data.managerUserId]);
    return teamService.create(req.orgId, data);
  });

  app.patch('/teams/:id', { preHandler: requirePermission('teams', 'edit') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateTeamSchema.parse(req.body);
    if (data.managerUserId) await assertManagerUsersAllowed(req.orgId, [data.managerUserId]);
    return teamService.update(req.orgId, id, data);
  });

  app.delete('/teams/:id', { preHandler: requirePermission('teams', 'delete') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await teamService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
