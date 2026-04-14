import { prisma } from '../db/prisma.js';

export function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'owner';
}

/**
 * Resource ids (managers) for a given person. Includes direct managers from
 * PersonManager and inherited managers from any team the person belongs to.
 * Excludes self.
 */
export async function getManagerResourceIds(
  orgId: string,
  personResourceId: string
): Promise<Set<string>> {
  const person = await prisma.resource.findFirst({
    where: { id: personResourceId, orgId },
    include: {
      managerLinks: { select: { managerId: true } },
      teams: { select: { managerId: true } },
    },
  });
  if (!person) return new Set();
  const ids = new Set<string>();
  for (const link of person.managerLinks) ids.add(link.managerId);
  for (const t of person.teams) {
    if (t.managerId) ids.add(t.managerId);
  }
  ids.delete(personResourceId);
  return ids;
}

/**
 * Returns true if the requesting user (by their User.id) is a manager of the
 * given person (resourceId). Maps the user to a Resource within the org and
 * checks against getManagerResourceIds.
 */
export async function userIsManagerOf(
  orgId: string,
  requestingUserId: string,
  personResourceId: string
): Promise<boolean> {
  const me = await prisma.resource.findFirst({
    where: { orgId, userId: requestingUserId },
    select: { id: true },
  });
  if (!me) return false;
  const managerIds = await getManagerResourceIds(orgId, personResourceId);
  return managerIds.has(me.id);
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
  const me = await prisma.resource.findFirst({
    where: { orgId, userId: requestingUserId },
    select: { id: true },
  });
  if (!me) return false;
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: { responsiblePersonId: true, customerId: true },
    });
    if (project?.responsiblePersonId === me.id) return true;
    if (project?.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: project.customerId, orgId },
        select: { responsiblePersonId: true },
      });
      if (customer?.responsiblePersonId === me.id) return true;
    }
  } else if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, orgId },
      select: { responsiblePersonId: true },
    });
    if (customer?.responsiblePersonId === me.id) return true;
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
