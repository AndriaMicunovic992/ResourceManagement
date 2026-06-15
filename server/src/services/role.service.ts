import { prisma } from '../db/prisma.js';
import { Prisma } from '@prisma/client';
import { SYSTEM_ROLES, SEGMENTS, SCOPES, normalizeMatrix } from '../lib/permissions.js';

/**
 * Idempotently ensure the four system roles exist for an org. Existing rows are
 * left untouched (so admin tweaks to a system role's matrix survive).
 */
export async function ensureSystemRoles(orgId: string): Promise<void> {
  for (const def of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { orgId_key: { orgId, key: def.key } },
      update: {},
      create: {
        orgId,
        key: def.key,
        name: def.name,
        level: def.level,
        isSystem: true,
        permissions: def.permissions as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

export const roleService = {
  /** All roles for an org (system roles seeded on demand), highest level first. */
  async list(orgId: string) {
    await ensureSystemRoles(orgId);
    const roles = await prisma.role.findMany({
      where: { orgId },
      orderBy: [{ level: 'desc' }, { name: 'asc' }],
    });
    return roles.map((r) => ({ ...r, permissions: normalizeMatrix(r.permissions) }));
  },

  /** Static description of the matrix shape, for the client to render generically. */
  schema() {
    return { segments: SEGMENTS, scopes: SCOPES };
  },
};
