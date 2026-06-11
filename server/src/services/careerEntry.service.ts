import { prisma } from '../db/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import type {
  CreateCareerEntryInput,
  UpdateCareerEntryInput,
} from '../schemas/careerEntry.schema.js';

const careerEntryInclude = {
  authorUser: { select: { id: true, name: true, email: true } },
  oneOnOne: { select: { id: true, meetingDate: true } },
} as const;

function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'owner';
}

async function ensureResourceInOrg(orgId: string, resourceId: string): Promise<void> {
  const resource = await prisma.resource.findFirst({ where: { id: resourceId, orgId } });
  if (!resource) throw new NotFoundError('Resource not found');
}

export const careerEntryService = {
  async list(orgId: string, resourceId: string) {
    await ensureResourceInOrg(orgId, resourceId);
    return prisma.careerEntry.findMany({
      where: { orgId, resourceId },
      orderBy: { createdAt: 'desc' },
      include: careerEntryInclude,
    });
  },

  async create(
    orgId: string,
    resourceId: string,
    authorUserId: string,
    data: CreateCareerEntryInput
  ) {
    await ensureResourceInOrg(orgId, resourceId);
    if (data.oneOnOneId) {
      const oneOnOne = await prisma.oneOnOne.findFirst({
        where: { id: data.oneOnOneId, orgId, resourceId },
      });
      if (!oneOnOne) throw new NotFoundError('1:1 meeting not found');
    }
    return prisma.careerEntry.create({
      data: {
        orgId,
        resourceId,
        authorUserId,
        content: data.content,
        kind: data.kind,
        goalStatus: data.kind === 'goal' ? data.goalStatus ?? 'active' : null,
        oneOnOneId: data.oneOnOneId ?? null,
      },
      include: careerEntryInclude,
    });
  },

  async update(
    orgId: string,
    id: string,
    requesterId: string,
    requesterRole: string,
    data: UpdateCareerEntryInput
  ) {
    const existing = await prisma.careerEntry.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundError('Career entry not found');
    if (existing.authorUserId !== requesterId && !isAdminRole(requesterRole)) {
      throw new ForbiddenError('You cannot edit this career entry');
    }
    const patch: Record<string, unknown> = {};
    if (data.content !== undefined) patch.content = data.content;
    if (data.goalStatus !== undefined && existing.kind === 'goal') {
      patch.goalStatus = data.goalStatus;
    }
    return prisma.careerEntry.update({ where: { id }, data: patch, include: careerEntryInclude });
  },

  async remove(orgId: string, id: string, requesterId: string, requesterRole: string) {
    const existing = await prisma.careerEntry.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundError('Career entry not found');
    if (existing.authorUserId !== requesterId && !isAdminRole(requesterRole)) {
      throw new ForbiddenError('You cannot delete this career entry');
    }
    await prisma.careerEntry.delete({ where: { id } });
  },
};
