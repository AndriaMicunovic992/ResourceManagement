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

    const needStart = need.startMonth ?? need.project.startMonth;
    const needEnd = need.endMonth ?? need.project.endMonth;
    const allNeedMonths = monthRange(needStart, needEnd);

    // The set of months this write touches (the "delta"). Both the full
    // monthAllocations payload and the uniform-fte payload reduce to a map of
    // month -> fte that gets merged into whatever is already stored.
    let mergeObj: Record<string, number>;
    if (input.monthAllocations) {
      mergeObj = input.monthAllocations;
    } else {
      const fte = input.fte ?? 0;
      const targetMonths = input.months || (input.month ? [input.month] : allNeedMonths);
      mergeObj = {};
      for (const m of targetMonths) mergeObj[m] = fte;
    }

    // A brand-new row seeds every in-window month to 0 (so the need's months
    // exist as keys) and then applies the delta.
    const createAllocations: Record<string, number> = {};
    allNeedMonths.forEach((m) => { createAllocations[m] = 0; });
    Object.assign(createAllocations, mergeObj);

    const key = { needId_resourceId: { needId: input.needId, resourceId: input.resourceId } };

    // Ensure the row exists without a find-then-create race: two concurrent
    // placements of the same (need, resource) both resolve here instead of one
    // hitting the @@unique constraint and 500ing. The empty `update` leaves an
    // existing row untouched — the real merge happens atomically below.
    await prisma.assignment.upsert({
      where: key,
      create: { needId: input.needId, resourceId: input.resourceId, orgId, monthAllocations: createAllocations },
      update: {},
    });

    // Merge the delta into the stored JSON with an atomic jsonb concat. Doing
    // the merge in the database (rather than read-modify-write in JS) means two
    // planners editing different months of the same person can't clobber each
    // other's months — the previous approach silently dropped the loser's edit.
    if (Object.keys(mergeObj).length > 0) {
      await prisma.$executeRaw`
        UPDATE "Assignment"
        SET "monthAllocations" = COALESCE("monthAllocations", '{}'::jsonb) || ${JSON.stringify(mergeObj)}::jsonb,
            "updatedAt" = now()
        WHERE "orgId" = ${orgId} AND "needId" = ${input.needId} AND "resourceId" = ${input.resourceId}`;
    }

    const row = await prisma.assignment.findUnique({ where: key, include: INCLUDE });
    if (!row) throw new NotFoundError('Assignment not found');
    return row;
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
