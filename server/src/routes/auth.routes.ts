import { FastifyPluginAsync } from 'fastify';
import { authService } from '../services/auth.service.js';
import { signupSchema, loginSchema } from '../schemas/auth.schema.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/signup', async (req, reply) => {
    const data = signupSchema.parse(req.body);
    const result = await authService.signup(data);
    const token = app.jwt.sign({ userId: result.user.id, orgId: result.org.id });
    return { token, user: result.user, org: result.org };
  });

  app.post('/auth/login', async (req, reply) => {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);
    const token = app.jwt.sign({ userId: result.user.id, orgId: result.org.id });
    return { token, user: result.user, org: result.org, role: result.role };
  });

  app.get('/auth/me', async (req) => {
    return authService.getMe(req.userId, req.orgId);
  });
};
