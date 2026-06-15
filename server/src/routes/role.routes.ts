import { FastifyPluginAsync } from 'fastify';
import { requireRole } from '../middleware/requireRole.js';
import { roleService } from '../services/role.service.js';

export const roleRoutes: FastifyPluginAsync = async (app) => {
  // Roles + the matrix schema. Admin-only (it's an org-administration view).
  app.get('/roles', { preHandler: requireRole('admin') }, async (req) => {
    const [roles] = await Promise.all([roleService.list(req.orgId)]);
    return { ...roleService.schema(), roles };
  });
};
