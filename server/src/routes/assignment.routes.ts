import { FastifyPluginAsync } from 'fastify';
import { assignmentService } from '../services/assignment.service.js';
import { upsertAssignmentSchema, updateAssignmentSchema } from '../schemas/assignment.schema.js';
import { requireRole } from '../middleware/requireRole.js';

export const assignmentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/assignments', async (req) => {
    return assignmentService.list(req.orgId);
  });

  app.post('/assignments', { preHandler: requireRole('member') }, async (req) => {
    const data = upsertAssignmentSchema.parse(req.body);
    return assignmentService.upsertMonth(req.orgId, data);
  });

  app.patch('/assignments/:id', { preHandler: requireRole('member') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateAssignmentSchema.parse(req.body);
    return assignmentService.update(req.orgId, id, data);
  });

  app.delete('/assignments/:id', { preHandler: requireRole('member') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await assignmentService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
