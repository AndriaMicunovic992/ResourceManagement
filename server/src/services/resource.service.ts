import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import type { CreateResourceInput, UpdateResourceInput } from '../schemas/resource.schema.js';

const resourceInclude = {
  roles: true,
  assignments: true,
  team: true,
  personSkills: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

async function ensureUserInOrg(orgId: string, userId: string): Promise<void> {
  const member = await prisma.orgMember.findFirst({
    where: { orgId, userId },
  });
  if (!member) throw new NotFoundError('User is not a member of this organisation');
}

export const resourceService = {
  async list(orgId: string) {
    return prisma.resource.findMany({
      where: { orgId },
      include: resourceInclude,
      orderBy: { createdAt: 'asc' },
    });
  },

  async getById(orgId: string, id: string) {
    const resource = await prisma.resource.findFirst({
      where: { id, orgId },
      include: resourceInclude,
    });
    if (!resource) throw new NotFoundError('Resource not found');
    return resource;
  },

  async getByUserId(orgId: string, userId: string) {
    return prisma.resource.findFirst({
      where: { orgId, userId },
      include: resourceInclude,
    });
  },

  async create(orgId: string, data: CreateResourceInput) {
    const { roles, userId, ...rest } = data;
    if (userId) await ensureUserInOrg(orgId, userId);
    try {
      return await prisma.resource.create({
        data: {
          ...rest,
          orgId,
          userId: userId ?? null,
          roles: { create: roles },
        },
        include: resourceInclude,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('This user is already linked to another resource');
      }
      throw err;
    }
  },

  async update(orgId: string, id: string, data: UpdateResourceInput) {
    await this.getById(orgId, id);
    const { roles, userId, ...rest } = data;

    if (userId) await ensureUserInOrg(orgId, userId);

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

    try {
      return await prisma.resource.update({
        where: { id },
        data: patch,
        include: resourceInclude,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('This user is already linked to another resource');
      }
      throw err;
    }
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    return prisma.resource.delete({ where: { id } });
  },
};
