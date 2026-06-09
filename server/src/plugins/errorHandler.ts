import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { NotFoundError, ForbiddenError, UnauthorizedError, ConflictError, BadRequestError } from '../utils/errors.js';

export default fp(async (app) => {
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Validation failed', issues: error.issues });
    }
    if (error instanceof NotFoundError) return reply.status(404).send({ error: error.message });
    if (error instanceof BadRequestError) return reply.status(400).send({ error: error.message });
    if (error instanceof ForbiddenError) return reply.status(403).send({ error: error.message });
    if (error instanceof UnauthorizedError) return reply.status(401).send({ error: error.message });
    if (error instanceof ConflictError) return reply.status(409).send({ error: error.message });

    // Unexpected error. Log the full detail server-side, but never echo raw
    // internal/Prisma messages back to the client. The one exception is the
    // missing-DATABASE_URL hint, which is actionable for whoever deploys.
    req.log.error(error);
    const message = error.message?.includes('DATABASE_URL')
      ? 'Database not configured. Set DATABASE_URL in Railway environment variables.'
      : 'Internal server error';
    return reply.status(500).send({ error: message });
  });
});
