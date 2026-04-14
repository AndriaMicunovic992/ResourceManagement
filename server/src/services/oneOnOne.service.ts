import { prisma } from '../db/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import type { CreateOneOnOneInput, UpdateOneOnOneInput } from '../schemas/oneOnOne.schema.js';

type OneOnOneRecord = {
  id: string;
  orgId: string;
  resourceId: string;
  authorUserId: string;
  meetingDate: Date;
  generalStatus: string | null;
  personalNotes: string | null;
  careerDevelopment: string | null;
  managerPersonalNotes: string | null;
  privateNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  authorUser?: { id: string; name: string; email: string } | null;
};

function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'owner';
}

/**
 * Strip author-only fields from records not authored by the requesting user.
 * privateNote is only visible to the author. managerPersonalNotes was
 * already author-only in Step 12 and stays that way.
 */
function stripPrivateFields<
  T extends {
    authorUserId: string;
    managerPersonalNotes: string | null;
    privateNote: string | null;
  }
>(userId: string, record: T): T {
  if (userId === record.authorUserId) return record;
  return { ...record, managerPersonalNotes: null, privateNote: null };
}

function parseMeetingDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  return new Date(value);
}

const authorSelect = { id: true, name: true, email: true } as const;

async function ensureResourceInOrg(orgId: string, resourceId: string): Promise<void> {
  const resource = await prisma.resource.findFirst({ where: { id: resourceId, orgId } });
  if (!resource) throw new NotFoundError('Resource not found');
}

export async function listOneOnOnes(
  orgId: string,
  resourceId: string,
  requestingUserId: string
): Promise<OneOnOneRecord[]> {
  await ensureResourceInOrg(orgId, resourceId);

  const records = await prisma.oneOnOne.findMany({
    where: { orgId, resourceId },
    orderBy: { meetingDate: 'desc' },
    include: { authorUser: { select: authorSelect } },
  });

  return records.map((record) => stripPrivateFields(requestingUserId, record));
}

export async function getOneOnOne(
  orgId: string,
  id: string,
  requestingUserId: string
): Promise<OneOnOneRecord> {
  const record = await prisma.oneOnOne.findFirst({
    where: { id, orgId },
    include: { authorUser: { select: authorSelect } },
  });
  if (!record) throw new NotFoundError('1:1 meeting not found');
  return stripPrivateFields(requestingUserId, record);
}

export async function createOneOnOne(
  orgId: string,
  resourceId: string,
  authorUserId: string,
  data: CreateOneOnOneInput
): Promise<OneOnOneRecord> {
  await ensureResourceInOrg(orgId, resourceId);

  const created = await prisma.oneOnOne.create({
    data: {
      orgId,
      resourceId,
      authorUserId,
      meetingDate: parseMeetingDate(data.meetingDate),
      generalStatus: data.generalStatus ?? null,
      personalNotes: data.personalNotes ?? null,
      careerDevelopment: data.careerDevelopment ?? null,
      managerPersonalNotes: data.managerPersonalNotes ?? null,
      privateNote: data.privateNote ?? null,
    },
    include: { authorUser: { select: authorSelect } },
  });

  // The author sees their own record in full.
  return created;
}

export async function updateOneOnOne(
  orgId: string,
  id: string,
  requestingUserId: string,
  requestingUserRole: string,
  data: UpdateOneOnOneInput
): Promise<OneOnOneRecord> {
  const existing = await prisma.oneOnOne.findFirst({ where: { id, orgId } });
  if (!existing) throw new NotFoundError('1:1 meeting not found');
  const isAuthor = existing.authorUserId === requestingUserId;
  const admin = isAdminRole(requestingUserRole);
  if (!isAuthor && !admin) {
    throw new ForbiddenError('Only the author or an admin can edit a 1:1 meeting');
  }

  const patch: Record<string, unknown> = {};
  if (data.meetingDate !== undefined) patch.meetingDate = parseMeetingDate(data.meetingDate);
  if (data.generalStatus !== undefined) patch.generalStatus = data.generalStatus ?? null;
  if (data.personalNotes !== undefined) patch.personalNotes = data.personalNotes ?? null;
  if (data.careerDevelopment !== undefined) patch.careerDevelopment = data.careerDevelopment ?? null;
  if (data.managerPersonalNotes !== undefined) {
    patch.managerPersonalNotes = data.managerPersonalNotes ?? null;
  }
  // privateNote may only be set by the author. Silently ignore for admins
  // who are not the author so that an admin edit never clobbers someone
  // else's private note.
  if (data.privateNote !== undefined && isAuthor) {
    patch.privateNote = data.privateNote ?? null;
  }

  const updated = await prisma.oneOnOne.update({
    where: { id },
    data: patch,
    include: { authorUser: { select: authorSelect } },
  });

  return stripPrivateFields(requestingUserId, updated);
}

export async function deleteOneOnOne(
  orgId: string,
  id: string,
  requestingUserId: string,
  requestingUserRole: string
): Promise<void> {
  const existing = await prisma.oneOnOne.findFirst({ where: { id, orgId } });
  if (!existing) throw new NotFoundError('1:1 meeting not found');
  const isAuthor = existing.authorUserId === requestingUserId;
  const isAdmin = isAdminRole(requestingUserRole);
  if (!isAuthor && !isAdmin) {
    throw new ForbiddenError('You cannot delete this 1:1 meeting');
  }
  await prisma.oneOnOne.delete({ where: { id } });
}
