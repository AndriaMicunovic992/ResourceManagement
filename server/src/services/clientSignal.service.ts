import { prisma } from '../db/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import type { VisibilityScope } from './visibility.service.js';
import type {
  UpsertClientSignalInput,
  ListClientSignalsQuery,
} from '../schemas/clientSignal.schema.js';

const signalInclude = {
  resource: { select: { id: true, name: true } },
  authorUser: { select: { id: true, name: true, email: true } },
} as const;

/** Writing signals for a customer: admins and that customer's responsible. */
function assertCanRateForCustomer(scope: VisibilityScope, customerId: string): void {
  if (scope.isAdmin) return;
  if (scope.responsibleCustomerIds.has(customerId)) return;
  throw new ForbiddenError('Only the responsible person can rate client satisfaction');
}

function monthRangeWhere(query: ListClientSignalsQuery) {
  if (!query.from && !query.to) return {};
  const month: Record<string, string> = {};
  if (query.from) month.gte = query.from;
  if (query.to) month.lte = query.to;
  return { month };
}

export const clientSignalService = {
  async upsert(
    orgId: string,
    scope: VisibilityScope,
    customerId: string,
    authorUserId: string,
    data: UpsertClientSignalInput
  ) {
    assertCanRateForCustomer(scope, customerId);
    const customer = await prisma.customer.findFirst({ where: { id: customerId, orgId } });
    if (!customer) throw new NotFoundError('Customer not found');
    const resource = await prisma.resource.findFirst({
      where: { id: data.resourceId, orgId },
    });
    if (!resource) throw new NotFoundError('Resource not found');

    return prisma.clientSignal.upsert({
      where: {
        resourceId_customerId_month: {
          resourceId: data.resourceId,
          customerId,
          month: data.month,
        },
      },
      create: {
        orgId,
        customerId,
        resourceId: data.resourceId,
        month: data.month,
        rating: data.rating,
        note: data.note ?? null,
        authorUserId,
      },
      update: { rating: data.rating, note: data.note ?? null, authorUserId },
      include: signalInclude,
    });
  },

  async listForCustomer(
    orgId: string,
    scope: VisibilityScope,
    customerId: string,
    query: ListClientSignalsQuery
  ) {
    assertCanRateForCustomer(scope, customerId);
    return prisma.clientSignal.findMany({
      where: { orgId, customerId, ...monthRangeWhere(query) },
      orderBy: [{ resourceId: 'asc' }, { month: 'asc' }],
      include: signalInclude,
    });
  },

  /**
   * Per-person view (for the 1:1 cockpit). Hidden from the subject: a
   * non-admin may only read signals about people they can see who aren't
   * themselves.
   */
  async listForResource(
    orgId: string,
    scope: VisibilityScope,
    resourceId: string,
    query: ListClientSignalsQuery
  ) {
    if (!scope.isAdmin && scope.selfResourceId === resourceId) {
      throw new ForbiddenError('Client signals are not visible to the rated person');
    }
    return prisma.clientSignal.findMany({
      where: { orgId, resourceId, ...monthRangeWhere(query) },
      orderBy: { month: 'asc' },
      include: { ...signalInclude, customer: { select: { id: true, name: true } } },
    });
  },

  async remove(orgId: string, scope: VisibilityScope, customerId: string, id: string) {
    assertCanRateForCustomer(scope, customerId);
    const existing = await prisma.clientSignal.findFirst({ where: { id, orgId, customerId } });
    if (!existing) throw new NotFoundError('Signal not found');
    await prisma.clientSignal.delete({ where: { id } });
  },
};
