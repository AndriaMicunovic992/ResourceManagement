import Fastify from 'fastify';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import fastifyStatic from '@fastify/static';
import corsPlugin from './plugins/cors.js';
import jwtPlugin from './plugins/jwt.js';
import authPlugin from './plugins/auth.js';
import errorPlugin from './plugins/errorHandler.js';
import { routes } from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function start() {
  const app = Fastify({ logger: true });

  // Register plugins
  await app.register(corsPlugin);
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
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
