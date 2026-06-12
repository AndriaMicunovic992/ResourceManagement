import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { monthRange } from '../utils/months.js';
import type { CreateNeedInput, UpdateNeedInput } from '../schemas/need.schema.js';

/** Spreadsheet model: a need's start/end follow its allocations, and the
 * project's range is the envelope of its needs — never entered by hand. */
function allocEnvelope(allocs: Record<string, number>) {
  const ms = Object.keys(allocs)
    .filter((m) => (allocs[m] || 0) > 0)
    .sort();
  return ms.length
    ? { startMonth: ms[0], endMonth: ms[ms.length - 1] }
    : { startMonth: null, endMonth: null };
}

async function syncProjectRange(orgId: string, projectId: string) {
  const needs = await prisma.need.findMany({
    where: { orgId, projectId },
    select: { monthAllocations: true },
  });
  const months: string[] = [];
  for (const n of needs) {
    for (const [m, v] of Object.entries((n.monthAllocations as Record<string, number>) || {})) {
      if ((v || 0) > 0) months.push(m);
    }
  }
  if (months.length === 0) return;
  months.sort();
  await prisma.project.update({
    where: { id: projectId },
    data: { startMonth: months[0], endMonth: months[months.length - 1] },
  });
}

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

    const created = await prisma.need.create({
      data: { ...rest, ...allocEnvelope(monthAllocations), monthAllocations, orgId },
      include: { assignments: true, project: true },
    });
    await syncProjectRange(orgId, created.projectId);
    return created;
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

    const updated = await prisma.need.update({
      where: { id },
      data: { ...rest, ...allocEnvelope(monthAllocations), monthAllocations },
      include: { assignments: true, project: true },
    });
    await syncProjectRange(orgId, updated.projectId);
    return updated;
  },

  async delete(orgId: string, id: string) {
    const existing = await this.getById(orgId, id);
    const result = await prisma.need.delete({ where: { id } });
    await syncProjectRange(orgId, existing.projectId);
    return result;
  },
};
