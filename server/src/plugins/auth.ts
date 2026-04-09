import fp from 'fastify-plugin';
import { prisma } from '../db/prisma.js';

export default fp(async (app) => {
  app.decorateRequest('userId', '');
  app.decorateRequest('orgId', '');
  app.decorateRequest('role', '');

  app.addHook('onRequest', async (req, reply) => {
    if (
      req.url.startsWith('/api/auth/login') ||
      req.url.startsWith('/api/auth/signup') ||
      req.url === '/api/health' ||
      !req.url.startsWith('/api/')
    ) return;

    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return reply.status(401).send({ error: 'Unauthorized' });

      const decoded = app.jwt.verify<{ userId: string; orgId: string }>(token);

      const membership = await prisma.orgMember.findUnique({
        where: { userId_orgId: { userId: decoded.userId, orgId: decoded.orgId } },
      });
      if (!membership) return reply.status(403).send({ error: 'No access to this org' });

      req.userId = decoded.userId;
      req.orgId = decoded.orgId;
      req.role = membership.role;
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });
});
