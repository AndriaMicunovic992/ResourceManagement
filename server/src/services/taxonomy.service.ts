import { prisma } from '../db/prisma.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';

/**
 * Editable role taxonomy (domains, job roles, seniorities) per org.
 *
 * ResourceRole and Need still store domain/role/seniority as name strings;
 * these tables are the source of truth for the pickers, planner colors, and
 * seniority ordering. Renames cascade to those string columns so nothing is
 * left orphaned. A term that's in use can't be deleted.
 */

// The built-in defaults, seeded for every new org (and backfilled for existing
// orgs by migration 0031). Mirrors client/src/lib/constants.js.
const DEFAULT_DOMAINS: { name: string; color: string; roles: string[] }[] = [
  { name: 'Data', color: '#3B82F6', roles: ['FE', 'BE', 'PM'] },
  { name: 'Web', color: '#F97316', roles: ['FE', 'BE', 'PM'] },
  { name: 'General', color: '#8B5CF6', roles: ['Agent', 'DevOps', 'Sales', 'AI Engineer', 'Consultant', 'PM'] },
];
const DEFAULT_SENIORITIES: { name: string; shortLabel: string; level: number }[] = [
  { name: 'Junior', shortLabel: 'Jr', level: 0 },
  { name: 'Medior', shortLabel: 'Mid', level: 1 },
  { name: 'Senior', shortLabel: 'Sr', level: 2 },
  { name: 'Senior Principal', shortLabel: 'SP', level: 3 },
];

/** Seed the default taxonomy for an org if it has none. Idempotent. */
export async function ensureTaxonomy(orgId: string): Promise<void> {
  const existing = await prisma.domain.count({ where: { orgId } });
  if (existing > 0) return;
  for (const [i, d] of DEFAULT_DOMAINS.entries()) {
    const domain = await prisma.domain.create({
      data: { orgId, name: d.name, color: d.color, sortOrder: i },
    });
    await prisma.jobRole.createMany({
      data: d.roles.map((name, j) => ({ orgId, domainId: domain.id, name, sortOrder: j })),
    });
  }
  const senCount = await prisma.seniority.count({ where: { orgId } });
  if (senCount === 0) {
    await prisma.seniority.createMany({
      data: DEFAULT_SENIORITIES.map((s) => ({ orgId, ...s })),
    });
  }
}

async function loadTaxonomy(orgId: string) {
  const [domains, seniorities] = await Promise.all([
    prisma.domain.findMany({
      where: { orgId },
      orderBy: { sortOrder: 'asc' },
      include: { jobRoles: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, sortOrder: true } } },
    }),
    prisma.seniority.findMany({ where: { orgId }, orderBy: { level: 'asc' } }),
  ]);
  return {
    domains: domains.map((d) => ({
      id: d.id,
      name: d.name,
      color: d.color,
      sortOrder: d.sortOrder,
      roles: d.jobRoles,
    })),
    seniorities: seniorities.map((s) => ({
      id: s.id,
      name: s.name,
      shortLabel: s.shortLabel,
      level: s.level,
    })),
  };
}

async function getDomainOrThrow(orgId: string, id: string) {
  const d = await prisma.domain.findFirst({ where: { id, orgId } });
  if (!d) throw new NotFoundError('Domain not found');
  return d;
}

async function getJobRoleOrThrow(orgId: string, id: string) {
  const r = await prisma.jobRole.findFirst({ where: { id, orgId }, include: { domain: true } });
  if (!r) throw new NotFoundError('Role not found');
  return r;
}

async function getSeniorityOrThrow(orgId: string, id: string) {
  const s = await prisma.seniority.findFirst({ where: { id, orgId } });
  if (!s) throw new NotFoundError('Seniority not found');
  return s;
}

