import { prisma } from '../db/prisma.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.js';
import { scopeFor, type PermissionMatrix, type Scope } from '../lib/permissions.js';

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
  level: number,
  permissions?: PermissionMatrix | null
): Promise<VisibilityScope> {
  // Visibility tier follows the role's level so custom roles behave like their
  // base level (owner & admin → all, member → team, viewer → own). Per-segment
  // read scoping comes in the next stage.
  const role: Role = level >= 3 ? 'admin' : level <= 1 ? 'viewer' : 'member';
  const admin = role === 'admin';

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
  // Managers are keyed on the login user (a member), so this no longer needs a
  // self Resource — an account manager who isn't a staffable person still sees
  // the people and teams they manage.
  const managedPersonIds = new Set<string>();
  {
    // Direct manager links.
    const direct = await prisma.personManager.findMany({
      where: { orgId, managerUserId: userId },
      select: { personId: true },
    });
    for (const d of direct) managedPersonIds.add(d.personId);

    // Team-inherited: any team where I'm the manager -> all team members.
    const managedTeams = await prisma.team.findMany({
      where: { orgId, managerUserId: userId },
      include: { resources: { select: { id: true } } },
    });
    for (const t of managedTeams) {
      for (const r of t.resources) managedPersonIds.add(r.id);
    }
    if (selfResourceId) managedPersonIds.delete(selfResourceId);
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

  // Honor the role's per-segment scope (own/team/all) for member-tier roles.
  // Without a matrix (e.g. legacy callers) this is a no-op and the team-based
  // computation above stands — preserving the default member behavior. The
  // matrix's default member scope is 'team', so default roles are unchanged;
  // only a custom role that widens to 'all' or narrows to 'own' shifts here.
  if (permissions) {
    const peopleScope: Scope = scopeFor(permissions, 'people');
    const customerScope: Scope = scopeFor(permissions, 'customers');

    if (peopleScope === 'own') {
      visiblePersonIds.clear();
      if (selfResourceId) visiblePersonIds.add(selfResourceId);
    } else if (peopleScope === 'all') {
      const all = await prisma.resource.findMany({ where: { orgId }, select: { id: true } });
      for (const r of all) visiblePersonIds.add(r.id);
    }

    if (customerScope === 'all') {
      const [customers, projects] = await Promise.all([
        prisma.customer.findMany({ where: { orgId }, select: { id: true } }),
        prisma.project.findMany({ where: { orgId }, select: { id: true } }),
      ]);
      for (const c of customers) visibleCustomerIds.add(c.id);
      for (const p of projects) visibleProjectIds.add(p.id);
    } else if (customerScope === 'own') {
      // Narrow to only directly-responsible (drop customers merely reachable via
      // managed people's assignments).
      visibleCustomerIds.clear();
      visibleProjectIds.clear();
      for (const c of responsibleCustomerIds) visibleCustomerIds.add(c);
      for (const p of responsibleProjectIds) visibleProjectIds.add(p);
    }
  }

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

/**
 * Guard: every manager (of a person or team) must be a non-viewer org member.
 * Managers are login users now, not Resources. Throws on the first offender.
 */
export async function assertManagerUsersAllowed(
  orgId: string,
  userIds: (string | null | undefined)[]
): Promise<void> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return;

  const memberships = await prisma.orgMember.findMany({
    where: { orgId, userId: { in: ids } },
    select: { userId: true, role: true },
  });
  const byUser = new Map(memberships.map((m) => [m.userId, m.role]));
  for (const id of ids) {
    const role = byUser.get(id);
    if (!role) {
      throw new BadRequestError('A manager must be a member of this organization');
    }
    if (role === 'viewer') {
      throw new BadRequestError('A viewer cannot be assigned as a manager');
    }
  }
}
