import { FastifyPluginAsync } from 'fastify';
import { requireRole } from '../middleware/requireRole.js';
import {
  createLogSchema,
  updateLogSchema,
  listLogsQuerySchema,
} from '../schemas/log.schema.js';
import {
  listLogs,
  getLog,
  createLog,
  updateLog,
  deleteLog,
} from '../services/log.service.js';

export const logRoutes: FastifyPluginAsync = async (app) => {
  app.get('/people/:personId/logs', { preHandler: requireRole('viewer') }, async (req) => {
    const { personId } = req.params as { personId: string };
    const query = listLogsQuerySchema.parse(req.query ?? {});
    return listLogs(req.orgId, personId, query, req.userId, req.role);
  });

  app.get(
    '/people/:personId/logs/:id',
    { preHandler: requireRole('viewer') },
    async (req) => {
      const { id } = req.params as { personId: string; id: string };
      return getLog(req.orgId, id, req.userId, req.role);
    }
  );

  app.post(
    '/people/:personId/logs',
    { preHandler: requireRole('viewer') },
    async (req, reply) => {
      const { personId } = req.params as { personId: string };
      const body = createLogSchema.parse(req.body);
      const created = await createLog(req.orgId, personId, req.userId, req.role, body);
      return reply.status(201).send(created);
    }
  );

  app.patch(
    '/people/:personId/logs/:id',
    { preHandler: requireRole('viewer') },
    async (req) => {
      const { id } = req.params as { personId: string; id: string };
      const body = updateLogSchema.parse(req.body);
      return updateLog(req.orgId, id, req.userId, req.role, body);
    }
  );

  app.delete(
    '/people/:personId/logs/:id',
    { preHandler: requireRole('viewer') },
    async (req, reply) => {
      const { id } = req.params as { personId: string; id: string };
      await deleteLog(req.orgId, id, req.userId, req.role);
      return reply.status(204).send();
    }
  );
};
