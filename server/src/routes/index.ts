import { FastifyPluginAsync } from 'fastify';
import { authRoutes } from './auth.routes.js';
import { orgRoutes } from './org.routes.js';
import { customerRoutes } from './customer.routes.js';
import { projectRoutes } from './project.routes.js';
import { resourceRoutes } from './resource.routes.js';
import { teamRoutes } from './team.routes.js';
import { skillRoutes } from './skill.routes.js';
import { personSkillRoutes } from './personSkill.routes.js';
import { needRoutes } from './need.routes.js';
import { assignmentRoutes } from './assignment.routes.js';

export const routes: FastifyPluginAsync = async (app) => {
  await app.register(authRoutes);
  await app.register(orgRoutes);
  await app.register(customerRoutes);
  await app.register(projectRoutes);
  await app.register(resourceRoutes);
  await app.register(teamRoutes);
  await app.register(skillRoutes);
  await app.register(personSkillRoutes);
  await app.register(needRoutes);
  await app.register(assignmentRoutes);

  app.get('/health', async () => {
    const dbOk = !!process.env.DATABASE_URL;
    return { status: 'ok', database: dbOk ? 'configured' : 'NOT CONFIGURED' };
  });
};
