import { FastifyPluginAsync } from 'fastify';
import { integrationService } from '../services/integration.service.js';
import { teamsService } from '../services/teams.service.js';
import { requireRole } from '../middleware/requireRole.js';
import { assertCanViewCustomer, assertCanViewPerson } from '../services/visibility.service.js';
import { BadRequestError } from '../utils/errors.js';
import {
  saveConnectionSchema,
  saveTeamsConnectionSchema,
  createWorkItemSchema,
  updateWorkItemSchema,
  syncHoursSchema,
} from '../schemas/integration.schema.js';

// All integration settings are admin-only. The connection endpoint never
// returns token plaintext — only whether each token is set.
export const integrationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/integration/jira', { preHandler: requireRole('admin') }, async (req) => {
    return integrationService.getConnection(req.orgId);
  });

  app.put('/integration/jira', { preHandler: requireRole('admin') }, async (req) => {
    const data = saveConnectionSchema.parse(req.body);
    return integrationService.saveConnection(req.orgId, data);
  });

  // Validate the stored credentials against Jira.
  app.post('/integration/jira/test', { preHandler: requireRole('admin') }, async (req) => {
    return integrationService.testConnection(req.orgId);
  });

  // Pull projects / epics / accounts from Jira into the local cache.
  app.post('/integration/jira/refresh', { preHandler: requireRole('admin') }, async (req) => {
    return integrationService.refreshFromJira(req.orgId);
  });

  // Pulled Jira accounts (the People-mapping "Account" dropdown).
  app.get('/integration/jira/accounts', { preHandler: requireRole('admin') }, async (req) => {
    return integrationService.listAccounts(req.orgId);
  });

  // Pull Tempo worklogs for a date range and resolve them through the mappings.
  // Rate-limited: a full sync is expensive (paginated Jira/Tempo calls + per-row
  // upserts), so cap how often it can be kicked off.
  app.post('/integration/tempo/sync', { preHandler: requireRole('admin'), config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (req) => {
    const { updatedFrom } = syncHoursSchema.parse(req.body);
    return integrationService.syncHours(req.orgId, updatedFrom);
  });

  // Microsoft Teams bot credentials (per-org, encrypted at rest). Like the Jira
  // connection, the secret is never returned — only whether one is stored.
  app.get('/integration/teams', { preHandler: requireRole('admin') }, async (req) => {
    return teamsService.getConnection(req.orgId);
  });

  app.put('/integration/teams', { preHandler: requireRole('admin') }, async (req) => {
    const data = saveTeamsConnectionSchema.parse(req.body);
    return teamsService.saveConnection(req.orgId, data);
  });

  // Validate the stored bot credentials against Microsoft Entra.
  app.post('/integration/teams/test', { preHandler: requireRole('admin') }, async (req) => {
    return teamsService.testConnection(req.orgId);
  });

  // Actual hours per person for a customer + month (feeds the review cockpit).
  // Not admin-only — visibility-gated on the customer, like other read endpoints.
  app.get('/integration/tempo/actuals', async (req) => {
    const { customerId, month } = req.query as { customerId?: string; month?: string };
    if (!customerId || !month) throw new BadRequestError('customerId and month are required');
    assertCanViewCustomer(req.visibility, customerId);
    const v = req.visibility;
    const visibleIds = v.isAdmin ? null : [...v.visiblePersonIds];
    return integrationService.actualsForCustomerMonth(req.orgId, customerId, month, visibleIds);
  });

  // Actual hours per person per month over a range — scoped to the caller's
  // visible people. Feeds the 1:1 cockpit, dashboard and insights.
  app.get('/integration/tempo/actuals/monthly', async (req) => {
    const q = req.query as { from?: string; to?: string };
    const cur = new Date().toISOString().slice(0, 7);
    const from = /^\d{4}-\d{2}$/.test(q.from || '') ? q.from! : cur;
    const to = /^\d{4}-\d{2}$/.test(q.to || '') ? q.to! : cur;
    const v = req.visibility;
    const visibleIds = v.isAdmin ? null : [...v.visiblePersonIds];
    return integrationService.actualsByResource(req.orgId, from, to, visibleIds);
  });

  // Actual hours per person per month per work type (client/internal/absence),
  // unfiltered — scoped to visible people. Feeds the people-capacity heatmap's
  // stacked bar, its work-type filter, and the per-person drill-down buckets.
  app.get('/integration/tempo/actuals/monthly-by-type', async (req) => {
    const q = req.query as { from?: string; to?: string };
    const cur = new Date().toISOString().slice(0, 7);
    const from = /^\d{4}-\d{2}$/.test(q.from || '') ? q.from! : cur;
    const to = /^\d{4}-\d{2}$/.test(q.to || '') ? q.to! : cur;
    const v = req.visibility;
    const visibleIds = v.isAdmin ? null : [...v.visiblePersonIds];
    return integrationService.actualsByResourceType(req.orgId, from, to, visibleIds);
  });

  // Org-wide logged hours per month split into client / unmapped / internal /
  // absence — the home dashboard's stacked bars. Scoped to visible people.
  app.get('/integration/tempo/actuals/monthly-work-buckets', async (req) => {
    const q = req.query as { from?: string; to?: string };
    const cur = new Date().toISOString().slice(0, 7);
    const from = /^\d{4}-\d{2}$/.test(q.from || '') ? q.from! : cur;
    const to = /^\d{4}-\d{2}$/.test(q.to || '') ? q.to! : cur;
    const v = req.visibility;
    const visibleIds = v.isAdmin ? null : [...v.visiblePersonIds];
    return integrationService.actualsWorkBuckets(req.orgId, from, to, visibleIds);
  });

  // Actual hours per customer per month — scoped to visible customers. Feeds the
  // client-staffing table and the PM-review chart. Optional teamId narrows the
  // hours to that team's people (the Insights team lens).
  app.get('/integration/tempo/actuals/monthly-by-customer', async (req) => {
    const q = req.query as { from?: string; to?: string; teamId?: string };
    const cur = new Date().toISOString().slice(0, 7);
    const from = /^\d{4}-\d{2}$/.test(q.from || '') ? q.from! : cur;
    const to = /^\d{4}-\d{2}$/.test(q.to || '') ? q.to! : cur;
    const v = req.visibility;
    const visibleIds = v.isAdmin ? null : [...v.visibleCustomerIds];
    const resourceIds = q.teamId ? await integrationService.resourceIdsForTeam(req.orgId, q.teamId) : null;
    return integrationService.actualsByCustomer(req.orgId, from, to, visibleIds, resourceIds);
  });

  // Actual hours per project per month — scoped to visible projects. Feeds the
  // client-staffing table's expanded project rows. Optional teamId as above.
  app.get('/integration/tempo/actuals/monthly-by-project', async (req) => {
    const q = req.query as { from?: string; to?: string; teamId?: string };
    const cur = new Date().toISOString().slice(0, 7);
    const from = /^\d{4}-\d{2}$/.test(q.from || '') ? q.from! : cur;
    const to = /^\d{4}-\d{2}$/.test(q.to || '') ? q.to! : cur;
    const v = req.visibility;
    const visibleIds = v.isAdmin ? null : [...v.visibleProjectIds];
    const resourceIds = q.teamId ? await integrationService.resourceIdsForTeam(req.orgId, q.teamId) : null;
    return integrationService.actualsByProject(req.orgId, from, to, visibleIds, resourceIds);
  });

  // Actual hours for one person, broken down by customer + month. Feeds the
  // 1:1 cockpit chart when a project (→ customer) is focused.
  app.get('/integration/tempo/actuals/resource-by-customer', async (req) => {
    const q = req.query as { resourceId?: string; from?: string; to?: string };
    if (!q.resourceId) throw new BadRequestError('resourceId is required');
    assertCanViewPerson(req.visibility, q.resourceId);
    const cur = new Date().toISOString().slice(0, 7);
    const from = /^\d{4}-\d{2}$/.test(q.from || '') ? q.from! : cur;
    const to = /^\d{4}-\d{2}$/.test(q.to || '') ? q.to! : cur;
    const v = req.visibility;
    const visibleCustomerIds = v.isAdmin ? null : [...v.visibleCustomerIds];
    return integrationService.actualsForResourceByCustomer(req.orgId, q.resourceId, from, to, visibleCustomerIds);
  });

  // A person's unmapped client hours grouped by Jira project — the drill-down's
  // per-project "not mapped" rows. Person-visibility gated like resource-by-customer.
  app.get('/integration/tempo/actuals/resource-unmapped', async (req) => {
    const q = req.query as { resourceId?: string; from?: string; to?: string };
    if (!q.resourceId) throw new BadRequestError('resourceId is required');
    assertCanViewPerson(req.visibility, q.resourceId);
    const cur = new Date().toISOString().slice(0, 7);
    const from = /^\d{4}-\d{2}$/.test(q.from || '') ? q.from! : cur;
    const to = /^\d{4}-\d{2}$/.test(q.to || '') ? q.to! : cur;
    return integrationService.actualsForResourceUnmapped(req.orgId, q.resourceId, from, to);
  });

  // A person's hours for one drill-down row (a customer, the internal/absence
  // buckets, or one unmapped Jira project) grouped by Jira epic → issue — the
  // heatmap's deeper drill levels. Actual hours only; no plan exists at this
  // depth. Person-visibility gated; a customer scope is additionally gated by
  // customer visibility.
  app.get('/integration/tempo/actuals/resource-epics', async (req) => {
    const q = req.query as { resourceId?: string; from?: string; to?: string; customerId?: string; bucket?: string; projectKey?: string };
    if (!q.resourceId) throw new BadRequestError('resourceId is required');
    assertCanViewPerson(req.visibility, q.resourceId);
    if (q.customerId) {
      assertCanViewCustomer(req.visibility, q.customerId);
    } else if (q.bucket !== 'internal' && q.bucket !== 'absence' && q.bucket !== 'unmapped') {
      throw new BadRequestError('Provide customerId or bucket=internal|absence|unmapped');
    }
    const cur = new Date().toISOString().slice(0, 7);
    const from = /^\d{4}-\d{2}$/.test(q.from || '') ? q.from! : cur;
    const to = /^\d{4}-\d{2}$/.test(q.to || '') ? q.to! : cur;
    const scope = q.customerId
      ? { customerId: q.customerId }
      : { bucket: q.bucket as 'internal' | 'absence' | 'unmapped', projectKey: q.projectKey };
    return integrationService.actualsForResourceEpics(req.orgId, q.resourceId, from, to, scope);
  });

  // A customer's hours grouped by Jira epic → issue → person — the
  // Client-Staffing drill. Actual hours only; optional teamId narrows to that
  // team's people. Customer-visibility gated like customer-by-resource, and
  // the person level names only people visible to the requester.
  app.get('/integration/tempo/actuals/customer-epics', async (req) => {
    const q = req.query as { customerId?: string; from?: string; to?: string; teamId?: string };
    if (!q.customerId) throw new BadRequestError('customerId is required');
    assertCanViewCustomer(req.visibility, q.customerId);
    const cur = new Date().toISOString().slice(0, 7);
    const from = /^\d{4}-\d{2}$/.test(q.from || '') ? q.from! : cur;
    const to = /^\d{4}-\d{2}$/.test(q.to || '') ? q.to! : cur;
    const resourceIds = q.teamId ? await integrationService.resourceIdsForTeam(req.orgId, q.teamId) : null;
    const v = req.visibility;
    const visiblePersonIds = v.isAdmin ? null : [...v.visiblePersonIds];
    return integrationService.actualsForCustomerEpics(req.orgId, q.customerId, from, to, resourceIds, visiblePersonIds);
  });

  // Actual hours for one customer, broken down by person + month. Feeds the
  // PM-review chart when a person is focused.
  app.get('/integration/tempo/actuals/customer-by-resource', async (req) => {
    const q = req.query as { customerId?: string; from?: string; to?: string };
    if (!q.customerId) throw new BadRequestError('customerId is required');
    assertCanViewCustomer(req.visibility, q.customerId);
    const cur = new Date().toISOString().slice(0, 7);
    const from = /^\d{4}-\d{2}$/.test(q.from || '') ? q.from! : cur;
    const to = /^\d{4}-\d{2}$/.test(q.to || '') ? q.to! : cur;
    const v = req.visibility;
    const visibleIds = v.isAdmin ? null : [...v.visiblePersonIds];
    return integrationService.actualsForCustomerByResource(req.orgId, q.customerId, from, to, visibleIds);
  });

  app.get('/integration/jira/work-items', { preHandler: requireRole('admin') }, async (req) => {
    return integrationService.listWorkItems(req.orgId);
  });

  // Re-attribute all stored worklogs through the current mappings, on demand.
  // Rate-limited like the sync — it's a full pass over the org's worklogs.
  app.post('/integration/jira/restamp', { preHandler: requireRole('admin'), config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (req) => {
    return integrationService.restampAll(req.orgId);
  });

  app.post('/integration/jira/work-items', { preHandler: requireRole('admin') }, async (req) => {
    const data = createWorkItemSchema.parse(req.body);
    return integrationService.createWorkItem(req.orgId, data);
  });

  app.patch('/integration/jira/work-items/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateWorkItemSchema.parse(req.body);
    return integrationService.updateWorkItem(req.orgId, id, data);
  });

  app.delete('/integration/jira/work-items/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    return integrationService.deleteWorkItem(req.orgId, id);
  });
};
