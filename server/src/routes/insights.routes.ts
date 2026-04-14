import { FastifyPluginAsync } from 'fastify';
import {
  insightsFilterQuerySchema,
  insightsTrendQuerySchema,
} from '../schemas/insights.schema.js';
import { performanceService } from '../services/performance.service.js';
import { ForbiddenError } from '../utils/errors.js';

/**
 * Insights are available to admins (org-wide) and members (scoped to their
 * visiblePersonIds). Viewers get a 403 — the UI hides the tab anyway.
 */
function restrictSet(req: { visibility: { isAdmin: boolean; role: string; visiblePersonIds: Set<string> } }) {
  if (req.visibility.isAdmin) return undefined;
  if (req.visibility.role === 'viewer') {
    throw new ForbiddenError('Insights are not available for viewers');
  }
  return req.visibility.visiblePersonIds;
}

export const insightsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/insights/performance/summary', async (req) => {
    const q = insightsFilterQuerySchema.parse(req.query ?? {});
    return performanceService.orgSummary(req.orgId, q, restrictSet(req));
  });

  app.get('/insights/performance/distribution', async (req) => {
    const q = insightsFilterQuerySchema.parse(req.query ?? {});
    return performanceService.orgDistribution(req.orgId, q, restrictSet(req));
  });

  app.get('/insights/performance/categories', async (req) => {
    const q = insightsFilterQuerySchema.parse(req.query ?? {});
    return performanceService.orgCategoryBreakdown(req.orgId, q, restrictSet(req));
  });

  app.get('/insights/performance/heatmap', async (req) => {
    const q = insightsFilterQuerySchema.parse(req.query ?? {});
    return performanceService.orgCategoryHeatmap(req.orgId, q, restrictSet(req));
  });

  app.get('/insights/performance/trend', async (req) => {
    const q = insightsTrendQuerySchema.parse(req.query ?? {});
    const bucket = q.bucket === 'quarter' ? 'quarter' : 'month';
    return performanceService.orgTrend(req.orgId, q, bucket, restrictSet(req));
  });

  app.get('/insights/performance/people', async (req) => {
    const q = insightsFilterQuerySchema.parse(req.query ?? {});
    return performanceService.orgPeopleList(req.orgId, q, restrictSet(req));
  });
};
