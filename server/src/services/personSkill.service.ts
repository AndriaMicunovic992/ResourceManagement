import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import type {
  UpsertPersonSkillInput,
  UpdatePersonSkillInput,
} from '../schemas/personSkill.schema.js';

export const personSkillService = {
  async list(orgId: string) {
    return prisma.personSkill.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
    });
  },

  async upsert(orgId: string, data: UpsertPersonSkillInput) {
    // Ensure both resource and skill belong to this org
    const resource = await prisma.resource.findFirst({ where: { id: data.resourceId, orgId } });
    if (!resource) throw new NotFoundError('Resource not found');
    const skill = await prisma.skill.findFirst({ where: { id: data.skillId, orgId } });
    if (!skill) throw new NotFoundError('Skill not found');

    return prisma.personSkill.upsert({
      where: { resourceId_skillId: { resourceId: data.resourceId, skillId: data.skillId } },
      create: {
        resourceId: data.resourceId,
        skillId: data.skillId,
        level: data.level,
        note: data.note ?? null,
        orgId,
      },
      update: {
        level: data.level,
        note: data.note ?? null,
      },
    });
  },

  async update(orgId: string, id: string, data: UpdatePersonSkillInput) {
    const existing = await prisma.personSkill.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundError('PersonSkill not found');
    return prisma.personSkill.update({ where: { id }, data });
  },

  async delete(orgId: string, id: string) {
    const existing = await prisma.personSkill.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundError('PersonSkill not found');
    return prisma.personSkill.delete({ where: { id } });
  },
};
