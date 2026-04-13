import { FastifyPluginAsync } from 'fastify';
import { personSkillService } from '../services/personSkill.service.js';
import {
  upsertPersonSkillSchema,
  updatePersonSkillSchema,
} from '../schemas/personSkill.schema.js';
import { requireRole } from '../middleware/requireRole.js';

export const personSkillRoutes: FastifyPluginAsync = async (app) => {
  app.get('/person-skills', async (req) => {
    return personSkillService.list(req.orgId);
  });

  app.post('/person-skills', { preHandler: requireRole('member') }, async (req) => {
    const data = upsertPersonSkillSchema.parse(req.body);
    return personSkillService.upsert(req.orgId, data);
  });

  app.patch('/person-skills/:id', { preHandler: requireRole('member') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updatePersonSkillSchema.parse(req.body);
    return personSkillService.update(req.orgId, id, data);
  });

  app.delete('/person-skills/:id', { preHandler: requireRole('member') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await personSkillService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
