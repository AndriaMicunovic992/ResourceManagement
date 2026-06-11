import { prisma } from '../db/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import type { VisibilityScope } from './visibility.service.js';

const reviewInclude = {
  authorUser: { select: { id: true, name: true, email: true } },
} as const;

/** PM review sessions: admins and the customer's responsible person. */
function assertCanReview(scope: VisibilityScope, customerId: string): void {
  if (scope.isAdmin) return;
  if (scope.responsibleCustomerIds.has(customerId)) return;
  throw new ForbiddenError('Only the responsible person can run customer reviews');
}

export const customerReviewService = {
  async list(orgId: string, scope: VisibilityScope, customerId: string) {
    assertCanReview(scope, customerId);
    return prisma.customerReview.findMany({
      where: { orgId, customerId },
      orderBy: { reviewDate: 'desc' },
      include: reviewInclude,
    });
  },

  async get(orgId: string, scope: VisibilityScope, customerId: string, id: string) {
    assertCanReview(scope, customerId);
    const review = await prisma.customerReview.findFirst({
      where: { id, orgId, customerId },
      include: reviewInclude,
    });
    if (!review) throw new NotFoundError('Review not found');
    return review;
  },

  async create(
    orgId: string,
    scope: VisibilityScope,
    customerId: string,
    authorUserId: string,
    reviewDate?: string
  ) {
    assertCanReview(scope, customerId);
    const customer = await prisma.customer.findFirst({ where: { id: customerId, orgId } });
    if (!customer) throw new NotFoundError('Customer not found');
    return prisma.customerReview.create({
      data: {
        orgId,
        customerId,
        authorUserId,
        reviewDate: reviewDate ? new Date(reviewDate) : new Date(),
      },
      include: reviewInclude,
    });
  },

  async remove(
    orgId: string,
    scope: VisibilityScope,
    customerId: string,
    id: string,
    requesterId: string
  ) {
    assertCanReview(scope, customerId);
    const review = await prisma.customerReview.findFirst({ where: { id, orgId, customerId } });
    if (!review) throw new NotFoundError('Review not found');
    if (review.authorUserId !== requesterId && !scope.isAdmin) {
      throw new ForbiddenError('Only the author or an admin can delete a review');
    }
    await prisma.customerReview.delete({ where: { id } });
  },
};
