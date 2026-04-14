import { prisma } from '../db/prisma.js';
import { isAdminRole } from './personAccess.service.js';

/**
 * Access control for customer detail pages.
 *
 * Rules (from Step 12 brief):
 *   - admin / owner roles can view any customer in their org
 *   - otherwise, the requesting user can view a customer iff the user is
 *     linked to a Resource in the org and that Resource is the customer's
 *     responsiblePersonId
 *
 * Unauthorized access is surfaced as 404 (not 403) — we hide existence.
 */
export async function canViewCustomer(
  orgId: string,
  customerId: string,
  requestingUserId: string,
  requestingUserRole: string
): Promise<boolean> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, orgId },
    select: { id: true, responsiblePersonId: true },
  });
  if (!customer) return false;

  if (isAdminRole(requestingUserRole)) return true;

  if (!customer.responsiblePersonId) return false;

  const me = await prisma.resource.findFirst({
    where: { orgId, userId: requestingUserId },
    select: { id: true },
  });
  if (!me) return false;

  return customer.responsiblePersonId === me.id;
}

/**
 * Returns the set of customer ids in the org that the requesting user can
 * view. Admins get every customer; everyone else gets the customers where
 * they are the responsible person.
 */
export async function listViewableCustomerIds(
  orgId: string,
  requestingUserId: string,
  requestingUserRole: string
): Promise<string[]> {
  if (isAdminRole(requestingUserRole)) {
    const customers = await prisma.customer.findMany({
      where: { orgId },
      select: { id: true },
    });
    return customers.map((c) => c.id);
  }

  const me = await prisma.resource.findFirst({
    where: { orgId, userId: requestingUserId },
    select: { id: true },
  });
  if (!me) return [];

  const customers = await prisma.customer.findMany({
    where: { orgId, responsiblePersonId: me.id },
    select: { id: true },
  });
  return customers.map((c) => c.id);
}
