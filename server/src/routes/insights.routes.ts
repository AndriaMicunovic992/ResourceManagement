import { FastifyPluginAsync } from 'fastify';
import { requireRole } from '../middleware/requireRole.js';
import {
  insightsFilterQuerySchema,
  insightsTrendQuerySchema,
} from '../schemas/insights.schema.js';
import { performanceService } from '../services/performance.service.js';

export const insightsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/insights/performance/summary',
    { preHandler: requireRole('admin') },
    async (req) => {
      const q = insightsFilterQuerySchema.parse(req.query ?? {});
      return performanceService.orgSummary(req.orgId, q);
    }
  );

  app.get(
    '/insights/performance/distribution',
    { preHandler: requireRole('admin') },
    async (req) => {
      const q = insightsFilterQuerySchema.parse(req.query ?? {});
      return performanceService.orgDistribution(req.orgId, q);
    }
  );

  app.get(
    '/insights/performance/categories',
    { preHandler: requireRole('admin') },
    async (req) => {
      const q = insightsFilterQuerySchema.parse(req.query ?? {});
      return performanceService.orgCategoryBreakdown(req.orgId, q);
    }
  );

  app.get(
    '/insights/performance/heatmap',
    { preHandler: requireRole('admin') },
    async (req) => {
      const q = insightsFilterQuerySchema.parse(req.query ?? {});
      return performanceService.orgCategoryHeatmap(req.orgId, q);
    }
  );

  app.get(
    '/insights/performance/trend',
    { preHandler: requireRole('admin') },
    async (req) => {
      const q = insightsTrendQuerySchema.parse(req.query ?? {});
      const bucket = q.bucket === 'quarter' ? 'quarter' : 'month';
      return performanceService.orgTrend(req.orgId, q, bucket);
    }
  );

  app.get(
    '/insights/performance/people',
    { preHandler: requireRole('admin') },
    async (req) => {
      const q = insightsFilterQuerySchema.parse(req.query ?? {});
      return performanceService.orgPeopleList(req.orgId, q);
    }
  );
};
