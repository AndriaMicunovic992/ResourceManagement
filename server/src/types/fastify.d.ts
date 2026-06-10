import 'fastify';
import type { VisibilityScope } from '../services/visibility.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    orgId: string;
    role: string;
    visibility: VisibilityScope;
    // Set only while an admin is impersonating ("view as") another user: the id
    // of the real admin behind the session. Null for normal requests.
    impersonatorUserId: string | null;
  }
}
