import { FastifyPluginAsync } from 'fastify';
import { requireRole } from '../middleware/requireRole.js';
import { handleInboundActivity, sendTestMessage } from '../services/teamsTransport.js';
import { installForAllUsers } from '../services/teamsGraph.js';
import { runReminderPush } from '../services/teamsReminderPush.js';

export const teamsRoutes: FastifyPluginAsync = async (app) => {
  // The bot's messaging endpoint. Public (see PUBLIC_PATHS in plugins/auth.ts) —
  // Bot Framework authenticates it with its own bearer token, which the handler
  // verifies against the Bot Framework signing keys. Answer 200 on success so
  // the Connector doesn't retry; 401 when the token is missing/invalid.
  app.post('/teams/messages', async (req, reply) => {
    try {
      const ok = await handleInboundActivity(req.body, req.headers.authorization);
      if (!ok) return reply.status(401).send({ error: 'Unauthorized' });
      return reply.status(200).send({});
    } catch (err) {
      req.log.warn({ err }, 'rejected Teams inbound activity');
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // Admin: send a labelled test DM to yourself (proves end-to-end delivery).
  app.post('/integration/teams/test-message', { preHandler: requireRole('admin') }, async (req) => {
    return sendTestMessage(req.orgId, req.userId);
  });

  // Admin: install the app for every Microsoft-linked member via Graph, so
  // nobody has to add it themselves (registers each person's conversation).
  app.post('/integration/teams/install-all', { preHandler: requireRole('admin') }, async (req) => {
    return installForAllUsers(req.orgId);
  });

  // Admin: run the daily reminder push for this org right now (ignores the
  // time-of-day gate) — real due reminders, so you can verify without waiting.
  app.post('/integration/teams/push-now', { preHandler: requireRole('admin') }, async (req) => {
    return runReminderPush({ now: new Date(), orgId: req.orgId, force: true });
  });
};
