import { FastifyPluginAsync } from 'fastify';
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
import { assertCanViewPerson, isSelf } from '../services/visibility.service.js';
import { ForbiddenError } from '../utils/errors.js';

export const oneOnOneRoutes: FastifyPluginAsync = async (app) => {
  app.get('/people/:personId/oneonones', async (req) => {
    const { personId } = req.params as { personId: string };
    assertCanViewPerson(req.visibility, personId);
    // Subjects may read their own 1:1s in self mode (author-private fields
    // like managerPersonalNotes/privateNote are stripped by the service).
    return listOneOnOnes(req.orgId, personId, req.userId);
  });

  app.get('/people/:personId/oneonones/:id', async (req) => {
    const { personId, id } = req.params as { personId: string; id: string };
    assertCanViewPerson(req.visibility, personId);
    return getOneOnOne(req.orgId, id, req.userId);
  });

  app.post('/people/:personId/oneonones', async (req, reply) => {
    const { personId } = req.params as { personId: string };
    assertCanViewPerson(req.visibility, personId);
    // Subjects cannot create 1:1s on their own profile.
    if (isSelf(req.visibility, personId) && !req.visibility.isAdmin) {
      throw new ForbiddenError('You cannot create a 1:1 on your own profile');
    }
    const body = createOneOnOneSchema.parse(req.body);
    const created = await createOneOnOne(req.orgId, personId, req.userId, body);
    return reply.status(201).send(created);
  });

  app.patch('/people/:personId/oneonones/:id', async (req) => {
    const { personId, id } = req.params as { personId: string; id: string };
    assertCanViewPerson(req.visibility, personId);
    const body = updateOneOnOneSchema.parse(req.body);
    return updateOneOnOne(req.orgId, id, req.userId, req.role, body);
  });

  app.delete('/people/:personId/oneonones/:id', async (req, reply) => {
    const { personId, id } = req.params as { personId: string; id: string };
    assertCanViewPerson(req.visibility, personId);
    await deleteOneOnOne(req.orgId, id, req.userId, req.role);
    return reply.status(204).send();
  });
};
