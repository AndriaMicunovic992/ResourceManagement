import { FastifyPluginAsync, FastifyReply } from 'fastify';
import { microsoftService, SsoTransaction } from '../services/microsoft.service.js';
import { config } from '../config.js';

// The OAuth state/nonce travels in a short-lived, JWT-signed cookie instead of
// server memory, so the round-trip survives restarts/redeploys and works with
// multiple replicas.
const TXN_COOKIE = 'databob_ms_auth';

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
  function setTxnCookie(reply: FastifyReply, txn: SsoTransaction) {
    const value = app.jwt.sign({ txn }, { expiresIn: '10m' });
    reply.setCookie(TXN_COOKIE, value, {
      path: '/',
      httpOnly: true,
      secure: config.isProd,
      // Lax: still sent on the top-level redirect back from Microsoft.
      sameSite: 'lax',
      maxAge: 600,
    });
  }

  function readTxnCookie(req: { cookies: Record<string, string | undefined> }): SsoTransaction | null {
    const raw = req.cookies[TXN_COOKIE];
    if (!raw) return null;
    try {
      return app.jwt.verify<{ txn: SsoTransaction }>(raw).txn;
    } catch {
      return null;
    }
  }

  app.get('/auth/microsoft/login', async (req, reply) => {
    if (!microsoftService.isEnabled()) {
      return reply.redirect(clientRedirect({ error: 'sso_disabled' }));
    }
    const { url, txn } = microsoftService.beginLogin();
    setTxnCookie(reply, txn);
    return reply.redirect(url);
  });

  app.get('/auth/microsoft/callback', async (req, reply) => {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
    reply.clearCookie(TXN_COOKIE, { path: '/' });
    if (error) return reply.redirect(clientRedirect({ error }));

    try {
      const txn = readTxnCookie(req);
      if (!txn || !state || txn.state !== state) {
        throw new Error('Invalid or expired sign-in state');
      }
      const result = await microsoftService.completeLogin(code, txn);
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
  // The Set-Cookie on this fetch response is stored by the browser before the
  // client navigates to the returned URL.
  app.post('/auth/microsoft/link', async (req, reply) => {
    const { url, txn } = microsoftService.beginLogin(req.userId);
    setTxnCookie(reply, txn);
    return { url };
  });
};
