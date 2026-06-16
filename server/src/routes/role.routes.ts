import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole.js';
import { roleService } from '../services/role.service.js';

const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(50),
  baseKey: z.enum(['viewer', 'member', 'admin']).optional(),
});

const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  level: z.number().int().min(1).max(3).optional(),
  permissions: z.record(z.any()).optional(),
});

// Managing roles is firmly an admin capability (it governs the permission
// system itself), so these stay on requireRole('admin') rather than a matrix
// segment.
export const roleRoutes: FastifyPluginAsync = async (app) => {
  app.get('/roles', { preHandler: requireRole('admin') }, async (req) => {
    const roles = await roleService.list(req.orgId);
    return { ...roleService.schema(), roles };
  });

  app.post('/roles', { preHandler: requireRole('admin') }, async (req) => {
    const data = createRoleSchema.parse(req.body);
    return roleService.create(req.orgId, data);
  });

  app.patch('/roles/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateRoleSchema.parse(req.body);
    return roleService.update(req.orgId, id, data);
  });

  app.delete('/roles/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await roleService.remove(req.orgId, id);
    return reply.status(204).send();
  });
};
