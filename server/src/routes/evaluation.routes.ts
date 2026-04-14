import { FastifyPluginAsync } from 'fastify';
import { requireRole } from '../middleware/requireRole.js';
import {
  createEvaluationSchema,
  batchCreateEvaluationSchema,
  updateScoreSchema,
  finalizeEvaluationSchema,
  listEvaluationsQuerySchema,
} from '../schemas/evaluation.schema.js';
import { evaluationService } from '../services/evaluation.service.js';
import { performanceService } from '../services/performance.service.js';

export const evaluationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/evaluations', { preHandler: requireRole('viewer') }, async (req) => {
    const query = listEvaluationsQuerySchema.parse(req.query ?? {});
    return evaluationService.list(req.orgId, req.userId, req.role, query);
  });

  app.get('/evaluations/:id', { preHandler: requireRole('viewer') }, async (req) => {
    const { id } = req.params as { id: string };
    return evaluationService.getById(req.orgId, id, req.userId, req.role);
  });

  app.post('/evaluations', { preHandler: requireRole('viewer') }, async (req, reply) => {
    const body = createEvaluationSchema.parse(req.body);
    const created = await evaluationService.createOne(req.orgId, req.userId, req.role, body);
    return reply.status(201).send(created);
  });

  app.post('/evaluations/batch', { preHandler: requireRole('viewer') }, async (req, reply) => {
    const body = batchCreateEvaluationSchema.parse(req.body);
    const created = await evaluationService.createBatch(req.orgId, req.userId, req.role, body);
    return reply.status(201).send(created);
  });

  app.patch(
    '/evaluations/:id/scores/:snapshotId',
    { preHandler: requireRole('viewer') },
    async (req) => {
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
    }
  );

  app.post(
    '/evaluations/:id/transitions/submit-employee',
    { preHandler: requireRole('viewer') },
    async (req) => {
      const { id } = req.params as { id: string };
      return evaluationService.submitEmployee(req.orgId, id, req.userId, req.role);
    }
  );

  app.post(
    '/evaluations/:id/transitions/submit-responsible',
    { preHandler: requireRole('viewer') },
    async (req) => {
      const { id } = req.params as { id: string };
      return evaluationService.submitResponsible(req.orgId, id, req.userId, req.role);
    }
  );

  app.post(
    '/evaluations/:id/transitions/finalize',
    { preHandler: requireRole('viewer') },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = finalizeEvaluationSchema.parse(req.body ?? {});
      return evaluationService.finalize(req.orgId, id, req.userId, req.role, body);
    }
  );

  app.delete('/evaluations/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await evaluationService.delete(req.orgId, id, req.role);
    return reply.status(204).send();
  });

  // Performance rollups for a person.
  app.get(
    '/people/:personId/performance/overall',
    { preHandler: requireRole('viewer') },
    async (req) => {
      const { personId } = req.params as { personId: string };
      const q = req.query as { from?: string; to?: string };
      return performanceService.overall(req.orgId, personId, req.userId, req.role, q.from, q.to);
    }
  );

  app.get(
    '/people/:personId/performance/trend',
    { preHandler: requireRole('viewer') },
    async (req) => {
      const { personId } = req.params as { personId: string };
      const q = req.query as { bucket?: string };
      const bucket = q.bucket === 'quarter' ? 'quarter' : 'month';
      return performanceService.trend(req.orgId, personId, req.userId, req.role, bucket);
    }
  );

  app.get(
    '/people/:personId/performance/categories',
    { preHandler: requireRole('viewer') },
    async (req) => {
      const { personId } = req.params as { personId: string };
      const q = req.query as { customerId?: string; projectId?: string };
      return performanceService.categoryBreakdown(req.orgId, personId, req.userId, req.role, {
        customerId: q.customerId || null,
        projectId: q.projectId || null,
      });
    }
  );
};
