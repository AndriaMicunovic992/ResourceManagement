import { FastifyPluginAsync } from 'fastify';
import { taxonomyService } from '../services/taxonomy.service.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  createDomainSchema,
  updateDomainSchema,
  createRoleSchema,
  updateRoleSchema,
  createSenioritySchema,
  updateSenioritySchema,
  moveSenioritySchema,
} from '../schemas/taxonomy.schema.js';

export const taxonomyRoutes: FastifyPluginAsync = async (app) => {
  // Everyone authed needs the taxonomy (colors, labels, ordering).
  app.get('/taxonomy', { preHandler: requireRole('viewer') }, async (req) => {
    return taxonomyService.get(req.orgId);
  });

  // --- Domains (admin only) ---
  app.post('/taxonomy/domains', { preHandler: requireRole('admin') }, async (req) => {
    const data = createDomainSchema.parse(req.body);
    return taxonomyService.createDomain(req.orgId, data);
  });

  app.patch('/taxonomy/domains/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateDomainSchema.parse(req.body);
    return taxonomyService.updateDomain(req.orgId, id, data);
  });

  app.delete('/taxonomy/domains/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    return taxonomyService.deleteDomain(req.orgId, id);
  });

  // --- Job roles (admin only) ---
  app.post('/taxonomy/domains/:id/roles', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = createRoleSchema.parse(req.body);
    return taxonomyService.createRole(req.orgId, id, data.name);
  });

  app.patch('/taxonomy/roles/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateRoleSchema.parse(req.body);
    return taxonomyService.updateRole(req.orgId, id, data.name);
  });

  app.delete('/taxonomy/roles/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    return taxonomyService.deleteRole(req.orgId, id);
  });

  // --- Seniorities (admin only) ---
  app.post('/taxonomy/seniorities', { preHandler: requireRole('admin') }, async (req) => {
    const data = createSenioritySchema.parse(req.body);
    return taxonomyService.createSeniority(req.orgId, data);
  });

  app.patch('/taxonomy/seniorities/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateSenioritySchema.parse(req.body);
    return taxonomyService.updateSeniority(req.orgId, id, data);
  });

  app.post('/taxonomy/seniorities/:id/move', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = moveSenioritySchema.parse(req.body);
    return taxonomyService.moveSeniority(req.orgId, id, data.direction);
  });

  app.delete('/taxonomy/seniorities/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    return taxonomyService.deleteSeniority(req.orgId, id);
  });
};
