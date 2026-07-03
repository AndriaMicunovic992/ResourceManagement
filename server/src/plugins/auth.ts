import fp from 'fastify-plugin';
import { prisma } from '../db/prisma.js';
import { computeVisibility } from '../services/visibility.service.js';
import {
  LEGACY_ROLE_LEVEL,
  normalizeMatrix,
  systemRoleDef,
  emptyMatrix,
  type PermissionMatrix,
} from '../lib/permissions.js';

// Endpoints reachable without a session token.
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/config',
  '/api/auth/microsoft/login',
  '/api/auth/microsoft/callback',
  // The Teams bot messaging endpoint — authenticated by Bot Framework's own
  // bearer token (verified in teamsTransport), not our session JWT.
  '/api/teams/messages',
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
  app.decorateRequest('roleLevel', 1);
  app.decorateRequest('permissions', null);
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

      // Resolve the role's permission matrix + level. Falls back to the code
      // defaults if the Role row hasn't been seeded yet (e.g. a fresh deploy
      // before the first /roles read).
      const roleRow = await prisma.role.findUnique({
        where: { orgId_key: { orgId: decoded.orgId, key: membership.role } },
      });
      const sysDef = systemRoleDef(membership.role);
      req.roleLevel = roleRow?.level ?? sysDef?.level ?? LEGACY_ROLE_LEVEL[membership.role] ?? 1;
      req.permissions = roleRow
        ? normalizeMatrix(roleRow.permissions)
        : ((sysDef?.permissions ?? emptyMatrix()) as PermissionMatrix);

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
    req.visibility = await computeVisibility(req.orgId, req.userId, req.roleLevel);
  });
});
