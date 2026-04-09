import { FastifyPluginAsync } from 'fastify';
import { orgService } from '../services/org.service.js';
import { requireRole } from '../middleware/requireRole.js';

export const orgRoutes: FastifyPluginAsync = async (app) => {
  app.get('/orgs', async (req) => {
    return orgService.listUserOrgs(req.userId);
  });

  app.post('/orgs', async (req) => {
    const { name } = req.body as { name: string };
    return orgService.createOrg(req.userId, name);
  });

  app.post('/orgs/switch', async (req, reply) => {
    const { orgId } = req.body as { orgId: string };
    const token = app.jwt.sign({ userId: req.userId, orgId });
    return { token };
  });

  app.patch('/org', { preHandler: requireRole('admin') }, async (req) => {
    const data = req.body as { name?: string };
    return orgService.updateOrg(req.orgId, data);
  });

  app.delete('/org', { preHandler: requireRole('owner') }, async (req, reply) => {
    await orgService.deleteOrg(req.orgId);
    return reply.status(204).send();
  });
};
