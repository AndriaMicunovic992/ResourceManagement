import { FastifyPluginAsync } from 'fastify';
import { personSkillService } from '../services/personSkill.service.js';
import {
  upsertPersonSkillSchema,
  updatePersonSkillSchema,
} from '../schemas/personSkill.schema.js';
import { requireRole } from '../middleware/requireRole.js';

export const personSkillRoutes: FastifyPluginAsync = async (app) => {
  app.get('/person-skills', async (req) => {
    const list = await personSkillService.list(req.orgId);
    if (req.visibility.isAdmin) return list;
    return list.filter((ps) => req.visibility.visiblePersonIds.has(ps.resourceId));
  });

  app.post('/person-skills', { preHandler: requireRole('admin') }, async (req) => {
    const data = upsertPersonSkillSchema.parse(req.body);
    return personSkillService.upsert(req.orgId, data);
  });

  app.patch('/person-skills/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updatePersonSkillSchema.parse(req.body);
    return personSkillService.update(req.orgId, id, data);
  });

  app.delete('/person-skills/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await personSkillService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
