import { FastifyPluginAsync } from 'fastify';
import { authService } from '../services/auth.service.js';
import { orgService } from '../services/org.service.js';
import { microsoftService } from '../services/microsoft.service.js';
import { signupSchema, loginSchema, impersonateSchema } from '../schemas/auth.schema.js';
import { requireRole } from '../middleware/requireRole.js';
import { ForbiddenError, BadRequestError } from '../utils/errors.js';
import { config } from '../config.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Public: lets the login page show only the sign-in methods that are enabled.
  app.get('/auth/config', async () => {
    return {
      microsoftEnabled: microsoftService.isEnabled(),
      localAuthEnabled: config.localAuthEnabled,
    };
  });

  app.post(
    '/auth/signup',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req) => {
      if (!config.localAuthEnabled) throw new ForbiddenError('Local sign-up is disabled');
      const data = signupSchema.parse(req.body);
      const result = await authService.signup(data);
      const token = app.jwt.sign(
        { userId: result.user.id, orgId: result.org.id },
        { expiresIn: config.tokenTtl }
      );
      return { token, user: result.user, org: result.org };
    }
  );

  app.post(
    '/auth/login',
    // Throttle credential stuffing / brute force.
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req) => {
      if (!config.localAuthEnabled) throw new ForbiddenError('Local sign-in is disabled');
      const data = loginSchema.parse(req.body);
      const result = await authService.login(data);
      const token = app.jwt.sign(
        { userId: result.user.id, orgId: result.org.id },
        { expiresIn: config.tokenTtl }
      );
      return { token, user: result.user, org: result.org, role: result.role };
    }
  );

  app.get('/auth/me', async (req) => {
    const me = await authService.getMe(req.userId, req.orgId);
    return { ...me, impersonating: !!req.impersonatorUserId };
  });

  // Admin "view as": mint a short-lived, read-only token that sees exactly what
  // the target user sees. The real admin id rides along in the `imp` claim for
  // the audit trail and is enforced read-only by the auth hook.
  app.post(
    '/auth/impersonate',
    { preHandler: requireRole('admin'), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req) => {
      if (req.impersonatorUserId) {
        throw new BadRequestError('Already viewing as another user');
      }
      const { userId: targetId } = impersonateSchema.parse(req.body);
      if (targetId === req.userId) throw new BadRequestError('Cannot view as yourself');

      const target = await orgService.membershipFor(targetId, req.orgId);
      if (!target) throw new ForbiddenError('That user is not a member of this organization');

      const token = app.jwt.sign(
        { userId: targetId, orgId: req.orgId, imp: req.userId },
        { expiresIn: config.impersonationTtl }
      );
      const targetUser = await authService.getMe(targetId, req.orgId);
      return { token, target: { id: targetId, name: targetUser.user?.name ?? 'User', role: target.role } };
    }
  );
};
