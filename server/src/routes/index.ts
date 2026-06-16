import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/prisma.js';
import { authRoutes } from './auth.routes.js';
import { microsoftAuthRoutes } from './auth.microsoft.routes.js';
import { orgRoutes } from './org.routes.js';
import { roleRoutes } from './role.routes.js';
import { customerRoutes } from './customer.routes.js';
import { projectRoutes } from './project.routes.js';
import { resourceRoutes } from './resource.routes.js';
import { teamRoutes } from './team.routes.js';
import { skillRoutes } from './skill.routes.js';
import { personSkillRoutes } from './personSkill.routes.js';
import { oneOnOneRoutes } from './oneOnOne.routes.js';
import { logRoutes } from './log.routes.js';
import { peopleOpsRoutes } from './peopleOps.routes.js';
import { performanceLogCategoryRoutes } from './performanceLogCategory.routes.js';
import { needRoutes } from './need.routes.js';
import { assignmentRoutes } from './assignment.routes.js';
import { evaluationRoutes } from './evaluation.routes.js';
import { insightsRoutes } from './insights.routes.js';
import { taxonomyRoutes } from './taxonomy.routes.js';

export const routes: FastifyPluginAsync = async (app) => {
  await app.register(authRoutes);
  await app.register(microsoftAuthRoutes);
  await app.register(orgRoutes);
  await app.register(roleRoutes);
  await app.register(taxonomyRoutes);
  await app.register(customerRoutes);
  await app.register(projectRoutes);
  await app.register(resourceRoutes);
  await app.register(teamRoutes);
  await app.register(skillRoutes);
  await app.register(personSkillRoutes);
  await app.register(oneOnOneRoutes);
  await app.register(logRoutes);
  await app.register(peopleOpsRoutes);
  await app.register(performanceLogCategoryRoutes);
  await app.register(needRoutes);
  await app.register(assignmentRoutes);
  await app.register(evaluationRoutes);
  await app.register(insightsRoutes);

  // Health check actually pings the database — a configured-but-unreachable DB
  // should fail the check so the platform doesn't route traffic to a broken app.
  app.get('/health', async (req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch (err) {
      req.log.error(err);
      return reply.status(503).send({ status: 'unhealthy', database: 'disconnected' });
    }
  });
};
