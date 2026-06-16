import { prisma } from '../db/prisma.js';
import { Prisma } from '@prisma/client';
import { SYSTEM_ROLES, SEGMENTS, SCOPES, normalizeMatrix, systemRoleDef } from '../lib/permissions.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';

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

// owner & admin matrices are locked at full access — editing them risks an
// admin locking themselves (or everyone) out of org administration.
const LOCKED_KEYS = new Set(['owner', 'admin']);

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'role';
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

  /** Create a custom role, copying its starting matrix + level from a base role. */
  async create(orgId: string, input: { name: string; baseKey?: string }) {
    const name = input.name.trim();
    if (!name) throw new BadRequestError('Role name is required');
    const base = systemRoleDef(input.baseKey || 'member') ?? systemRoleDef('member')!;
    // Custom roles can never be owner-level (4) — that rank is reserved.
    const level = Math.min(base.level, 3);

    let key = slugify(name);
    const existing = await prisma.role.findMany({ where: { orgId }, select: { key: true } });
    const taken = new Set(existing.map((r) => r.key));
    if (taken.has(key)) {
      let i = 2;
      while (taken.has(`${key}-${i}`)) i++;
      key = `${key}-${i}`;
    }

    const role = await prisma.role.create({
      data: {
        orgId,
        key,
        name,
        level,
        isSystem: false,
        permissions: base.permissions as unknown as Prisma.InputJsonValue,
      },
    });
    return { ...role, permissions: normalizeMatrix(role.permissions) };
  },

  async update(
    orgId: string,
    id: string,
    input: { name?: string; permissions?: unknown; level?: number }
  ) {
    const role = await prisma.role.findFirst({ where: { id, orgId } });
    if (!role) throw new NotFoundError('Role not found');
    if (LOCKED_KEYS.has(role.key)) {
      throw new ForbiddenError('The owner and admin roles always have full access and can’t be edited');
    }

    const data: Prisma.RoleUpdateInput = {};
    if (input.name !== undefined && !role.isSystem) {
      const name = input.name.trim();
      if (!name) throw new BadRequestError('Role name is required');
      data.name = name;
    }
    if (input.permissions !== undefined) {
      data.permissions = normalizeMatrix(input.permissions) as unknown as Prisma.InputJsonValue;
    }
    if (input.level !== undefined && !role.isSystem) {
      data.level = Math.max(1, Math.min(3, Math.round(input.level)));
    }

    const updated = await prisma.role.update({ where: { id }, data });
    return { ...updated, permissions: normalizeMatrix(updated.permissions) };
  },

  async remove(orgId: string, id: string) {
    const role = await prisma.role.findFirst({ where: { id, orgId } });
    if (!role) throw new NotFoundError('Role not found');
    if (role.isSystem) throw new ForbiddenError('System roles can’t be deleted');
    const inUse = await prisma.orgMember.count({ where: { orgId, role: role.key } });
    if (inUse > 0) {
      throw new BadRequestError(
        `This role is assigned to ${inUse} member${inUse === 1 ? '' : 's'}. Reassign them first.`
      );
    }
    await prisma.role.delete({ where: { id } });
  },

  /** True if `key` is a real role in this org (gates member role assignment). */
  async exists(orgId: string, key: string): Promise<boolean> {
    const r = await prisma.role.findUnique({ where: { orgId_key: { orgId, key } } });
    return !!r;
  },
};
