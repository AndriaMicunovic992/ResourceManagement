import { prisma } from '../db/prisma.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.js';

/**
 * Visibility scope - the set of things a requesting user can see in an org.
 *
 * Computed once per request by the auth hook and attached to request.visibility.
 * Never cache across requests: responsibilities/team membership change.
 *
 * Rules (Step 13 visibility-model redesign):
 *   - admin/owner: sees everything in the org.
 *   - member: sees themself, anyone they manage (direct + team-inherited),
 *     and any people/projects that roll up through a customer they are
 *     responsible for (or a project they are directly responsible for).
 *   - viewer: sees only themself.
 *
 * Visibility == existence. Asserts 404, not 403.
 */
export type Role = 'owner' | 'admin' | 'member' | 'viewer';

export interface VisibilityScope {
  orgId: string;
  userId: string;
  role: Role;
  isAdmin: boolean;
  /** Requesting user's own Resource id in this org (if any). */
  selfResourceId: string | null;
  /** Resources the user directly or team-inherited manages (excluding self). */
  managedPersonIds: Set<string>;
  /** Customers where the user is the responsiblePerson. */
  responsibleCustomerIds: Set<string>;
  /** Projects where the user is the project-responsible, or whose customer is. */
  responsibleProjectIds: Set<string>;
  /**
   * Everyone the user may see as a "person". Includes self + managed +
   * every resource currently assigned to a responsibleProject (they show up
   * on customer tabs even if not directly managed).
   */
  visiblePersonIds: Set<string>;
  /** Customers the user may see (responsible + customers of managed people's assignments for drill-throughs). */
  visibleCustomerIds: Set<string>;
  /** Projects the user may see. */
  visibleProjectIds: Set<string>;
}

function normalizeRole(role: string): Role {
  if (role === 'owner' || role === 'admin' || role === 'member' || role === 'viewer') return role;
  return 'viewer';
}

export function isAdmin(role: string): boolean {
  return role === 'admin' || role === 'owner';
}

export async function computeVisibility(
  orgId: string,
  userId: string,
  roleString: string
): Promise<VisibilityScope> {
  const role = normalizeRole(roleString);
  const admin = isAdmin(role);

  // Resolve self resource (may be null if the user has no linked Resource).
  const self = await prisma.resource.findFirst({
    where: { orgId, userId },
    select: { id: true },
  });
  const selfResourceId = self?.id ?? null;

  if (admin) {
    // Admin sees everything. We still populate the sets so callers can use
    // .has() uniformly, but most routes short-circuit on isAdmin.
    const [resources, customers, projects] = await Promise.all([
      prisma.resource.findMany({ where: { orgId }, select: { id: true } }),
      prisma.customer.findMany({ where: { orgId }, select: { id: true } }),
      prisma.project.findMany({ where: { orgId }, select: { id: true } }),
    ]);
    const visiblePersonIds = new Set(resources.map((r) => r.id));
    const visibleCustomerIds = new Set(customers.map((c) => c.id));
    const visibleProjectIds = new Set(projects.map((p) => p.id));
    return {
      orgId,
      userId,
      role,
      isAdmin: true,
      selfResourceId,
      managedPersonIds: new Set(),
      responsibleCustomerIds: visibleCustomerIds,
      responsibleProjectIds: visibleProjectIds,
      visiblePersonIds,
      visibleCustomerIds,
      visibleProjectIds,
    };
  }

  // Viewer: only themself. Their allocation display uses a dedicated
  // /me/allocations endpoint so we don't have to broaden customer/project
  // visibility just to render project names.
  if (role === 'viewer') {
    const visiblePersonIds = new Set<string>();
    if (selfResourceId) visiblePersonIds.add(selfResourceId);
    return {
      orgId,
      userId,
      role,
      isAdmin: false,
      selfResourceId,
      managedPersonIds: new Set(),
      responsibleCustomerIds: new Set(),
      responsibleProjectIds: new Set(),
      visiblePersonIds,
      visibleCustomerIds: new Set(),
      visibleProjectIds: new Set(),
    };
  }

  // Member: self + managed + responsible-customer-scoped projects/people.
  const managedPersonIds = new Set<string>();
  if (selfResourceId) {
    // Direct manager links.
    const direct = await prisma.personManager.findMany({
      where: { orgId, managerId: selfResourceId },
      select: { personId: true },
    });
    for (const d of direct) managedPersonIds.add(d.personId);

    // Team-inherited: any team where self is the manager -> all team members.
    const managedTeams = await prisma.team.findMany({
      where: { orgId, managerId: selfResourceId },
      include: { resources: { select: { id: true } } },
    });
    for (const t of managedTeams) {
      for (const r of t.resources) managedPersonIds.add(r.id);
    }
    managedPersonIds.delete(selfResourceId);
  }

  // Responsible customers: directly-responsible. Responsibility is keyed on the
  // login user (any org member can be responsible, not only staffable people).
  const responsibleCustomerIds = new Set<string>();
  {
    const custs = await prisma.customer.findMany({
      where: { orgId, responsibleUserId: userId },
      select: { id: true },
    });
    for (const c of custs) responsibleCustomerIds.add(c.id);
  }

  // Responsible projects: any project under a responsible customer, plus
  // projects directly-responsible.
  const responsibleProjectIds = new Set<string>();
  {
    const directProjects = await prisma.project.findMany({
      where: { orgId, responsibleUserId: userId },
      select: { id: true, customerId: true },
    });
    for (const p of directProjects) {
      responsibleProjectIds.add(p.id);
      // A direct-responsible project also makes the parent customer visible.
      responsibleCustomerIds.add(p.customerId);
    }
  }
  if (responsibleCustomerIds.size > 0) {
    const custProjects = await prisma.project.findMany({
      where: { orgId, customerId: { in: [...responsibleCustomerIds] } },
      select: { id: true },
    });
    for (const p of custProjects) responsibleProjectIds.add(p.id);
  }

  // Visible people: self + managed + anyone assigned to any visible project.
  const visiblePersonIds = new Set<string>(managedPersonIds);
  if (selfResourceId) visiblePersonIds.add(selfResourceId);
  if (responsibleProjectIds.size > 0) {
    const needs = await prisma.need.findMany({
      where: { orgId, projectId: { in: [...responsibleProjectIds] } },
      select: { id: true },
    });
    const needIds = needs.map((n) => n.id);
    if (needIds.length > 0) {
      const assigns = await prisma.assignment.findMany({
        where: { orgId, needId: { in: needIds } },
        select: { resourceId: true },
      });
      for (const a of assigns) visiblePersonIds.add(a.resourceId);
    }
  }

  const visibleCustomerIds = new Set<string>(responsibleCustomerIds);
  const visibleProjectIds = new Set<string>(responsibleProjectIds);

  return {
    orgId,
    userId,
    role,
    isAdmin: false,
    selfResourceId,
    managedPersonIds,
    responsibleCustomerIds,
    responsibleProjectIds,
    visiblePersonIds,
    visibleCustomerIds,
    visibleProjectIds,
  };
}

