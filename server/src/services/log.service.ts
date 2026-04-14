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
  category: { select: categorySelect },
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

async function ensureCategoryInOrg(orgId: string, categoryId: string): Promise<void> {
  const category = await prisma.performanceLogCategory.findFirst({
    where: { id: categoryId, orgId },
  });
  if (!category) throw new NotFoundError('Category not found');
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
    // Non-admins can only see their own employee-kind logs on their own resource.
    const self = await findResourceForUser(orgId, requestingUserId);
    if (!self || self.id !== resourceId) return [];
    where.kind = { in: [...EMPLOYEE_LOG_KINDS] };
    if (filters.kind && isEmployeeKind(filters.kind)) where.kind = filters.kind;
  } else if (filters.kind) {
    where.kind = filters.kind;
  }

  if (filters.categoryId) where.categoryId = filters.categoryId;
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
    const self = await findResourceForUser(orgId, requestingUserId);
    const canSee =
      self &&
      self.id === log.resourceId &&
      isEmployeeKind(log.kind);
    if (!canSee) throw new NotFoundError('Log not found');
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
    // Employees can only log win/down/blocker on their own resource and cannot
    // attach to a 1:1.
    if (!isEmployeeKind(data.kind)) {
      throw new ForbiddenError('You cannot create logs of this kind');
    }
    if (data.oneOnOneId) {
      throw new ForbiddenError('Employee logs cannot be attached to a 1:1');
    }
    const self = await findResourceForUser(orgId, authorUserId);
    if (!self || self.id !== resourceId) {
      throw new ForbiddenError('You can only log against your own profile');
    }
  }

  if (data.customerId) await ensureCustomerInOrg(orgId, data.customerId);
  if (data.projectId) await ensureProjectInOrg(orgId, data.projectId);
  if (data.oneOnOneId) await ensureOneOnOneForResource(orgId, data.oneOnOneId, resourceId);
  if (data.categoryId) await ensureCategoryInOrg(orgId, data.categoryId);

  return prisma.log.create({
    data: {
      orgId,
      resourceId,
      authorUserId,
      content: data.content,
      kind: data.kind,
      categoryId: data.categoryId ?? null,
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
    // Employees can only edit their own employee-kind logs.
    if (!isEmployeeKind(existing.kind)) {
      throw new ForbiddenError('You cannot edit this log');
    }
    if (data.kind !== undefined && !isEmployeeKind(data.kind)) {
      throw new ForbiddenError('You cannot change this log to that kind');
    }
  }

  const patch: Prisma.LogUpdateInput = {};
  if (data.content !== undefined) patch.content = data.content;
  if (data.kind !== undefined) patch.kind = data.kind;
  if (data.categoryId !== undefined) {
    if (data.categoryId) {
      await ensureCategoryInOrg(orgId, data.categoryId);
      patch.category = { connect: { id: data.categoryId } };
    } else {
      patch.category = { disconnect: true };
    }
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
  if (!admin) {
    if (!isAuthor || !isEmployeeKind(existing.kind)) {
      throw new ForbiddenError('You cannot delete this log');
    }
  } else if (!isAuthor && !admin) {
    throw new ForbiddenError('You cannot delete this log');
  }
  await prisma.log.delete({ where: { id } });
}
