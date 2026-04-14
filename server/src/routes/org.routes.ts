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
    const data = req.body as {
      name?: string;
      minPlanningDate?: string | null;
      maxPlanningDate?: string | null;
      performanceTrendDefaultMonths?: number;
    };
    return orgService.updateOrg(req.orgId, data);
  });

  app.delete('/org', { preHandler: requireRole('owner') }, async (req, reply) => {
    await orgService.deleteOrg(req.orgId);
    return reply.status(204).send();
  });

  // --- Member management (admin+) ---

  app.get('/org/members', { preHandler: requireRole('member') }, async (req) => {
    return orgService.listMembers(req.orgId);
  });

  app.post('/org/members', { preHandler: requireRole('admin') }, async (req) => {
    const { email, role } = req.body as { email: string; role?: string };
    return orgService.addMember(req.orgId, email, role || 'member');
  });

  app.patch('/org/members/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const { role } = req.body as { role: string };
    return orgService.updateMemberRole(req.orgId, id, role, req.userId);
  });

  app.delete('/org/members/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await orgService.removeMember(req.orgId, id, req.userId);
    return reply.status(204).send();
  });
};
