import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import type {
  CreateLogInput,
  UpdateLogInput,
  ListLogsQuery,
} from '../schemas/log.schema.js';

const customerSelect = { id: true, name: true } as const;
const projectSelect = { id: true, name: true } as const;
const authorSelect = { id: true, name: true, email: true } as const;
const oneOnOneSelect = { id: true, meetingDate: true } as const;

const logInclude = {
  customer: { select: customerSelect },
  project: { select: projectSelect },
  authorUser: { select: authorSelect },
  oneOnOne: { select: oneOnOneSelect },
} as const;

function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'owner';
}

async function ensureResourceInOrg(orgId: string, resourceId: string): Promise<void> {
  const resource = await prisma.resource.findFirst({ where: { id: resourceId, orgId } });
  if (!resource) throw new NotFoundError('Resource not found');
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
  _requestingUserId: string,
  requestingUserRole: string
) {
  await ensureResourceInOrg(orgId, resourceId);

  if (!isAdminRole(requestingUserRole)) return [];

  const where: Prisma.LogWhereInput = { orgId, resourceId };
  if (filters.kind) where.kind = filters.kind;
  if (filters.dimensionCode) where.dimensionCode = filters.dimensionCode;
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
  _requestingUserId: string,
  requestingUserRole: string
) {
  const log = await prisma.log.findFirst({
    where: { id, orgId },
    include: logInclude,
  });
  if (!log) throw new NotFoundError('Log not found');
  if (!isAdminRole(requestingUserRole)) {
    // Don't leak existence.
    throw new NotFoundError('Log not found');
  }
  return log;
}

export async function createLog(
  orgId: string,
  resourceId: string,
  authorUserId: string,
  data: CreateLogInput
) {
  await ensureResourceInOrg(orgId, resourceId);

  if (data.customerId) await ensureCustomerInOrg(orgId, data.customerId);
  if (data.projectId) await ensureProjectInOrg(orgId, data.projectId);
  if (data.oneOnOneId) await ensureOneOnOneForResource(orgId, data.oneOnOneId, resourceId);

  return prisma.log.create({
    data: {
      orgId,
      resourceId,
      authorUserId,
      content: data.content,
      kind: data.kind,
      dimensionCode: data.dimensionCode ?? null,
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
  data: UpdateLogInput
) {
  const existing = await prisma.log.findFirst({ where: { id, orgId } });
  if (!existing) throw new NotFoundError('Log not found');
  if (existing.authorUserId !== requestingUserId) {
    throw new ForbiddenError('Only the author can edit a log');
  }

  const patch: Prisma.LogUpdateInput = {};
  if (data.content !== undefined) patch.content = data.content;
  if (data.kind !== undefined) patch.kind = data.kind;
  if (data.dimensionCode !== undefined) patch.dimensionCode = data.dimensionCode ?? null;
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
  const isAdmin = isAdminRole(requestingUserRole);
  if (!isAuthor && !isAdmin) {
    throw new ForbiddenError('You cannot delete this log');
  }
  await prisma.log.delete({ where: { id } });
}
