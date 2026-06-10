import { FastifyPluginAsync } from 'fastify';
import { microsoftService } from '../services/microsoft.service.js';
import { config } from '../config.js';

// Bounce the browser back to the SPA, passing the result in the URL fragment so
// the token never lands in server logs, the Referer header, or browser history.
function clientRedirect(params: Record<string, string>): string {
  const frag = new URLSearchParams(params).toString();
  return `${config.clientUrl}/auth/callback#${frag}`;
}

export const microsoftAuthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/auth/microsoft/login', async (req, reply) => {
    if (!microsoftService.isEnabled()) {
      return reply.redirect(clientRedirect({ error: 'sso_disabled' }));
    }
    return reply.redirect(microsoftService.beginLogin());
  });

  app.get('/auth/microsoft/callback', async (req, reply) => {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
    if (error) return reply.redirect(clientRedirect({ error }));

    try {
      const { userId, orgId } = await microsoftService.completeLogin(code, state);
      const token = app.jwt.sign({ userId, orgId }, { expiresIn: config.tokenTtl });
      return reply.redirect(clientRedirect({ token }));
    } catch (e) {
      // "no_access" = authenticated but not invited; everything else is generic.
      const message = (e as Error).message === 'no_access' ? 'no_access' : 'sso_failed';
      req.log.error(e);
      return reply.redirect(clientRedirect({ error: message }));
    }
  });
};
