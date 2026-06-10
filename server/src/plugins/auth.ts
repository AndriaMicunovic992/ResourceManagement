import fp from 'fastify-plugin';
import { prisma } from '../db/prisma.js';
import { computeVisibility } from '../services/visibility.service.js';

// Endpoints reachable without a session token.
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/config',
  '/api/auth/microsoft/login',
  '/api/auth/microsoft/callback',
];

function isPublic(url: string): boolean {
  if (url === '/api/health') return true;
  if (!url.startsWith('/api/')) return true; // static SPA assets
  // Strip any query string before matching.
  const path = url.split('?')[0];
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

export default fp(async (app) => {
  app.decorateRequest('userId', '');
  app.decorateRequest('orgId', '');
  app.decorateRequest('role', '');
  app.decorateRequest('visibility', null);
  app.decorateRequest('impersonatorUserId', null);

  app.addHook('onRequest', async (req, reply) => {
    if (isPublic(req.url)) return;

    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return reply.status(401).send({ error: 'Unauthorized' });

      const decoded = app.jwt.verify<{ userId: string; orgId: string; imp?: string }>(token);

      const membership = await prisma.orgMember.findUnique({
        where: { userId_orgId: { userId: decoded.userId, orgId: decoded.orgId } },
      });
      if (!membership) return reply.status(403).send({ error: 'No access to this org' });

      req.userId = decoded.userId;
      req.orgId = decoded.orgId;
      req.role = membership.role;

      // Impersonation ("view as") is strictly read-only: an admin sees exactly
      // what the target sees, but cannot mutate data while wearing their hat.
      if (decoded.imp) {
        req.impersonatorUserId = decoded.imp;
        const method = req.method.toUpperCase();
        if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
          return reply
            .status(403)
            .send({ error: 'Read-only while viewing as another user. Stop impersonating to make changes.' });
        }
      }
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });

  // Populate visibility scope once per authenticated request. Separate hook so
  // it runs after onRequest sets userId/orgId/role. Routes that don't need
  // visibility still incur the query cost — routes are cheap here and the
  // tradeoff is that every handler can call req.visibility.* safely.
  app.addHook('preHandler', async (req) => {
    if (!req.userId || !req.orgId) return;
    req.visibility = await computeVisibility(req.orgId, req.userId, req.role);
  });
});
