import { FastifyPluginAsync } from 'fastify';
import { orgService } from '../services/org.service.js';
import { inviteService } from '../services/invite.service.js';
import { requireRole } from '../middleware/requireRole.js';
import { ForbiddenError } from '../utils/errors.js';
import { config } from '../config.js';
import {
  createOrgSchema,
  switchOrgSchema,
  updateOrgSchema,
  addMemberSchema,
  updateMemberRoleSchema,
  inviteSchema,
} from '../schemas/org.schema.js';

export const orgRoutes: FastifyPluginAsync = async (app) => {
  app.get('/orgs', async (req) => {
    return orgService.listUserOrgs(req.userId);
  });

  app.post('/orgs', async (req) => {
    const { name } = createOrgSchema.parse(req.body);
    return orgService.createOrg(req.userId, name);
  });

  app.post('/orgs/switch', async (req) => {
    const { orgId } = switchOrgSchema.parse(req.body);
    // Only mint a token for an org the user is actually a member of. The
    // per-request auth hook re-checks this too, but don't hand out a token that
    // implies access the user doesn't have.
    const membership = await orgService.membershipFor(req.userId, orgId);
    if (!membership) throw new ForbiddenError('You are not a member of that organization');
    const token = app.jwt.sign({ userId: req.userId, orgId }, { expiresIn: config.tokenTtl });
    return { token };
  });

  app.patch('/org', { preHandler: requireRole('admin') }, async (req) => {
    const data = updateOrgSchema.parse(req.body);
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
    const { email, role } = addMemberSchema.parse(req.body);
    return orgService.addMember(req.orgId, email, role || 'member', req.userId);
  });

  app.patch('/org/members/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const { role } = updateMemberRoleSchema.parse(req.body);
    return orgService.updateMemberRole(req.orgId, id, role, req.userId);
  });

  app.delete('/org/members/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await orgService.removeMember(req.orgId, id, req.userId);
    return reply.status(204).send();
  });

  // --- Pending invites (admin+) ---

  app.get('/org/invites', { preHandler: requireRole('admin') }, async (req) => {
    return inviteService.list(req.orgId);
  });

  app.post('/org/invites', { preHandler: requireRole('admin') }, async (req) => {
    const { email, role } = inviteSchema.parse(req.body);
    return inviteService.create(req.orgId, email, role || 'member', req.userId);
  });

  app.delete('/org/invites/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await inviteService.revoke(req.orgId, id);
    return reply.status(204).send();
  });
};
