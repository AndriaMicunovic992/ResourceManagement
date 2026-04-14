import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import type {
  CreatePerformanceLogCategoryInput,
  UpdatePerformanceLogCategoryInput,
} from '../schemas/performanceLogCategory.schema.js';

export const performanceLogCategoryService = {
  async list(orgId: string) {
    return prisma.performanceLogCategory.findMany({
      where: { orgId },
      orderBy: [{ grouping: 'asc' }, { name: 'asc' }],
    });
  },

  async getById(orgId: string, id: string) {
    const category = await prisma.performanceLogCategory.findFirst({
      where: { id, orgId },
    });
    if (!category) throw new NotFoundError('Category not found');
    return category;
  },

  async create(orgId: string, data: CreatePerformanceLogCategoryInput) {
    try {
      return await prisma.performanceLogCategory.create({
        data: {
          orgId,
          name: data.name,
          grouping: data.grouping ?? null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('A category with this grouping and name already exists');
      }
      throw err;
    }
  },

  async update(orgId: string, id: string, data: UpdatePerformanceLogCategoryInput) {
    await this.getById(orgId, id);
    const patch: Prisma.PerformanceLogCategoryUpdateInput = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.grouping !== undefined) patch.grouping = data.grouping ?? null;
    try {
      return await prisma.performanceLogCategory.update({ where: { id }, data: patch });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('A category with this grouping and name already exists');
      }
      throw err;
    }
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    return prisma.performanceLogCategory.delete({ where: { id } });
  },
};
