import { FastifyPluginAsync } from 'fastify';
import { requireRole } from '../middleware/requireRole.js';
import {
  createEvaluationSchema,
  batchCreateEvaluationSchema,
  updateScoreSchema,
  finalizeEvaluationSchema,
  listEvaluationsQuerySchema,
  compensationSchema,
} from '../schemas/evaluation.schema.js';
import { evaluationService } from '../services/evaluation.service.js';
import { performanceService } from '../services/performance.service.js';
import { assertCanViewPerson } from '../services/visibility.service.js';

export const evaluationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/evaluations', async (req) => {
    const query = listEvaluationsQuerySchema.parse(req.query ?? {});
    const all = await evaluationService.list(req.orgId, req.userId, req.role, query);
    if (req.visibility.isAdmin) return all;
    // Defense in depth: filter by visible persons. The service already applies
    // its own viewer-kind filter, but we additionally trim to visible people
    // so a member never sees evaluations for someone outside their scope.
    return (all as Array<Record<string, unknown>>).filter((e) =>
      req.visibility.visiblePersonIds.has(
        (e as { resourceId: string }).resourceId
      )
    );
  });

  app.get('/evaluations/:id', async (req) => {
    const { id } = req.params as { id: string };
    const e = await evaluationService.getById(req.orgId, id, req.userId, req.role);
    if (!req.visibility.isAdmin) {
      assertCanViewPerson(req.visibility, (e as { resourceId: string }).resourceId);
    }
    return e;
  });

  app.post('/evaluations', async (req, reply) => {
    const body = createEvaluationSchema.parse(req.body);
    if (!req.visibility.isAdmin) {
      assertCanViewPerson(req.visibility, body.resourceId);
    }
    const created = await evaluationService.createOne(req.orgId, req.userId, req.role, body);
    return reply.status(201).send(created);
  });

  app.post('/evaluations/batch', async (req, reply) => {
    const body = batchCreateEvaluationSchema.parse(req.body);
    if (!req.visibility.isAdmin) {
      assertCanViewPerson(req.visibility, body.resourceId);
    }
    const created = await evaluationService.createBatch(req.orgId, req.userId, req.role, body);
    return reply.status(201).send(created);
  });

  app.patch('/evaluations/:id/scores/:snapshotId', async (req) => {
    const { id, snapshotId } = req.params as { id: string; snapshotId: string };
    const body = updateScoreSchema.parse(req.body);
    return evaluationService.updateScore(
      req.orgId,
      id,
      snapshotId,
      req.userId,
      req.role,
      body
    );
  });

  app.patch('/evaluations/:id/compensation', async (req) => {
    const { id } = req.params as { id: string };
    const body = compensationSchema.parse(req.body);
    return evaluationService.setCompensationSatisfaction(
      req.orgId,
      id,
      req.userId,
      body.compensationSatisfaction
    );
  });

  app.post('/evaluations/:id/transitions/submit-employee', async (req) => {
    const { id } = req.params as { id: string };
    return evaluationService.submitEmployee(req.orgId, id, req.userId, req.role);
  });

  app.post('/evaluations/:id/transitions/submit-responsible', async (req) => {
    const { id } = req.params as { id: string };
    return evaluationService.submitResponsible(req.orgId, id, req.userId, req.role);
  });

  app.post('/evaluations/:id/transitions/finalize', async (req) => {
    const { id } = req.params as { id: string };
    const body = finalizeEvaluationSchema.parse(req.body ?? {});
    return evaluationService.finalize(req.orgId, id, req.userId, req.role, body);
  });

  app.delete('/evaluations/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await evaluationService.delete(req.orgId, id, req.role);
    return reply.status(204).send();
  });

  // Performance rollups for a person.
  app.get('/people/:personId/performance/overall', async (req) => {
    const { personId } = req.params as { personId: string };
    assertCanViewPerson(req.visibility, personId);
    const q = req.query as {
      from?: string;
      to?: string;
      customerId?: string;
      projectId?: string;
    };
    return performanceService.overall(
      req.orgId,
      personId,
      req.userId,
      req.role,
      q.from,
      q.to,
      q.customerId || undefined,
      q.projectId || undefined
    );
  });

  app.get('/people/:personId/performance/trend', async (req) => {
    const { personId } = req.params as { personId: string };
    assertCanViewPerson(req.visibility, personId);
    const q = req.query as {
      bucket?: string;
      from?: string;
      to?: string;
      customerId?: string;
      projectId?: string;
    };
    const bucket = q.bucket === 'quarter' ? 'quarter' : 'month';
    return performanceService.trend(
      req.orgId,
      personId,
      req.userId,
      req.role,
      bucket,
      q.from,
      q.to,
      q.customerId || undefined,
      q.projectId || undefined
    );
  });

  app.get('/people/:personId/performance/categories', async (req) => {
    const { personId } = req.params as { personId: string };
    assertCanViewPerson(req.visibility, personId);
    const q = req.query as {
      customerId?: string;
      projectId?: string;
      from?: string;
      to?: string;
    };
    return performanceService.categoryBreakdown(req.orgId, personId, req.userId, req.role, {
      customerId: q.customerId || null,
      projectId: q.projectId || null,
      from: q.from,
      to: q.to,
    });
  });
};
