import 'fastify';
import type { VisibilityScope } from '../services/visibility.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    orgId: string;
    role: string;
    visibility: VisibilityScope;
  }
}
