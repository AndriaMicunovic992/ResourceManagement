import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { monthRange } from '../utils/months.js';
import type { CreateNeedInput, UpdateNeedInput } from '../schemas/need.schema.js';

export const needService = {
  async list(orgId: string, projectId?: string) {
    const where: any = { orgId };
    if (projectId) where.projectId = projectId;
    return prisma.need.findMany({
      where,
      include: { assignments: true, project: true },
      orderBy: { createdAt: 'asc' },
    });
  },

  async getById(orgId: string, id: string) {
    const need = await prisma.need.findFirst({
      where: { id, orgId },
      include: { assignments: true, project: true },
    });
    if (!need) throw new NotFoundError('Need not found');
    return need;
  },

  async create(orgId: string, data: CreateNeedInput) {
    const { ftePerMonth, ...rest } = data;
    const project = await prisma.project.findFirst({ where: { id: data.projectId, orgId } });
    if (!project) throw new NotFoundError('Project not found');

    const start = data.startMonth || project.startMonth;
    const end = data.endMonth || project.endMonth;
    const months = monthRange(start, end);
    const monthAllocations: Record<string, number> = {};
    months.forEach((m) => { monthAllocations[m] = ftePerMonth; });

    return prisma.need.create({
      data: { ...rest, monthAllocations, orgId },
      include: { assignments: true, project: true },
    });
  },

  async update(orgId: string, id: string, data: UpdateNeedInput) {
    const existing = await this.getById(orgId, id);
    const { ftePerMonth, monthAllocations: inputMonthAllocs, ...rest } = data;

    let monthAllocations = existing.monthAllocations as Record<string, number>;
    if (ftePerMonth !== undefined) {
      const start = data.startMonth || existing.startMonth || existing.project.startMonth;
      const end = data.endMonth || existing.endMonth || existing.project.endMonth;
      const months = monthRange(start, end);
      monthAllocations = {};
      months.forEach((m) => { monthAllocations[m] = ftePerMonth; });
    } else if (inputMonthAllocs) {
      monthAllocations = { ...monthAllocations, ...inputMonthAllocs };
    }

    return prisma.need.update({
      where: { id },
      data: { ...rest, monthAllocations },
      include: { assignments: true, project: true },
    });
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    return prisma.need.delete({ where: { id } });
  },
};
