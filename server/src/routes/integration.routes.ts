import { FastifyPluginAsync } from 'fastify';
import { integrationService } from '../services/integration.service.js';
import { requireRole } from '../middleware/requireRole.js';
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
    const { from, to } = syncHoursSchema.parse(req.body);
    return integrationService.syncHours(req.orgId, from, to);
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
