import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { config } from '../config.js';

export default fp(async (app) => {
  const configured = process.env.CORS_ORIGIN;
  // In production the SPA is served from the same origin, so CORS defaults to
  // same-origin only (origin:false). Set CORS_ORIGIN (comma-separated) to allow
  // specific cross-origin callers. Dev reflects the request origin so the Vite
  // dev server on :5173 can call the API.
  const origin = configured
    ? configured.split(',').map((s) => s.trim())
    : config.isProd
      ? false
      : true;
  await app.register(cors, { origin, credentials: true });
});
