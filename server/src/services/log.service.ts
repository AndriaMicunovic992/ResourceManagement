import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import {
  EMPLOYEE_LOG_KINDS,
  type CreateLogInput,
  type UpdateLogInput,
  type ListLogsQuery,
} from '../schemas/log.schema.js';

const customerSelect = { id: true, name: true } as const;
const projectSelect = { id: true, name: true } as const;
const authorSelect = { id: true, name: true, email: true } as const;
const oneOnOneSelect = { id: true, meetingDate: true } as const;

const categorySelect = { id: true, name: true, grouping: true } as const;

const logInclude = {
  customer: { select: customerSelect },
  project: { select: projectSelect },
  authorUser: { select: authorSelect },
  oneOnOne: { select: oneOnOneSelect },
  categories: { select: categorySelect },
  comments: {
    include: { authorUser: { select: authorSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

export { logInclude };

function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'owner';
}

function isEmployeeKind(kind: string): boolean {
  return (EMPLOYEE_LOG_KINDS as readonly string[]).includes(kind);
}

async function ensureResourceInOrg(orgId: string, resourceId: string): Promise<void> {
  const resource = await prisma.resource.findFirst({ where: { id: resourceId, orgId } });
  if (!resource) throw new NotFoundError('Resource not found');
}

async function findResourceForUser(
  orgId: string,
  userId: string
): Promise<{ id: string } | null> {
  return prisma.resource.findFirst({
    where: { orgId, userId },
    select: { id: true },
  });
}

async function ensureCustomerInOrg(orgId: string, customerId: string): Promise<void> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, orgId } });
  if (!customer) throw new NotFoundError('Customer not found');
}

async function ensureProjectInOrg(orgId: string, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({ where: { id: projectId, orgId } });
  if (!project) throw new NotFoundError('Project not found');
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

async function ensureCategoriesInOrg(orgId: string, categoryIds: string[]): Promise<void> {
  if (categoryIds.length === 0) return;
  const count = await prisma.performanceLogCategory.count({
    where: { id: { in: categoryIds }, orgId },
  });
  if (count !== new Set(categoryIds).size) throw new NotFoundError('Category not found');
}

function parseBoundaryDate(value: string, endOfDay: boolean): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
    return new Date(`${value}${suffix}`);
  }
  return new Date(value);
}

export async function listLogs(
  orgId: string,
  resourceId: string,
  filters: ListLogsQuery,
  requestingUserId: string,
  requestingUserRole: string
) {
  await ensureResourceInOrg(orgId, resourceId);

  const admin = isAdminRole(requestingUserRole);
  const where: Prisma.LogWhereInput = { orgId, resourceId };

  if (!admin) {
    // Kinds are shared between self-journal and observer entries, so the
    // self-vs-manager separation is authorship-based: a non-admin subject sees
    // only entries they authored (PM/manager entries about them stay hidden).
    // Non-admins viewing a visible other person see all entries — they reached
    // the route by being a manager/responsible.
    const self = await findResourceForUser(orgId, requestingUserId);
    if (self?.id === resourceId) {
      where.authorUserId = requestingUserId;
    }
  }
  if (filters.kind) where.kind = filters.kind;

  if (filters.categoryId) where.categories = { some: { id: filters.categoryId } };
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.oneOnOneId) where.oneOnOneId = filters.oneOnOneId;

  if (filters.from || filters.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (filters.from) createdAt.gte = parseBoundaryDate(filters.from, false);
    if (filters.to) createdAt.lte = parseBoundaryDate(filters.to, true);
    where.createdAt = createdAt;
  }

  return prisma.log.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit,
    include: logInclude,
  });
}

export async function getLog(
  orgId: string,
  id: string,
  requestingUserId: string,
  requestingUserRole: string
) {
  const log = await prisma.log.findFirst({
    where: { id, orgId },
    include: logInclude,
  });
  if (!log) throw new NotFoundError('Log not found');

  if (!isAdminRole(requestingUserRole)) {
    // Non-admin viewing self: own-authored entries only (authorship rule).
    // Non-admin viewing another person's logs: allowed (route has already
    // asserted visibility via the person gate).
    const self = await findResourceForUser(orgId, requestingUserId);
    if (self?.id === log.resourceId && log.authorUserId !== requestingUserId) {
      throw new NotFoundError('Log not found');
    }
  }
  return log;
}

