import { FastifyPluginAsync } from 'fastify';
import { skillService } from '../services/skill.service.js';
import { createSkillSchema, updateSkillSchema } from '../schemas/skill.schema.js';
import { requireRole } from '../middleware/requireRole.js';

export const skillRoutes: FastifyPluginAsync = async (app) => {
  app.get('/skills', { preHandler: requireRole('viewer') }, async (req) => {
    return skillService.list(req.orgId);
  });

  app.post('/skills', { preHandler: requireRole('admin') }, async (req, reply) => {
    const data = createSkillSchema.parse(req.body);
    const created = await skillService.create(req.orgId, data);
    return reply.status(201).send(created);
  });

  app.patch('/skills/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateSkillSchema.parse(req.body);
    return skillService.update(req.orgId, id, data);
  });

  app.delete('/skills/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await skillService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
