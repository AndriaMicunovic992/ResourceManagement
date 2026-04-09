import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { NotFoundError, ForbiddenError, UnauthorizedError, ConflictError } from '../utils/errors.js';

export default fp(async (app) => {
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Validation failed', issues: error.issues });
    }
    if (error instanceof NotFoundError) return reply.status(404).send({ error: error.message });
    if (error instanceof ForbiddenError) return reply.status(403).send({ error: error.message });
    if (error instanceof UnauthorizedError) return reply.status(401).send({ error: error.message });
    if (error instanceof ConflictError) return reply.status(409).send({ error: error.message });

    req.log.error(error);
    const message = error.message?.includes('DATABASE_URL')
      ? 'Database not configured. Set DATABASE_URL in Railway environment variables.'
      : error.message || 'Internal server error';
    return reply.status(500).send({ error: message });
  });
});