export function assertCanViewPerson(scope: VisibilityScope, personId: string): void {
  if (scope.isAdmin) return;
  if (!scope.visiblePersonIds.has(personId)) {
    throw new NotFoundError('Person not found');
  }
}

export function assertCanViewCustomer(scope: VisibilityScope, customerId: string): void {
  if (scope.isAdmin) return;
  if (!scope.visibleCustomerIds.has(customerId)) {
    throw new NotFoundError('Customer not found');
  }
}

export function assertCanViewProject(scope: VisibilityScope, projectId: string): void {
  if (scope.isAdmin) return;
  if (!scope.visibleProjectIds.has(projectId)) {
    throw new NotFoundError('Project not found');
  }
}

/**
 * True if the requesting user is viewing their own person card. Used by routes
 * that expose self-specific capabilities (own performance, own 1:1 list).
 */
export function isSelf(scope: VisibilityScope, personId: string): boolean {
  return scope.selfResourceId === personId;
}

/**
 * Guard: admin-only mutations. Throws ForbiddenError (true 403) for anything
 * below admin. Used for customer/project/need/assignment write endpoints.
 */
export function assertAdmin(scope: VisibilityScope): void {
  if (!scope.isAdmin) throw new ForbiddenError('Admin only');
}

/**
 * Validate that none of the supplied Resource ids belong to a user whose
 * org membership is 'viewer'. Viewers cannot be assigned as managers or as
 * customer/project responsibles. Throws a 400-shaped error on the first
 * offender. Returns quietly if all are fine (including resources with no
 * linked user).
 */
export async function assertNoViewerResources(
  orgId: string,
  resourceIds: (string | null | undefined)[]
): Promise<void> {
  const ids = [...new Set(resourceIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return;

  const resources = await prisma.resource.findMany({
    where: { orgId, id: { in: ids } },
    select: { id: true, userId: true },
  });
  const userIds = resources
    .map((r) => r.userId)
    .filter((u): u is string => !!u);
  if (userIds.length === 0) return;

  const memberships = await prisma.orgMember.findMany({
    where: { orgId, userId: { in: userIds } },
    select: { userId: true, role: true },
  });
  const viewerUserIds = new Set(
    memberships.filter((m) => m.role === 'viewer').map((m) => m.userId)
  );
  if (viewerUserIds.size === 0) return;
  const badIds = resources
    .filter((r) => r.userId && viewerUserIds.has(r.userId))
    .map((r) => r.id);
  if (badIds.length > 0) {
    throw new BadRequestError(
      'A viewer cannot be assigned as a manager or responsible person'
    );
  }
}

/**
 * Guard: a responsible person must be a non-viewer org member. Throws if the
 * given user isn't a member of the org, or is a viewer.
 */
export async function assertResponsibleUserAllowed(
  orgId: string,
  userId: string | null | undefined
): Promise<void> {
  if (!userId) return;
  const member = await prisma.orgMember.findFirst({
    where: { orgId, userId },
    select: { role: true },
  });
  if (!member) {
    throw new BadRequestError('Responsible person must be a member of this organization');
  }
  if (member.role === 'viewer') {
    throw new BadRequestError('A viewer cannot be assigned as a responsible person');
  }
}
