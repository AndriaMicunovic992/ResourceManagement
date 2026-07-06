import { FastifyPluginAsync } from 'fastify';
import { assertCanViewPerson, assertCanViewCustomer, isSelf } from '../services/visibility.service.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { ForbiddenError } from '../utils/errors.js';
import { followUpService } from '../services/followUp.service.js';
import { careerEntryService } from '../services/careerEntry.service.js';
import { clientSignalService } from '../services/clientSignal.service.js';
import { customerReviewService } from '../services/customerReview.service.js';
import {
  createFollowUpSchema,
  updateFollowUpSchema,
  listFollowUpsQuerySchema,
} from '../schemas/followUp.schema.js';
import {
  createCareerEntrySchema,
  updateCareerEntrySchema,
} from '../schemas/careerEntry.schema.js';
import {
  upsertClientSignalSchema,
  listClientSignalsQuerySchema,
} from '../schemas/clientSignal.schema.js';

/**
 * Follow-ups, career thread, client signals. Read access mirrors 1:1s (the
 * subject may read follow-ups and career entries about themselves — they're
 * agreed in the meeting); writes are manager/admin-only. Client signals are
 * the exception: never visible to the subject.
 */
export const peopleOpsRoutes: FastifyPluginAsync = async (app) => {
  function assertNotSelfWrite(req: { visibility: any }, personId: string, what: string): void {
    if (isSelf(req.visibility, personId) && !req.visibility.isAdmin) {
      throw new ForbiddenError(`You cannot ${what} on your own profile`);
    }
  }

  // --- Follow-ups ---

  app.get('/people/:personId/followups', async (req) => {
    const { personId } = req.params as { personId: string };
    assertCanViewPerson(req.visibility, personId);
    const { status } = listFollowUpsQuerySchema.parse(req.query ?? {});
    return followUpService.list(req.orgId, personId, status);
  });

  app.post('/people/:personId/followups', { preHandler: requirePermission('activity', 'create') }, async (req, reply) => {
    const { personId } = req.params as { personId: string };
    assertCanViewPerson(req.visibility, personId);
    assertNotSelfWrite(req, personId, 'create follow-ups');
    const body = createFollowUpSchema.parse(req.body);
    const created = await followUpService.create(req.orgId, personId, req.userId, body);
    return reply.status(201).send(created);
  });

  app.patch('/people/:personId/followups/:id', { preHandler: requirePermission('activity', 'edit') }, async (req) => {
    const { personId, id } = req.params as { personId: string; id: string };
    assertCanViewPerson(req.visibility, personId);
    assertNotSelfWrite(req, personId, 'edit follow-ups');
    const body = updateFollowUpSchema.parse(req.body);
    return followUpService.update(req.orgId, personId, id, body);
  });

  app.delete('/people/:personId/followups/:id', { preHandler: requirePermission('activity', 'delete') }, async (req, reply) => {
    const { personId, id } = req.params as { personId: string; id: string };
    assertCanViewPerson(req.visibility, personId);
    assertNotSelfWrite(req, personId, 'delete follow-ups');
    await followUpService.remove(req.orgId, personId, id, req.userId, req.role);
    return reply.status(204).send();
  });

  // --- Career thread ---

  app.get('/people/:personId/career', async (req) => {
    const { personId } = req.params as { personId: string };
    assertCanViewPerson(req.visibility, personId);
    return careerEntryService.list(req.orgId, personId);
  });

  app.post('/people/:personId/career', { preHandler: requirePermission('activity', 'create') }, async (req, reply) => {
    const { personId } = req.params as { personId: string };
    assertCanViewPerson(req.visibility, personId);
    assertNotSelfWrite(req, personId, 'add career entries');
    const body = createCareerEntrySchema.parse(req.body);
    const created = await careerEntryService.create(req.orgId, personId, req.userId, body);
    return reply.status(201).send(created);
  });

  app.patch('/people/:personId/career/:id', { preHandler: requirePermission('activity', 'edit') }, async (req) => {
    const { personId, id } = req.params as { personId: string; id: string };
    assertCanViewPerson(req.visibility, personId);
    assertNotSelfWrite(req, personId, 'edit career entries');
    const body = updateCareerEntrySchema.parse(req.body);
    return careerEntryService.update(req.orgId, personId, id, req.userId, req.role, body);
  });

  app.delete('/people/:personId/career/:id', { preHandler: requirePermission('activity', 'delete') }, async (req, reply) => {
    const { personId, id } = req.params as { personId: string; id: string };
    assertCanViewPerson(req.visibility, personId);
    assertNotSelfWrite(req, personId, 'delete career entries');
    await careerEntryService.remove(req.orgId, personId, id, req.userId, req.role);
    return reply.status(204).send();
  });

  // --- Client signals ---

  app.get('/customers/:customerId/signals', async (req) => {
    const { customerId } = req.params as { customerId: string };
    assertCanViewCustomer(req.visibility, customerId);
    const query = listClientSignalsQuerySchema.parse(req.query ?? {});
    return clientSignalService.listForCustomer(req.orgId, req.visibility, customerId, query);
  });

  app.put('/customers/:customerId/signals', async (req) => {
    const { customerId } = req.params as { customerId: string };
    assertCanViewCustomer(req.visibility, customerId);
    const body = upsertClientSignalSchema.parse(req.body);
    return clientSignalService.upsert(req.orgId, req.visibility, customerId, req.userId, body);
  });

  app.delete('/customers/:customerId/signals/:id', async (req, reply) => {
    const { customerId, id } = req.params as { customerId: string; id: string };
    assertCanViewCustomer(req.visibility, customerId);
    await clientSignalService.remove(req.orgId, req.visibility, customerId, id);
    return reply.status(204).send();
  });

  app.get('/people/:personId/signals', async (req) => {
    const { personId } = req.params as { personId: string };
    assertCanViewPerson(req.visibility, personId);
    const query = listClientSignalsQuerySchema.parse(req.query ?? {});
    return clientSignalService.listForResource(req.orgId, req.visibility, personId, query);
  });

  // --- PM review sessions (dated records, like 1:1s on the customer side) ---

  app.get('/customers/:customerId/reviews', async (req) => {
    const { customerId } = req.params as { customerId: string };
    assertCanViewCustomer(req.visibility, customerId);
    return customerReviewService.list(req.orgId, req.visibility, customerId);
  });

  app.get('/customers/:customerId/reviews/:id', async (req) => {
    const { customerId, id } = req.params as { customerId: string; id: string };
    assertCanViewCustomer(req.visibility, customerId);
    return customerReviewService.get(req.orgId, req.visibility, customerId, id);
  });

  app.post('/customers/:customerId/reviews', async (req, reply) => {
    const { customerId } = req.params as { customerId: string };
    assertCanViewCustomer(req.visibility, customerId);
    const { reviewDate } = (req.body ?? {}) as { reviewDate?: string };
    const created = await customerReviewService.create(
      req.orgId,
      req.visibility,
      customerId,
      req.userId,
      reviewDate
    );
    return reply.status(201).send(created);
  });

  app.delete('/customers/:customerId/reviews/:id', async (req, reply) => {
    const { customerId, id } = req.params as { customerId: string; id: string };
    assertCanViewCustomer(req.visibility, customerId);
    await customerReviewService.remove(req.orgId, req.visibility, customerId, id, req.userId);
    return reply.status(204).send();
  });
};
