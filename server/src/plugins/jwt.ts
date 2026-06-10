import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import { config } from '../config.js';

export default fp(async (app) => {
  let secret = config.jwtSecret;
  if (!secret) {
    if (config.isProd) {
      // Never sign tokens with a guessable default in production — that makes
      // every JWT forgeable. Fail fast instead.
      throw new Error(
        'JWT_SECRET must be set in production. Refusing to start with an insecure default.'
      );
    }
    app.log.warn(
      'JWT_SECRET not set — using an insecure development fallback. Never run this in production.'
    );
    secret = 'dev-secret-change-me';
  }
  await app.register(fjwt, { secret });
});
