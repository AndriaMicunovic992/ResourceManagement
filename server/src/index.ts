import Fastify from 'fastify';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import corsPlugin from './plugins/cors.js';
import jwtPlugin from './plugins/jwt.js';
import authPlugin from './plugins/auth.js';
import errorPlugin from './plugins/errorHandler.js';
import { routes } from './routes/index.js';
import { prisma } from './db/prisma.js';
import { startScheduler } from './services/scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function start() {
  const app = Fastify({ logger: true });

  // Register plugins
  await app.register(corsPlugin);
  // Rate limiting is opt-in per route (global: false); auth endpoints set their
  // own limits. Keeps planner/data endpoints unthrottled while protecting login.
  await app.register(rateLimit, { global: false });
  // Used only for the Microsoft SSO round-trip cookie (value is a signed JWT,
  // so no cookie-level signing needed).
  await app.register(cookie);
  await app.register(jwtPlugin);
  await app.register(authPlugin);
  await app.register(errorPlugin);

  // Register API routes under /api prefix
  await app.register(routes, { prefix: '/api' });

  // Serve static files in production (if public/ dir exists)
  const publicDir = path.join(__dirname, '..', 'public');
  if (fs.existsSync(publicDir)) {
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback — serve index.html for non-API routes
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.status(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });

  // Background scheduler (daily Jira/Tempo auto-sync). Started after listen so a
  // scheduler hiccup can't keep the server from coming up.
  const stopScheduler = startScheduler(app.log);

  // Graceful shutdown: drain in-flight requests and close the DB pool so the
  // platform (e.g. Railway sending SIGTERM on redeploy) doesn't kill us mid-query.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`Received ${signal}, shutting down...`);
    try {
      stopScheduler();
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => shutdown(signal));
  }
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