export const taxonomyService = {
  async get(orgId: string) {
    await ensureTaxonomy(orgId);
    return loadTaxonomy(orgId);
  },

  // --- Domains ---
  async createDomain(orgId: string, data: { name: string; color: string }) {
    const max = await prisma.domain.aggregate({ where: { orgId }, _max: { sortOrder: true } });
    try {
      await prisma.domain.create({
        data: { orgId, name: data.name.trim(), color: data.color, sortOrder: (max._max.sortOrder ?? -1) + 1 },
      });
    } catch (e) {
      throw new ConflictError('A domain with that name already exists');
    }
    return loadTaxonomy(orgId);
  },

  async updateDomain(orgId: string, id: string, data: { name?: string; color?: string }) {
    const domain = await getDomainOrThrow(orgId, id);
    const newName = data.name?.trim();
    const ops: any[] = [];
    ops.push(
      prisma.domain.update({
        where: { id },
        data: { name: newName ?? undefined, color: data.color ?? undefined },
      })
    );
    // Cascade a rename to the string columns that reference this domain.
    if (newName && newName !== domain.name) {
      ops.push(
        prisma.resourceRole.updateMany({ where: { resource: { orgId }, domain: domain.name }, data: { domain: newName } }),
        prisma.need.updateMany({ where: { orgId, domain: domain.name }, data: { domain: newName } })
      );
    }
    try {
      await prisma.$transaction(ops);
    } catch (e) {
      throw new ConflictError('A domain with that name already exists');
    }
    return loadTaxonomy(orgId);
  },

  async deleteDomain(orgId: string, id: string) {
    const domain = await getDomainOrThrow(orgId, id);
    const inUse = await prisma.resourceRole.count({ where: { resource: { orgId }, domain: domain.name } });
    const inUseNeed = await prisma.need.count({ where: { orgId, domain: domain.name } });
    if (inUse + inUseNeed > 0) {
      throw new BadRequestError('This domain is in use by people or needs and cannot be deleted');
    }
    await prisma.domain.delete({ where: { id } });
    return loadTaxonomy(orgId);
  },

  // --- Job roles (nested under a domain) ---
  async createRole(orgId: string, domainId: string, name: string) {
    await getDomainOrThrow(orgId, domainId);
    const max = await prisma.jobRole.aggregate({ where: { orgId, domainId }, _max: { sortOrder: true } });
    try {
      await prisma.jobRole.create({
        data: { orgId, domainId, name: name.trim(), sortOrder: (max._max.sortOrder ?? -1) + 1 },
      });
    } catch (e) {
      throw new ConflictError('A role with that name already exists in this domain');
    }
    return loadTaxonomy(orgId);
  },

  async updateRole(orgId: string, id: string, name: string) {
    const role = await getJobRoleOrThrow(orgId, id);
    const newName = name.trim();
    const ops: any[] = [prisma.jobRole.update({ where: { id }, data: { name: newName } })];
    if (newName !== role.name) {
      // Cascade within this role's domain only (role names repeat across domains).
      ops.push(
        prisma.resourceRole.updateMany({
          where: { resource: { orgId }, domain: role.domain.name, role: role.name },
          data: { role: newName },
        }),
        prisma.need.updateMany({
          where: { orgId, domain: role.domain.name, role: role.name },
          data: { role: newName },
        })
      );
    }
    try {
      await prisma.$transaction(ops);
    } catch (e) {
      throw new ConflictError('A role with that name already exists in this domain');
    }
    return loadTaxonomy(orgId);
  },

  async deleteRole(orgId: string, id: string) {
    const role = await getJobRoleOrThrow(orgId, id);
    const inUse = await prisma.resourceRole.count({
      where: { resource: { orgId }, domain: role.domain.name, role: role.name },
    });
    const inUseNeed = await prisma.need.count({ where: { orgId, domain: role.domain.name, role: role.name } });
    if (inUse + inUseNeed > 0) {
      throw new BadRequestError('This role is in use by people or needs and cannot be deleted');
    }
    await prisma.jobRole.delete({ where: { id } });
    return loadTaxonomy(orgId);
  },

  // --- Seniorities ---
  async createSeniority(orgId: string, data: { name: string; shortLabel: string }) {
    const max = await prisma.seniority.aggregate({ where: { orgId }, _max: { level: true } });
    try {
      await prisma.seniority.create({
        data: { orgId, name: data.name.trim(), shortLabel: data.shortLabel.trim(), level: (max._max.level ?? -1) + 1 },
      });
    } catch (e) {
      throw new ConflictError('A seniority with that name already exists');
    }
    return loadTaxonomy(orgId);
  },

  async updateSeniority(orgId: string, id: string, data: { name?: string; shortLabel?: string }) {
    const sen = await getSeniorityOrThrow(orgId, id);
    const newName = data.name?.trim();
    const ops: any[] = [
      prisma.seniority.update({
        where: { id },
        data: { name: newName ?? undefined, shortLabel: data.shortLabel?.trim() ?? undefined },
      }),
    ];
    if (newName && newName !== sen.name) {
      ops.push(
        prisma.resourceRole.updateMany({ where: { resource: { orgId }, seniority: sen.name }, data: { seniority: newName } }),
        prisma.need.updateMany({ where: { orgId, seniority: sen.name }, data: { seniority: newName } })
      );
    }
    try {
      await prisma.$transaction(ops);
    } catch (e) {
      throw new ConflictError('A seniority with that name already exists');
    }
    return loadTaxonomy(orgId);
  },

  /** Move a seniority up/down in rank by swapping levels with its neighbour. */
  async moveSeniority(orgId: string, id: string, direction: 'up' | 'down') {
    const sen = await getSeniorityOrThrow(orgId, id);
    const neighbour = await prisma.seniority.findFirst({
      where: { orgId, level: direction === 'up' ? { lt: sen.level } : { gt: sen.level } },
      orderBy: { level: direction === 'up' ? 'desc' : 'asc' },
    });
    if (!neighbour) return loadTaxonomy(orgId);
    await prisma.$transaction([
      prisma.seniority.update({ where: { id: sen.id }, data: { level: neighbour.level } }),
      prisma.seniority.update({ where: { id: neighbour.id }, data: { level: sen.level } }),
    ]);
    return loadTaxonomy(orgId);
  },

  async deleteSeniority(orgId: string, id: string) {
    const sen = await getSeniorityOrThrow(orgId, id);
    const inUse = await prisma.resourceRole.count({ where: { resource: { orgId }, seniority: sen.name } });
    const inUseNeed = await prisma.need.count({ where: { orgId, seniority: sen.name } });
    if (inUse + inUseNeed > 0) {
      throw new BadRequestError('This seniority is in use by people or needs and cannot be deleted');
    }
    await prisma.seniority.delete({ where: { id } });
    return loadTaxonomy(orgId);
  },
};
