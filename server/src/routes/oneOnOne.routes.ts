import { FastifyPluginAsync } from 'fastify';
import { requireRole } from '../middleware/requireRole.js';
import {
  createOneOnOneSchema,
  updateOneOnOneSchema,
} from '../schemas/oneOnOne.schema.js';
import {
  listOneOnOnes,
  getOneOnOne,
  createOneOnOne,
  updateOneOnOne,
  deleteOneOnOne,
} from '../services/oneOnOne.service.js';

export const oneOnOneRoutes: FastifyPluginAsync = async (app) => {
  app.get('/people/:personId/oneonones', { preHandler: requireRole('admin') }, async (req) => {
    const { personId } = req.params as { personId: string };
    return listOneOnOnes(req.orgId, personId, req.userId, req.role);
  });

  app.get(
    '/people/:personId/oneonones/:id',
    { preHandler: requireRole('admin') },
    async (req) => {
      const { id } = req.params as { personId: string; id: string };
      return getOneOnOne(req.orgId, id, req.userId, req.role);
    }
  );

  app.post(
    '/people/:personId/oneonones',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const { personId } = req.params as { personId: string };
      const body = createOneOnOneSchema.parse(req.body);
      const created = await createOneOnOne(req.orgId, personId, req.userId, body);
      return reply.status(201).send(created);
    }
  );

  app.patch(
    '/people/:personId/oneonones/:id',
    { preHandler: requireRole('admin') },
    async (req) => {
      const { id } = req.params as { personId: string; id: string };
      const body = updateOneOnOneSchema.parse(req.body);
      return updateOneOnOne(req.orgId, id, req.userId, body);
    }
  );

  app.delete(
    '/people/:personId/oneonones/:id',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const { id } = req.params as { personId: string; id: string };
      await deleteOneOnOne(req.orgId, id, req.userId, req.role);
      return reply.status(204).send();
    }
  );
};
