import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
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

  // Serve static files in production
  const publicDir = path.join(__dirname, '..', 'public');
  try {
    const fastifyStatic = await import('@fastify/static');
    await app.register(fastifyStatic.default, {
      root: publicDir,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.status(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  } catch {
    // Static files not available in dev mode
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
