import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { monthRange } from '../utils/months.js';
import type { UpsertAssignmentInput } from '../schemas/assignment.schema.js';

const INCLUDE = { need: { include: { project: true } }, resource: { include: { roles: true } } };

export const assignmentService = {
  async list(orgId: string) {
    return prisma.assignment.findMany({ where: { orgId }, include: INCLUDE, orderBy: { createdAt: 'asc' } });
  },

  async upsertMonth(orgId: string, input: UpsertAssignmentInput) {
    const need = await prisma.need.findFirst({ where: { id: input.needId, orgId }, include: { project: true } });
    const resource = await prisma.resource.findFirst({ where: { id: input.resourceId, orgId } });
    if (!need || !resource) throw new NotFoundError('Need or resource not found');

    const needAllocs = need.monthAllocations as Record<string, number>;
    const needStart = need.startMonth ?? need.project.startMonth;
    const needEnd = need.endMonth ?? need.project.endMonth;
    const allNeedMonths = monthRange(needStart, needEnd);

    // Determine which months to assign
    const targetMonths = input.months || (input.month ? [input.month] : allNeedMonths);

    const existing = await prisma.assignment.findUnique({
      where: { needId_resourceId: { needId: input.needId, resourceId: input.resourceId } },
    });

    if (existing) {
      const merged = { ...(existing.monthAllocations as Record<string, number>) };
      for (const m of targetMonths) {
        merged[m] = input.fte;
      }
      return prisma.assignment.update({
        where: { id: existing.id },
        data: { monthAllocations: merged },
        include: INCLUDE,
      });
    }

    // New assignment: initialize all need months to 0, then set targets
    const monthAllocations: Record<string, number> = {};
    allNeedMonths.forEach((m) => { monthAllocations[m] = 0; });
    for (const m of targetMonths) {
      monthAllocations[m] = input.fte;
    }

    return prisma.assignment.create({
      data: { needId: input.needId, resourceId: input.resourceId, orgId, monthAllocations },
      include: INCLUDE,
    });
  },

  async update(orgId: string, id: string, data: { monthAllocations: Record<string, number> }) {
    const assignment = await prisma.assignment.findFirst({ where: { id, orgId } });
    if (!assignment) throw new NotFoundError('Assignment not found');
    return prisma.assignment.update({
      where: { id },
      data: { monthAllocations: data.monthAllocations },
      include: INCLUDE,
    });
  },

  async delete(orgId: string, id: string) {
    const assignment = await prisma.assignment.findFirst({ where: { id, orgId } });
    if (!assignment) throw new NotFoundError('Assignment not found');
    return prisma.assignment.delete({ where: { id } });
  },
};
