import { prisma } from '../db/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import type { CreateFollowUpInput, UpdateFollowUpInput } from '../schemas/followUp.schema.js';

const followUpInclude = {
  createdByUser: { select: { id: true, name: true, email: true } },
  oneOnOne: { select: { id: true, meetingDate: true } },
  resolvedInOneOnOne: { select: { id: true, meetingDate: true } },
} as const;

function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'owner';
}

async function ensureResourceInOrg(orgId: string, resourceId: string): Promise<void> {
  const resource = await prisma.resource.findFirst({ where: { id: resourceId, orgId } });
  if (!resource) throw new NotFoundError('Resource not found');
}

async function ensureOneOnOneForResource(
  orgId: string,
  oneOnOneId: string,
  resourceId: string
): Promise<void> {
  const oneOnOne = await prisma.oneOnOne.findFirst({
    where: { id: oneOnOneId, orgId, resourceId },
  });
  if (!oneOnOne) throw new NotFoundError('1:1 meeting not found');
}

export const followUpService = {
  /** Open items first (newest on top), then resolved. */
  async list(orgId: string, resourceId: string, status?: string) {
    await ensureResourceInOrg(orgId, resourceId);
    return prisma.followUp.findMany({
      where: { orgId, resourceId, ...(status ? { status } : {}) },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: followUpInclude,
    });
  },

  async create(
    orgId: string,
    resourceId: string,
    createdByUserId: string,
    data: CreateFollowUpInput
  ) {
    await ensureResourceInOrg(orgId, resourceId);
    if (data.oneOnOneId) await ensureOneOnOneForResource(orgId, data.oneOnOneId, resourceId);
    return prisma.followUp.create({
      data: {
        orgId,
        resourceId,
        createdByUserId,
        content: data.content,
        oneOnOneId: data.oneOnOneId ?? null,
      },
      include: followUpInclude,
    });
  },

  async update(orgId: string, resourceId: string, id: string, data: UpdateFollowUpInput) {
    // Bind the follow-up to the person in the URL: editing a follow-up that
    // belongs to a person outside the caller's asserted scope 404s.
    const existing = await prisma.followUp.findFirst({ where: { id, orgId, resourceId } });
    if (!existing) throw new NotFoundError('Follow-up not found');

    if (data.resolvedInOneOnOneId) {
      await ensureOneOnOneForResource(orgId, data.resolvedInOneOnOneId, existing.resourceId);
    }

    const patch: Record<string, unknown> = {};
    if (data.content !== undefined) patch.content = data.content;
    if (data.status !== undefined && data.status !== existing.status) {
      patch.status = data.status;
      if (data.status === 'resolved') {
        patch.resolvedAt = new Date();
        patch.resolvedInOneOnOneId = data.resolvedInOneOnOneId ?? null;
      } else {
        // Reopened: clear the resolution context.
        patch.resolvedAt = null;
        patch.resolvedInOneOnOneId = null;
      }
    } else if (data.resolvedInOneOnOneId !== undefined && existing.status === 'resolved') {
      patch.resolvedInOneOnOneId = data.resolvedInOneOnOneId ?? null;
    }

    return prisma.followUp.update({ where: { id }, data: patch, include: followUpInclude });
  },

  async remove(orgId: string, resourceId: string, id: string, requesterId: string, requesterRole: string) {
    const existing = await prisma.followUp.findFirst({ where: { id, orgId, resourceId } });
    if (!existing) throw new NotFoundError('Follow-up not found');
    if (existing.createdByUserId !== requesterId && !isAdminRole(requesterRole)) {
      throw new ForbiddenError('You cannot delete this follow-up');
    }
    await prisma.followUp.delete({ where: { id } });
  },
};
