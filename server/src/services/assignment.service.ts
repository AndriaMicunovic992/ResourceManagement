import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { monthRange } from '../utils/months.js';
import type { UpsertAssignmentInput } from '../schemas/assignment.schema.js';

export const assignmentService = {
  async list(orgId: string) {
    return prisma.assignment.findMany({
      where: { orgId },
      include: { need: { include: { project: true } }, resource: { include: { roles: true } } },
      orderBy: { createdAt: 'asc' },
    });
  },

  async upsertMonth(orgId: string, input: UpsertAssignmentInput) {
    const need = await prisma.need.findFirst({
      where: { id: input.needId, orgId },
      include: { project: true },
    });
    const resource = await prisma.resource.findFirst({ where: { id: input.resourceId, orgId } });
    if (!need || !resource) throw new NotFoundError('Need or resource not found');

    const existing = await prisma.assignment.findUnique({
      where: { needId_resourceId: { needId: input.needId, resourceId: input.resourceId } },
    });

    if (existing) {
      const merged = { ...(existing.monthAllocations as Record<string, number>), [input.month]: input.fte };
      return prisma.assignment.update({
        where: { id: existing.id },
        data: { monthAllocations: merged },
        include: { need: { include: { project: true } }, resource: { include: { roles: true } } },
      });
    }

    const start = need.startMonth ?? need.project.startMonth;
    const end = need.endMonth ?? need.project.endMonth;
    const months = monthRange(start, end);
    const monthAllocations: Record<string, number> = {};
    months.forEach((m) => { monthAllocations[m] = 0; });
    monthAllocations[input.month] = input.fte;

    return prisma.assignment.create({
      data: { needId: input.needId, resourceId: input.resourceId, orgId, monthAllocations },
      include: { need: { include: { project: true } }, resource: { include: { roles: true } } },
    });
  },

  async update(orgId: string, id: string, data: { monthAllocations: Record<string, number> }) {
    const assignment = await prisma.assignment.findFirst({ where: { id, orgId } });
    if (!assignment) throw new NotFoundError('Assignment not found');
    return prisma.assignment.update({
      where: { id },
      data: { monthAllocations: data.monthAllocations },
      include: { need: { include: { project: true } }, resource: { include: { roles: true } } },
    });
  },

  async delete(orgId: string, id: string) {
    const assignment = await prisma.assignment.findFirst({ where: { id, orgId } });
    if (!assignment) throw new NotFoundError('Assignment not found');
    return prisma.assignment.delete({ where: { id } });
  },
};
