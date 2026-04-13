import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import type {
  CreateDimensionInput,
  UpdateDimensionInput,
} from '../schemas/dimension.schema.js';

export const dimensionService = {
  async list(orgId: string) {
    return prisma.dimension.findMany({
      where: { orgId },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  },

  async getById(orgId: string, id: string) {
    const dimension = await prisma.dimension.findFirst({ where: { id, orgId } });
    if (!dimension) throw new NotFoundError('Dimension not found');
    return dimension;
  },

  async getByCode(orgId: string, code: string) {
    return prisma.dimension.findFirst({ where: { orgId, code } });
  },

  async create(orgId: string, data: CreateDimensionInput) {
    try {
      return await prisma.dimension.create({
        data: {
          orgId,
          code: data.code,
          name: data.name,
          description: data.description ?? null,
          sortOrder: data.sortOrder ?? 0,
          active: data.active ?? true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('A dimension with this code already exists');
      }
      throw err;
    }
  },

  async update(orgId: string, id: string, data: UpdateDimensionInput) {
    await this.getById(orgId, id);
    const patch: Prisma.DimensionUpdateInput = {};
    if (data.code !== undefined) patch.code = data.code;
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description ?? null;
    if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;
    if (data.active !== undefined) patch.active = data.active;
    try {
      return await prisma.dimension.update({ where: { id }, data: patch });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('A dimension with this code already exists');
      }
      throw err;
    }
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    return prisma.dimension.delete({ where: { id } });
  },
};
