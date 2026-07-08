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
  // A person can't manage themselves (via their own login user).
  const self = await prisma.resource.findUnique({
    where: { id: personId },
    select: { userId: true },
  });
  const filtered = unique.filter((uid) => uid !== self?.userId);
  // Replace the manager set atomically so a failure can't drop all managers.
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.personManager.deleteMany({ where: { personId } }),
  ];
  if (filtered.length > 0) {
    ops.push(
      prisma.personManager.createMany({
        data: filtered.map((managerUserId) => ({ personId, managerUserId, orgId })),
        skipDuplicates: true,
      })
    );
  }
  await prisma.$transaction(ops);
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
        const target = (err.meta?.target as string[] | undefined) ?? [];
        if (target.includes('externalWorkId')) {
          throw new ConflictError('That Jira account is already mapped to another person');
        }
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
      // Replace atomically — a failure between delete and create would leave the
      // person with no roles.
      const ops: Prisma.PrismaPromise<unknown>[] = [
        prisma.resourceRole.deleteMany({ where: { resourceId: id } }),
      ];
      if (roles.length > 0) {
        ops.push(prisma.resourceRole.createMany({ data: roles.map((r) => ({ ...r, resourceId: id })) }));
      }
      await prisma.$transaction(ops);
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
        const target = (err.meta?.target as string[] | undefined) ?? [];
        if (target.includes('externalWorkId')) {
          throw new ConflictError('That Jira account is already mapped to another person');
        }
        throw new ConflictError('This user is already linked to another resource');
      }
      throw err;
    }

    if (directManagerUserIds !== undefined) {
      await setDirectManagers(orgId, id, directManagerUserIds);
    }

    // If the Jira account mapping changed, re-attribute already-synced worklogs
    // so the fix applies to history too — otherwise a person matched after a
    // sync stays invisible in actuals until a full re-pull. Detach this person
    // from any worklog first, then claim the ones for the new account id.
    if (data.externalWorkId !== undefined) {
      await prisma.worklog.updateMany({ where: { orgId, resourceId: id }, data: { resourceId: null } });
      if (data.externalWorkId) {
        await prisma.worklog.updateMany({
          where: { orgId, accountId: data.externalWorkId },
          data: { resourceId: id },
        });
      }
    }

    return this.getById(orgId, id);
  },

  /**
   * Merge a per-month delta of planned-absence days into the stored map.
   * Same concurrency contract as assignment months: the merge happens in the
   * database (jsonb concat), so two planners editing different months never
   * clobber each other. Months set to 0 are dropped entirely (null-merge +
   * strip) rather than stored as zeros.
   */
  async setAbsences(orgId: string, id: string, months: Record<string, number>) {
    await this.getById(orgId, id);
    const merge: Record<string, number | null> = {};
    for (const [m, days] of Object.entries(months)) {
      merge[m] = days > 0 ? Math.round(days * 2) / 2 : null; // half-day grain
    }
    await prisma.$executeRaw`
      UPDATE "Resource"
      SET "plannedAbsences" = jsonb_strip_nulls(
            COALESCE("plannedAbsences", '{}'::jsonb) || ${JSON.stringify(merge)}::jsonb
          ),
          "updatedAt" = now()
      WHERE "id" = ${id} AND "orgId" = ${orgId}`;
    return this.getById(orgId, id);
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    try {
      return await prisma.resource.delete({ where: { id } });
    } catch (err) {
      // A person with protected history (evaluations, 1:1s, logs, career or
      // follow-up entries) can't be hard-deleted — that would destroy the
      // record of their reviews. Direct the caller to archive instead.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new ConflictError(
          'This person has history (evaluations, 1:1s, logs, career or follow-up entries). Archive them instead of deleting.'
        );
      }
      throw err;
    }
  },
};
