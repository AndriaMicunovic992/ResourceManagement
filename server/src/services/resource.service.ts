import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import type { CreateResourceInput, UpdateResourceInput } from '../schemas/resource.schema.js';

export const resourceService = {
  async list(orgId: string) {
    return prisma.resource.findMany({
      where: { orgId },
      include: { roles: true, assignments: true, team: true },
      orderBy: { createdAt: 'asc' },
    });
  },

  async getById(orgId: string, id: string) {
    const resource = await prisma.resource.findFirst({
      where: { id, orgId },
      include: { roles: true, assignments: true, team: true },
    });
    if (!resource) throw new NotFoundError('Resource not found');
    return resource;
  },

  async create(orgId: string, data: CreateResourceInput) {
    const { roles, ...rest } = data;
    return prisma.resource.create({
      data: {
        ...rest,
        orgId,
        roles: { create: roles },
      },
      include: { roles: true, assignments: true, team: true },
    });
  },

  async update(orgId: string, id: string, data: UpdateResourceInput) {
    await this.getById(orgId, id);
    const { roles, ...rest } = data;

    if (roles) {
      await prisma.resourceRole.deleteMany({ where: { resourceId: id } });
      await prisma.resourceRole.createMany({
        data: roles.map((r) => ({ ...r, resourceId: id })),
      });
    }

    return prisma.resource.update({
      where: { id },
      data: rest,
      include: { roles: true, assignments: true, team: true },
    });
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    return prisma.resource.delete({ where: { id } });
  },
};