export async function createLog(
  orgId: string,
  resourceId: string,
  authorUserId: string,
  authorRole: string,
  data: CreateLogInput
) {
  await ensureResourceInOrg(orgId, resourceId);

  const admin = isAdminRole(authorRole);
  if (!admin) {
    // Non-admin creating a log on their own profile: only employee-kind
    // (wins/downs/blockers), no 1:1 attachment. Non-admin creating on
    // someone else's profile: allowed (route asserted visibility); kind may
    // be any kind.
    const self = await findResourceForUser(orgId, authorUserId);
    const isSelf = self?.id === resourceId;
    if (isSelf) {
      if (!isEmployeeKind(data.kind)) {
        throw new ForbiddenError('You cannot create logs of this kind');
      }
      if (data.oneOnOneId) {
        throw new ForbiddenError('Employee logs cannot be attached to a 1:1');
      }
    }
  }

  if (data.customerId) await ensureCustomerInOrg(orgId, data.customerId);
  if (data.projectId) await ensureProjectInOrg(orgId, data.projectId);
  if (data.oneOnOneId) await ensureOneOnOneForResource(orgId, data.oneOnOneId, resourceId);
  const categoryIds = data.categoryIds ?? [];
  await ensureCategoriesInOrg(orgId, categoryIds);

  return prisma.log.create({
    data: {
      orgId,
      resourceId,
      authorUserId,
      content: data.content,
      kind: data.kind,
      categories: { connect: categoryIds.map((id) => ({ id })) },
      customerId: data.customerId ?? null,
      projectId: data.projectId ?? null,
      jiraUrl: data.jiraUrl ?? null,
      oneOnOneId: data.oneOnOneId ?? null,
    },
    include: logInclude,
  });
}

export async function updateLog(
  orgId: string,
  id: string,
  requestingUserId: string,
  requestingUserRole: string,
  data: UpdateLogInput
) {
  const existing = await prisma.log.findFirst({ where: { id, orgId } });
  if (!existing) throw new NotFoundError('Log not found');
  if (existing.authorUserId !== requestingUserId) {
    throw new ForbiddenError('Only the author can edit a log');
  }

  if (!isAdminRole(requestingUserRole)) {
    // Authors edit their own entries. On their own profile (self-journal) the
    // kind must stay within the employee set — no self-authored incidents or
    // project check-ins.
    const self = await findResourceForUser(orgId, requestingUserId);
    if (self?.id === existing.resourceId) {
      if (data.kind !== undefined && !isEmployeeKind(data.kind)) {
        throw new ForbiddenError('You cannot change this log to that kind');
      }
    }
  }

  const patch: Prisma.LogUpdateInput = {};
  if (data.content !== undefined) patch.content = data.content;
  if (data.kind !== undefined) patch.kind = data.kind;
  if (data.categoryIds !== undefined) {
    await ensureCategoriesInOrg(orgId, data.categoryIds);
    patch.categories = { set: data.categoryIds.map((id) => ({ id })) };
  }
  if (data.jiraUrl !== undefined) patch.jiraUrl = data.jiraUrl ?? null;

  if (data.customerId !== undefined) {
    if (data.customerId) {
      await ensureCustomerInOrg(orgId, data.customerId);
      patch.customer = { connect: { id: data.customerId } };
    } else {
      patch.customer = { disconnect: true };
    }
  }
  if (data.projectId !== undefined) {
    if (data.projectId) {
      await ensureProjectInOrg(orgId, data.projectId);
      patch.project = { connect: { id: data.projectId } };
    } else {
      patch.project = { disconnect: true };
    }
  }

  return prisma.log.update({
    where: { id },
    data: patch,
    include: logInclude,
  });
}

export async function deleteLog(
  orgId: string,
  id: string,
  requestingUserId: string,
  requestingUserRole: string
): Promise<void> {
  const existing = await prisma.log.findFirst({ where: { id, orgId } });
  if (!existing) throw new NotFoundError('Log not found');
  const isAuthor = existing.authorUserId === requestingUserId;
  const admin = isAdminRole(requestingUserRole);
  if (!admin && !isAuthor) {
    throw new ForbiddenError('You cannot delete this log');
  }
  await prisma.log.delete({ where: { id } });
}

// --- Thread comments ---
// v1 participants: entry author (PM), the subject's managers, admins. The
// subject employee neither sees PM entries nor comments anywhere — their
// manager mediates the conversation and documents the outcome.

export async function addLogComment(
  orgId: string,
  logId: string,
  requestingUserId: string,
  requestingUserRole: string,
  content: string
) {
  const log = await prisma.log.findFirst({ where: { id: logId, orgId } });
  if (!log) throw new NotFoundError('Log not found');

  if (!isAdminRole(requestingUserRole)) {
    if (requestingUserRole === 'viewer') {
      throw new ForbiddenError('You cannot comment on logs');
    }
    // The subject of an entry never participates in its thread (v1).
    const self = await findResourceForUser(orgId, requestingUserId);
    if (self?.id === log.resourceId) {
      throw new ForbiddenError('You cannot comment on logs about yourself');
    }
  }

  return prisma.logComment.create({
    data: { orgId, logId, authorUserId: requestingUserId, content },
    include: { authorUser: { select: authorSelect } },
  });
}

export async function deleteLogComment(
  orgId: string,
  logId: string,
  commentId: string,
  requestingUserId: string,
  requestingUserRole: string
): Promise<void> {
  const comment = await prisma.logComment.findFirst({
    where: { id: commentId, logId, orgId },
  });
  if (!comment) throw new NotFoundError('Comment not found');
  const isAuthor = comment.authorUserId === requestingUserId;
  if (!isAuthor && !isAdminRole(requestingUserRole)) {
    throw new ForbiddenError('You cannot delete this comment');
  }
  await prisma.logComment.delete({ where: { id: commentId } });
}
