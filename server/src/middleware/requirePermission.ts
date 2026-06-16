import { FastifyRequest, FastifyReply } from 'fastify';
import { canDo, type SegmentKey, type Action } from '../lib/permissions.js';

/**
 * Gate a route on a capability from the requester's role matrix, e.g.
 * `requirePermission('customers', 'create')`. Returns 403 when the role lacks
 * it (scope 'none' or the action flag off). Replaces the coarse
 * `requireRole('admin')` gates on mutation routes.
 */
export function requirePermission(segment: SegmentKey, action: Action) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.permissions || !canDo(req.permissions, segment, action)) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }
  };
}
