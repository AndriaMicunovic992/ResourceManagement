import { FastifyRequest, FastifyReply } from 'fastify';

type Role = 'owner' | 'admin' | 'member' | 'viewer';
const ROLE_LEVEL: Record<Role, number> = { viewer: 1, member: 2, admin: 3, owner: 4 };

export function requireRole(minRole: Role) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    // Prefer the role's resolved level (handles custom roles); fall back to the
    // legacy key map if visibility hasn't populated it.
    const userLevel = req.roleLevel ?? ROLE_LEVEL[req.role as Role] ?? 0;
    const requiredLevel = ROLE_LEVEL[minRole];
    if (userLevel < requiredLevel) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }
  };
}
