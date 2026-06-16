import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import type { CreateResourceInput, UpdateResourceInput } from '../schemas/resource.schema.js';

function makeResourceInclude(orgId: string) {
  return {
    roles: true,
    assignments: true,
    teams: true,
    personSkills: true,
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        memberships: {
          where: { orgId },
          select: { role: true },
        },
      },
    },
    managerLinks: {
      include: {
        managerUser: { select: { id: true, name: true } },
      },
    },
  } as const;
}

async function ensureUserInOrg(orgId: string, userId: string): Promise<void> {
  const member = await prisma.orgMember.findFirst({
    where: { orgId, userId },
  });
  if (!member) throw new NotFoundError('User is not a member of this organisation');
}

async function ensureTeamsInOrg(orgId: string, teamIds: string[]): Promise<void> {
  if (teamIds.length === 0) return;
  const count = await prisma.team.count({ where: { orgId, id: { in: teamIds } } });
  if (count !== teamIds.length) throw new NotFoundError('One or more teams not found');
}

async function ensureMembersInOrg(orgId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const count = await prisma.orgMember.count({ where: { orgId, userId: { in: userIds } } });
  if (count !== userIds.length) {
    throw new NotFoundError('One or more managers are not members of this organisation');
  }
}

async function setDirectManagers(orgId: string, personId: string, managerUserIds: string[]): Promise<void> {
  const unique = [...new Set(managerUserIds)];
  await ensureMembersInOrg(orgId, unique);
  await prisma.personManager.deleteMany({ where: { personId } });
  if (unique.length === 0) return;
  // A person can't manage themselves (via their own login user).
  const self = await prisma.resource.findUnique({
    where: { id: personId },
    select: { userId: true },
  });
  const filtered = unique.filter((uid) => uid !== self?.userId);
  if (filtered.length === 0) return;
  await prisma.personManager.createMany({
    data: filtered.map((managerUserId) => ({ personId, managerUserId, orgId })),
    skipDuplicates: true,
  });
}

export const resourceService = {
  async list(orgId: string) {
    return prisma.resource.findMany({
      where: { orgId },
      include: makeResourceInclude(orgId),
      orderBy: { createdAt: 'asc' },
    });
  },

  async getById(orgId: string, id: string) {
    const resource = await prisma.resource.findFirst({
      where: { id, orgId },
      include: makeResourceInclude(orgId),
    });
    if (!resource) throw new NotFoundError('Resource not found');
    return resource;
  },

  async getByUserId(orgId: string, userId: string) {
    return prisma.resource.findFirst({
      where: { orgId, userId },
      include: makeResourceInclude(orgId),
    });
  },

  async create(orgId: string, data: CreateResourceInput) {
    const { roles, userId, teamIds, directManagerUserIds, ...rest } = data;
    if (userId) await ensureUserInOrg(orgId, userId);
    if (teamIds && teamIds.length > 0) await ensureTeamsInOrg(orgId, teamIds);
    try {
      const created = await prisma.resource.create({
        data: {
          ...rest,
          orgId,
          userId: userId ?? null,
          roles: { create: roles },
          teams: teamIds && teamIds.length > 0 ? { connect: teamIds.map((id) => ({ id })) } : undefined,
        },
        include: makeResourceInclude(orgId),
      });
      if (directManagerUserIds && directManagerUserIds.length > 0) {
        await setDirectManagers(orgId, created.id, directManagerUserIds);
      }
      return this.getById(orgId, created.id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('This user is already linked to another resource');
      }
      throw err;
    }
  },

  async update(orgId: string, id: string, data: UpdateResourceInput) {
    await this.getById(orgId, id);
    const { roles, userId, teamIds, directManagerUserIds, ...rest } = data;

    if (userId) await ensureUserInOrg(orgId, userId);
    if (teamIds) await ensureTeamsInOrg(orgId, teamIds);

    if (roles) {
      await prisma.resourceRole.deleteMany({ where: { resourceId: id } });
      await prisma.resourceRole.createMany({
        data: roles.map((r) => ({ ...r, resourceId: id })),
      });
    }

    const patch: Prisma.ResourceUpdateInput = { ...rest };
    if (userId !== undefined) {
      patch.user = userId ? { connect: { id: userId } } : { disconnect: true };
    }
    if (teamIds !== undefined) {
      patch.teams = { set: teamIds.map((tid) => ({ id: tid })) };
    }

    try {
      await prisma.resource.update({
        where: { id },
        data: patch,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('This user is already linked to another resource');
      }
      throw err;
    }

    if (directManagerUserIds !== undefined) {
      await setDirectManagers(orgId, id, directManagerUserIds);
    }

    return this.getById(orgId, id);
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    return prisma.resource.delete({ where: { id } });
  },
};
