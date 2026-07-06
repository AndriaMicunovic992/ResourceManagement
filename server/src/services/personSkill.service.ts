import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { assertCanViewPerson, type VisibilityScope } from './visibility.service.js';
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

  async upsert(orgId: string, scope: VisibilityScope, data: UpsertPersonSkillInput) {
    // Ensure both resource and skill belong to this org
    const resource = await prisma.resource.findFirst({ where: { id: data.resourceId, orgId } });
    if (!resource) throw new NotFoundError('Resource not found');
    // A skills-write role may only edit skills for people it can see, not the
    // whole org (visibility == existence — 404 for out-of-scope people).
    assertCanViewPerson(scope, data.resourceId);
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

  async update(orgId: string, scope: VisibilityScope, id: string, data: UpdatePersonSkillInput) {
    const existing = await prisma.personSkill.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundError('PersonSkill not found');
    assertCanViewPerson(scope, existing.resourceId);
    return prisma.personSkill.update({ where: { id }, data });
  },

  async delete(orgId: string, scope: VisibilityScope, id: string) {
    const existing = await prisma.personSkill.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundError('PersonSkill not found');
    assertCanViewPerson(scope, existing.resourceId);
    return prisma.personSkill.delete({ where: { id } });
  },
};
