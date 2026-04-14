import { FastifyPluginAsync } from 'fastify';
import { resourceService } from '../services/resource.service.js';
import { createResourceSchema, updateResourceSchema } from '../schemas/resource.schema.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  assertCanViewPerson,
  assertNoViewerResources,
} from '../services/visibility.service.js';
import { NotFoundError } from '../utils/errors.js';

export const resourceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/resources', async (req) => {
    const list = await resourceService.list(req.orgId);
    if (req.visibility.isAdmin) return list;
    return list.filter((r) => req.visibility.visiblePersonIds.has(r.id));
  });

  app.get('/resources/:id', async (req) => {
    const { id } = req.params as { id: string };
    assertCanViewPerson(req.visibility, id);
    const resource = await resourceService.getById(req.orgId, id);
    if (!resource) throw new NotFoundError('Resource not found');
    return resource;
  });

  app.get('/me/resource', async (req) => {
    return resourceService.getByUserId(req.orgId, req.userId);
  });

  app.get('/me/visibility', async (req) => {
    const v = req.visibility;
    return {
      role: v.role,
      isAdmin: v.isAdmin,
      selfResourceId: v.selfResourceId,
      managedPersonIds: [...v.managedPersonIds],
      responsibleCustomerIds: [...v.responsibleCustomerIds],
      responsibleProjectIds: [...v.responsibleProjectIds],
      visiblePersonIds: [...v.visiblePersonIds],
      visibleCustomerIds: [...v.visibleCustomerIds],
      visibleProjectIds: [...v.visibleProjectIds],
    };
  });

  app.post('/resources', { preHandler: requireRole('admin') }, async (req) => {
    const data = createResourceSchema.parse(req.body);
    if (data.directManagerIds && data.directManagerIds.length > 0) {
      await assertNoViewerResources(req.orgId, data.directManagerIds);
    }
    return resourceService.create(req.orgId, data);
  });

  app.patch('/resources/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateResourceSchema.parse(req.body);
    if (data.directManagerIds && data.directManagerIds.length > 0) {
      await assertNoViewerResources(req.orgId, data.directManagerIds);
    }
    return resourceService.update(req.orgId, id, data);
  });

  app.delete('/resources/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await resourceService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
