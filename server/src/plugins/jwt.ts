import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';

export default fp(async (app) => {
  await app.register(fjwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  });
});
