import { prisma } from '../db/prisma.js';

export function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'owner';
}

/**
 * Login-user ids of the managers for a given person. Includes direct managers
 * from PersonManager and inherited managers from any team the person belongs
 * to. A manager is an org User (a member), not a Resource.
 */
export async function getManagerUserIds(
  orgId: string,
  personResourceId: string
): Promise<Set<string>> {
  const person = await prisma.resource.findFirst({
    where: { id: personResourceId, orgId },
    include: {
      managerLinks: { select: { managerUserId: true } },
      teams: { select: { managerUserId: true } },
    },
  });
  if (!person) return new Set();
  const ids = new Set<string>();
  for (const link of person.managerLinks) ids.add(link.managerUserId);
  for (const t of person.teams) {
    if (t.managerUserId) ids.add(t.managerUserId);
  }
  return ids;
}

/**
 * Returns true if the requesting user (by their User.id) is a manager of the
 * given person (resourceId) — directly or via a team they manage. Managers are
 * keyed on the login user, so we match the requesting user id directly.
 */
export async function userIsManagerOf(
  orgId: string,
  requestingUserId: string,
  personResourceId: string
): Promise<boolean> {
  const managerUserIds = await getManagerUserIds(orgId, personResourceId);
  return managerUserIds.has(requestingUserId);
}

/**
 * Returns true if the requesting user is the responsible person for the
 * customer/project. Either the project's responsiblePerson OR the customer's
 * responsiblePerson counts.
 */
export async function userIsResponsibleFor(
  orgId: string,
  requestingUserId: string,
  customerId: string | null | undefined,
  projectId: string | null | undefined
): Promise<boolean> {
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: { responsibleUserId: true, customerId: true },
    });
    if (project?.responsibleUserId === requestingUserId) return true;
    if (project?.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: project.customerId, orgId },
        select: { responsibleUserId: true },
      });
      if (customer?.responsibleUserId === requestingUserId) return true;
    }
  } else if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, orgId },
      select: { responsibleUserId: true },
    });
    if (customer?.responsibleUserId === requestingUserId) return true;
  }
  return false;
}

/**
 * Resolve the requesting user's Resource id within an org (or null).
 */
export async function getRequestingResourceId(
  orgId: string,
  requestingUserId: string
): Promise<string | null> {
  const r = await prisma.resource.findFirst({
    where: { orgId, userId: requestingUserId },
    select: { id: true },
  });
  return r?.id ?? null;
}
