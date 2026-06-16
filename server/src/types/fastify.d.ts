import 'fastify';
import type { VisibilityScope } from '../services/visibility.service.js';
import type { PermissionMatrix } from '../lib/permissions.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    orgId: string;
    role: string;
    // The role's legacy 1-4 rank and its full permission matrix, resolved per
    // request from the org's Role record.
    roleLevel: number;
    permissions: PermissionMatrix;
    visibility: VisibilityScope;
    // Set only while an admin is impersonating ("view as") another user: the id
    // of the real admin behind the session. Null for normal requests.
    impersonatorUserId: string | null;
  }
}
