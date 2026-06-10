import { FastifyPluginAsync } from 'fastify';
import { microsoftService } from '../services/microsoft.service.js';
import { config } from '../config.js';

// Bounce the browser back to the SPA, passing the result in the URL fragment so
// the token never lands in server logs, the Referer header, or browser history.
function clientRedirect(params: Record<string, string>): string {
  const frag = new URLSearchParams(params).toString();
  return `${config.clientUrl}/auth/callback#${frag}`;
}

// Map a thrown error to a coarse, non-sensitive reason code shown on the login
// page. The full error is logged server-side for the operator.
function reasonFor(e: unknown): string {
  const msg = (e instanceof Error && e.message) || '';
  if (msg === 'no_access') return 'no_access';
  if (msg.includes('expired sign-in state') || msg.includes('Missing code')) return 'sso_expired';
  if (msg.includes('restricted to your organization')) return 'sso_tenant';
  if (msg.includes('Token exchange') || msg.includes('id_token') || msg.includes('not configured')) return 'sso_exchange';
  if (msg.includes('already linked')) return 'sso_link_conflict';
  // jose verification failures (issuer / audience / signature / nonce).
  return 'sso_verify';
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
      const result = await microsoftService.completeLogin(code, state);
      if (result.kind === 'linked') {
        // Account linking: the user's existing session token is untouched —
        // just send them back to the app with a success marker.
        return reply.redirect(clientRedirect({ linked: '1' }));
      }
      const token = app.jwt.sign(
        { userId: result.userId, orgId: result.orgId },
        { expiresIn: config.tokenTtl }
      );
      return reply.redirect(clientRedirect({ token }));
    } catch (e) {
      req.log.error({ err: e, scope: 'microsoft-callback' }, 'Microsoft sign-in failed');
      return reply.redirect(clientRedirect({ error: reasonFor(e) }));
    }
  });

  // Authenticated (not in the auth plugin's public list): start a round-trip
  // that attaches the caller's Microsoft identity to their existing account, so
  // people who predate SSO can switch without depending on email matching.
  app.post('/auth/microsoft/link', async (req) => {
    return { url: microsoftService.beginLogin(req.userId) };
  });
};
