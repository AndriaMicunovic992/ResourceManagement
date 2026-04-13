import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import type { CreateSkillInput, UpdateSkillInput } from '../schemas/skill.schema.js';

export const skillService = {
  async list(orgId: string) {
    return prisma.skill.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
    });
  },

  async getById(orgId: string, id: string) {
    const skill = await prisma.skill.findFirst({ where: { id, orgId } });
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  },

  async create(orgId: string, data: CreateSkillInput) {
    try {
      return await prisma.skill.create({ data: { ...data, orgId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('A skill with this name already exists');
      }
      throw err;
    }
  },

  async update(orgId: string, id: string, data: UpdateSkillInput) {
    await this.getById(orgId, id);
    try {
      return await prisma.skill.update({ where: { id }, data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('A skill with this name already exists');
      }
      throw err;
    }
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    return prisma.skill.delete({ where: { id } });
  },
};
