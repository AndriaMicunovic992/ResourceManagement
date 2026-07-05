import { FastifyPluginAsync } from 'fastify';
import {
  createLogSchema,
  updateLogSchema,
  listLogsQuerySchema,
  createLogCommentSchema,
} from '../schemas/log.schema.js';
import {
  listLogs,
  getLog,
  createLog,
  updateLog,
  deleteLog,
  addLogComment,
  deleteLogComment,
} from '../services/log.service.js';
import { assertCanViewPerson } from '../services/visibility.service.js';
import { requirePermission } from '../middleware/requirePermission.js';

export const logRoutes: FastifyPluginAsync = async (app) => {
  app.get('/people/:personId/logs', async (req) => {
    const { personId } = req.params as { personId: string };
    assertCanViewPerson(req.visibility, personId);
    const query = listLogsQuerySchema.parse(req.query ?? {});
    return listLogs(req.orgId, personId, query, req.userId, req.role);
  });

  app.get('/people/:personId/logs/:id', async (req) => {
    const { personId, id } = req.params as { personId: string; id: string };
    assertCanViewPerson(req.visibility, personId);
    return getLog(req.orgId, personId, id, req.userId, req.role);
  });

  app.post('/people/:personId/logs', { preHandler: requirePermission('activity', 'create') }, async (req, reply) => {
    const { personId } = req.params as { personId: string };
    assertCanViewPerson(req.visibility, personId);
    const body = createLogSchema.parse(req.body);
    const created = await createLog(req.orgId, personId, req.userId, req.role, body);
    return reply.status(201).send(created);
  });

  app.patch('/people/:personId/logs/:id', { preHandler: requirePermission('activity', 'edit') }, async (req) => {
    const { personId, id } = req.params as { personId: string; id: string };
    assertCanViewPerson(req.visibility, personId);
    const body = updateLogSchema.parse(req.body);
    return updateLog(req.orgId, personId, id, req.userId, req.role, body);
  });

  app.delete('/people/:personId/logs/:id', { preHandler: requirePermission('activity', 'delete') }, async (req, reply) => {
    const { personId, id } = req.params as { personId: string; id: string };
    assertCanViewPerson(req.visibility, personId);
    await deleteLog(req.orgId, personId, id, req.userId, req.role);
    return reply.status(204).send();
  });

  // --- Thread comments (PM ↔ manager ↔ admins; never the subject in v1) ---

  app.post('/people/:personId/logs/:id/comments', { preHandler: requirePermission('activity', 'create') }, async (req, reply) => {
    const { personId, id } = req.params as { personId: string; id: string };
    assertCanViewPerson(req.visibility, personId);
    const body = createLogCommentSchema.parse(req.body);
    const created = await addLogComment(req.orgId, personId, id, req.userId, req.role, body.content);
    return reply.status(201).send(created);
  });

  app.delete('/people/:personId/logs/:id/comments/:commentId', { preHandler: requirePermission('activity', 'delete') }, async (req, reply) => {
    const { personId, id, commentId } = req.params as {
      personId: string;
      id: string;
      commentId: string;
    };
    assertCanViewPerson(req.visibility, personId);
    await deleteLogComment(req.orgId, personId, id, commentId, req.userId, req.role);
    return reply.status(204).send();
  });
};
