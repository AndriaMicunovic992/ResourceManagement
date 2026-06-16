import { FastifyPluginAsync } from 'fastify';
import { integrationService } from '../services/integration.service.js';
import { requireRole } from '../middleware/requireRole.js';
import { assertCanViewCustomer, assertCanViewPerson } from '../services/visibility.service.js';
import { BadRequestError } from '../utils/errors.js';
import {
  saveConnectionSchema,
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
  app.post('/integration/tempo/sync', { preHandler: requireRole('admin') }, async (req) => {
    const { updatedFrom } = syncHoursSchema.parse(req.body);
    return integrationService.syncHours(req.orgId, updatedFrom);
  });

  // Actual hours per person for a customer + month (feeds the review cockpit).
  // Not admin-only — visibility-gated on the customer, like other read endpoints.
  app.get('/integration/tempo/actuals', async (req) => {
    const { customerId, month } = req.query as { customerId?: string; month?: string };
    if (!customerId || !month) throw new BadRequestError('customerId and month are required');
    assertCanViewCustomer(req.visibility, customerId);
    return integrationService.actualsForCustomerMonth(req.orgId, customerId, month);
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

  // Actual hours per customer per month — scoped to visible customers. Feeds the
  // client-staffing heatmap and the PM-review chart.
  app.get('/integration/tempo/actuals/monthly-by-customer', async (req) => {
    const q = req.query as { from?: string; to?: string };
    const cur = new Date().toISOString().slice(0, 7);
    const from = /^\d{4}-\d{2}$/.test(q.from || '') ? q.from! : cur;
    const to = /^\d{4}-\d{2}$/.test(q.to || '') ? q.to! : cur;
    const v = req.visibility;
    const visibleIds = v.isAdmin ? null : [...v.visibleCustomerIds];
    return integrationService.actualsByCustomer(req.orgId, from, to, visibleIds);
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
    return integrationService.actualsForResourceByCustomer(req.orgId, q.resourceId, from, to);
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
    return integrationService.actualsForCustomerByResource(req.orgId, q.customerId, from, to);
  });

  app.get('/integration/jira/work-items', { preHandler: requireRole('admin') }, async (req) => {
    return integrationService.listWorkItems(req.orgId);
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
