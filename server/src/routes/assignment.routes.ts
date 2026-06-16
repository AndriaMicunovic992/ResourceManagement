import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/prisma.js';
import { assignmentService } from '../services/assignment.service.js';
import { upsertAssignmentSchema, updateAssignmentSchema } from '../schemas/assignment.schema.js';
import { requireRole } from '../middleware/requireRole.js';
import { requirePermission } from '../middleware/requirePermission.js';

export const assignmentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/assignments', async (req) => {
    const list = await assignmentService.list(req.orgId);
    if (req.visibility.isAdmin) return list;

    // Assignments are visible if either the resource is visible OR the
    // underlying project is visible. We fetch the needs referenced by the
    // list once to resolve project ids.
    const needIds = [...new Set(list.map((a) => a.needId))];
    const needs = await prisma.need.findMany({
      where: { orgId: req.orgId, id: { in: needIds } },
      select: { id: true, projectId: true },
    });
    const needProject: Record<string, string> = {};
    for (const n of needs) needProject[n.id] = n.projectId;
    return list.filter((a) => {
      const projectId = needProject[a.needId];
      return (
        req.visibility.visiblePersonIds.has(a.resourceId) ||
        (projectId && req.visibility.visibleProjectIds.has(projectId))
      );
    });
  });

  app.post('/assignments', { preHandler: requirePermission('planner', 'create') }, async (req) => {
    const data = upsertAssignmentSchema.parse(req.body);
    return assignmentService.upsertMonth(req.orgId, data);
  });

  app.patch('/assignments/:id', { preHandler: requirePermission('planner', 'edit') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateAssignmentSchema.parse(req.body);
    return assignmentService.update(req.orgId, id, data);
  });

  app.delete('/assignments/:id', { preHandler: requirePermission('planner', 'delete') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await assignmentService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
