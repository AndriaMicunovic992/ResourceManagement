import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { monthRange } from '../utils/months.js';
import { NotFoundError } from '../utils/errors.js';
import { isAdminRole, userIsManagerOf } from './personAccess.service.js';
import type { InsightsFilterQuery } from '../schemas/insights.schema.js';

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function dateToYearMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function parseDateOnly(value: string, endOfDay: boolean): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
    return new Date(`${value}${suffix}`);
  }
  return new Date(value);
}

/**
 * For a given person (resource) and date window, sum their FTE allocation to
 * the project (if projectId set) or any project under the customer (if only
 * customerId set), across the months overlapping the window.
 */
export async function allocationForScope(
  resourceId: string,
  customerId: string | null,
  projectId: string | null,
  windowStart: Date,
  windowEnd: Date
): Promise<number> {
  const months = monthRange(dateToYearMonth(windowStart), dateToYearMonth(windowEnd));
  if (months.length === 0) return 0;

  // Pull this resource's assignments with their need + project info.
  const assignments = await prisma.assignment.findMany({
    where: { resourceId },
    include: {
      need: {
        include: {
          project: { select: { id: true, customerId: true } },
        },
      },
    },
  });
  let total = 0;
  for (const a of assignments) {
    const proj = a.need.project;
    if (projectId) {
      if (proj.id !== projectId) continue;
    } else if (customerId) {
      if (proj.customerId !== customerId) continue;
    }
    const allocs = (a.monthAllocations as Record<string, number>) || {};
    for (const m of months) {
      const v = allocs[m];
      if (typeof v === 'number') total += v;
    }
  }
  return total;
}

/**
 * Total capacity over the window = capacity * months count.
 */
export async function totalCapacity(resourceId: string, windowStart: Date, windowEnd: Date): Promise<number> {
  const months = monthRange(dateToYearMonth(windowStart), dateToYearMonth(windowEnd));
  if (months.length === 0) return 0;
  const r = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { capacity: true },
  });
  if (!r) return 0;
  return r.capacity * months.length;
}

export type PerformanceBreakdownEntry = {
  id: string;
  scope: { customerName: string; projectName: string | null };
  finalNumber: number;
  allocationShare: number;
  normalizedWeight: number;
  periodStart: Date;
  periodEnd: Date;
};

export type PerformanceOverall = {
  overall: number | null;
  evaluations: PerformanceBreakdownEntry[];
};

async function ensureCanReadPerson(orgId: string, requestingUserId: string, requestingUserRole: string, resourceId: string): Promise<void> {
  if (isAdminRole(requestingUserRole)) return;
  const ok = await userIsManagerOf(orgId, requestingUserId, resourceId);
  if (!ok) {
    // Subjects can read their own overall (they see only their numbers).
    const me = await prisma.resource.findFirst({
      where: { orgId, userId: requestingUserId },
      select: { id: true },
    });
    if (!me || me.id !== resourceId) throw new NotFoundError('Resource not found');
  }
}

export const performanceService = {
  async overall(
    orgId: string,
    resourceId: string,
    requestingUserId: string,
    requestingUserRole: string,
    fromStr?: string,
    toStr?: string,
    customerId?: string,
    projectId?: string
  ): Promise<PerformanceOverall> {
    await ensureCanReadPerson(orgId, requestingUserId, requestingUserRole, resourceId);
    const resource = await prisma.resource.findFirst({ where: { id: resourceId, orgId } });
    if (!resource) throw new NotFoundError('Resource not found');

    const windowStart = fromStr ? parseDateOnly(fromStr, false) : new Date(0);
    // Default upper bound is far in the future so finalized evaluations whose
    // period ends in the future are still counted.
    const windowEnd = toStr ? parseDateOnly(toStr, true) : new Date('9999-12-31T23:59:59.999Z');

    const where: {
      orgId: string;
      resourceId: string;
      state: string;
      periodEnd: { gte: Date; lte: Date };
      customerId?: string;
      projectId?: string;
    } = {
      orgId,
      resourceId,
      state: 'finalized',
      periodEnd: { gte: windowStart, lte: windowEnd },
    };
    if (customerId) where.customerId = customerId;
    if (projectId) where.projectId = projectId;

    const evaluations = await prisma.evaluation.findMany({
      where,
      orderBy: { periodEnd: 'asc' },
    });

    if (evaluations.length === 0) {
      return { overall: null, evaluations: [] };
    }

    // For each evaluation, compute its FTE allocation share over its window.
    const rawShares: { e: typeof evaluations[number]; share: number; finalNumber: number }[] = [];
    for (const e of evaluations) {
      const share = await allocationForScope(
        resourceId,
        e.customerId,
        e.projectId,
        e.periodStart,
        e.periodEnd
      );
      const finalNumber = e.overrideFinal ?? e.computedFinal ?? 0;
      rawShares.push({ e, share, finalNumber });
    }

    const allocSum = rawShares.reduce((acc, r) => acc + r.share, 0);
    // Capacity over the broadest window (min start, max end)
    const minStart = rawShares.reduce((acc, r) => (r.e.periodStart < acc ? r.e.periodStart : acc), rawShares[0].e.periodStart);
    const maxEnd = rawShares.reduce((acc, r) => (r.e.periodEnd > acc ? r.e.periodEnd : acc), rawShares[0].e.periodEnd);
    const capacity = await totalCapacity(resourceId, minStart, maxEnd);

    // Compute initial normalized weights from shares, distribute unutilised
    // proportionally so weights still sum to 1.
    let weights: number[];
    if (allocSum === 0) {
      // No allocation data: equal weighting.
      weights = rawShares.map(() => 1 / rawShares.length);
    } else {
      const baseShares = rawShares.map((r) => r.share / allocSum);
      const utilizationFraction = capacity > 0 ? Math.min(1, allocSum / capacity) : 1;
      // Each base share becomes baseShare * utilizationFraction; the gap
      // (1 - utilizationFraction) gets distributed proportionally back, which
      // is mathematically the same as just using baseShares — so the
      // normalized weights are just the baseShares.
      weights = baseShares;
      // Touch utilizationFraction so it isn't unused (the comment above
      // documents why it cancels out).
      void utilizationFraction;
    }

    let overallSum = 0;
    const breakdown: PerformanceBreakdownEntry[] = rawShares.map((r, i) => {
      overallSum += r.finalNumber * weights[i];
      return {
        id: r.e.id,
        scope: {
          customerName: r.e.customerNameSnapshot,
          projectName: r.e.projectNameSnapshot ?? null,
        },
        finalNumber: r.finalNumber,
        allocationShare: r.share,
        normalizedWeight: weights[i],
        periodStart: r.e.periodStart,
        periodEnd: r.e.periodEnd,
      };
    });

    return { overall: round1(overallSum), evaluations: breakdown };
  },

  async categoryBreakdown(
    orgId: string,
    resourceId: string,
    requestingUserId: string,
    requestingUserRole: string,
    filters: {
      customerId?: string | null;
      projectId?: string | null;
      from?: string;
      to?: string;
    }
  ): Promise<
    {
      grouping: string | null;
      categoryName: string;
      averageScore: number;
      evaluationCount: number;
    }[]
  > {
    await ensureCanReadPerson(orgId, requestingUserId, requestingUserRole, resourceId);

    const windowStart = filters.from ? parseDateOnly(filters.from, false) : new Date(0);
    const windowEnd = filters.to
      ? parseDateOnly(filters.to, true)
      : new Date('9999-12-31T23:59:59.999Z');

    const where: {
      orgId: string;
      resourceId: string;
      state: string;
      customerId?: string;
      projectId?: string | null;
      periodEnd: { gte: Date; lte: Date };
    } = {
      orgId,
      resourceId,
      state: 'finalized',
      periodEnd: { gte: windowStart, lte: windowEnd },
    };
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.projectId) where.projectId = filters.projectId;

    const evaluations = await prisma.evaluation.findMany({
      where,
      include: {
        categorySnapshots: true,
        scores: { select: { categorySnapshotId: true, responsibleScore: true } },
      },
    });
    if (evaluations.length === 0) return [];

    // Aggregate by (grouping, categoryName). Snapshot-level so renames across
    // time show up as separate rows — matches the "snapshots never re-read"
    // guarantee the rest of the system relies on.
    type Bucket = {
      grouping: string | null;
      categoryName: string;
      sortOrder: number;
      sum: number;
      count: number;
    };
    const buckets = new Map<string, Bucket>();
    for (const e of evaluations) {
      for (const snap of e.categorySnapshots) {
        const score = e.scores.find((s) => s.categorySnapshotId === snap.id);
        if (!score || score.responsibleScore == null) continue;
        const key = `${snap.categoryGroupingSnapshot ?? ''}::${snap.categoryNameSnapshot}`;
        const existing = buckets.get(key);
        if (existing) {
          existing.sum += score.responsibleScore;
          existing.count += 1;
        } else {
          buckets.set(key, {
            grouping: snap.categoryGroupingSnapshot ?? null,
            categoryName: snap.categoryNameSnapshot,
            sortOrder: snap.sortOrderSnapshot,
            sum: score.responsibleScore,
            count: 1,
          });
        }
      }
    }

    const sorted = Array.from(buckets.values()).sort((a, b) => {
      const ga = a.grouping ?? '';
      const gb = b.grouping ?? '';
      if (ga !== gb) return ga.localeCompare(gb);
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.categoryName.localeCompare(b.categoryName);
    });
    return sorted.map((b) => ({
      grouping: b.grouping,
      categoryName: b.categoryName,
      averageScore: round1(b.sum / b.count),
      evaluationCount: b.count,
    }));
  },

  async trend(
    orgId: string,
    resourceId: string,
    requestingUserId: string,
    requestingUserRole: string,
    bucket: 'month' | 'quarter',
    fromStr?: string,
    toStr?: string,
    customerId?: string,
    projectId?: string
  ): Promise<{ bucketStart: string; overall: number; evaluationCount: number }[]> {
    await ensureCanReadPerson(orgId, requestingUserId, requestingUserRole, resourceId);

    const windowStart = fromStr ? parseDateOnly(fromStr, false) : new Date(0);
    const windowEnd = toStr ? parseDateOnly(toStr, true) : new Date('9999-12-31T23:59:59.999Z');

    const where: {
      orgId: string;
      resourceId: string;
      state: string;
      periodEnd: { gte: Date; lte: Date };
      customerId?: string;
      projectId?: string;
    } = {
      orgId,
      resourceId,
      state: 'finalized',
      periodEnd: { gte: windowStart, lte: windowEnd },
    };
    if (customerId) where.customerId = customerId;
    if (projectId) where.projectId = projectId;

    const evaluations = await prisma.evaluation.findMany({
      where,
      orderBy: { periodEnd: 'asc' },
    });
    if (evaluations.length === 0) return [];

    function bucketKey(d: Date): string {
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      if (bucket === 'quarter') {
        const q = Math.ceil(m / 3);
        return `${y}-Q${q}`;
      }
      return `${y}-${String(m).padStart(2, '0')}`;
    }

    const groups = new Map<string, typeof evaluations>();
    for (const e of evaluations) {
      const key = bucketKey(e.periodEnd);
      if (!groups.has(key)) groups.set(key, []);
      (groups.get(key) as typeof evaluations).push(e);
    }

    const out: { bucketStart: string; overall: number; evaluationCount: number }[] = [];
    for (const [key, evs] of groups.entries()) {
      // For each bucket, compute the per-bucket overall using just those evals
      // (equal weighting; the per-evaluation allocation rollup applies to the
      // combined endpoint, not to small buckets).
      const sum = evs.reduce((acc, e) => acc + (e.overrideFinal ?? e.computedFinal ?? 0), 0);
      out.push({
        bucketStart: key,
        overall: round1(sum / evs.length),
        evaluationCount: evs.length,
      });
    }
    return out;
  },

  // ==========================================================================
  // Org-wide insights (admin-only). All filters AND-combine.
  // ==========================================================================

  /**
   * Resolve the set of resourceIds in this org that match the filter
   * (team / domain / role / seniority). Returns all org resources if no
   * filter is provided.
   */
  async _resolveFilteredResourceIds(orgId: string, filters: InsightsFilterQuery): Promise<string[]> {
    const where: Prisma.ResourceWhereInput = { orgId };
    if (filters.teamId) {
      where.teams = { some: { id: filters.teamId } };
    }
    const needsRoleFilter = !!(filters.domain || filters.role || filters.seniority);
    if (needsRoleFilter) {
      const roleWhere: Prisma.ResourceRoleWhereInput = {};
      if (filters.domain) roleWhere.domain = filters.domain;
      if (filters.role) roleWhere.role = filters.role;
      if (filters.seniority) roleWhere.seniority = filters.seniority;
      where.roles = { some: roleWhere };
    }
    const resources = await prisma.resource.findMany({ where, select: { id: true } });
    return resources.map((r) => r.id);
  },

  async _getFilteredEvaluations(orgId: string, filters: InsightsFilterQuery) {
    const resourceIds = await this._resolveFilteredResourceIds(orgId, filters);
    if (resourceIds.length === 0) return [];
    const windowStart = filters.from ? parseDateOnly(filters.from, false) : new Date(0);
    const windowEnd = filters.to
      ? parseDateOnly(filters.to, true)
      : new Date('9999-12-31T23:59:59.999Z');
    return prisma.evaluation.findMany({
      where: {
        orgId,
        state: 'finalized',
        resourceId: { in: resourceIds },
        periodEnd: { gte: windowStart, lte: windowEnd },
      },
      orderBy: { periodEnd: 'asc' },
    });
  },

  /**
   * Top-line numbers: how many people are included, how many evaluations are
   * included, and what the mean overall score is across them.
   */
  async orgSummary(
    orgId: string,
    filters: InsightsFilterQuery
  ): Promise<{
    peopleIncluded: number;
    evaluationsIncluded: number;
    meanOverall: number | null;
  }> {
    const evaluations = await this._getFilteredEvaluations(orgId, filters);
    if (evaluations.length === 0) {
      return { peopleIncluded: 0, evaluationsIncluded: 0, meanOverall: null };
    }
    const peopleSet = new Set<string>();
    let sum = 0;
    let count = 0;
    for (const e of evaluations) {
      peopleSet.add(e.resourceId);
      const n = e.overrideFinal ?? e.computedFinal;
      if (n != null) {
        sum += n;
        count += 1;
      }
    }
    return {
      peopleIncluded: peopleSet.size,
      evaluationsIncluded: evaluations.length,
      meanOverall: count > 0 ? round1(sum / count) : null,
    };
  },

  /**
   * Histogram of final scores, bucketed by 0.5-point steps from 1.0 to 5.0.
   */
  async orgDistribution(
    orgId: string,
    filters: InsightsFilterQuery
  ): Promise<{ bucket: string; lower: number; upper: number; count: number }[]> {
    const evaluations = await this._getFilteredEvaluations(orgId, filters);
    // 8 buckets: [1.0,1.5), [1.5,2.0), ..., [4.5,5.0]
    const buckets = [
      { bucket: '1.0–1.5', lower: 1.0, upper: 1.5, count: 0 },
      { bucket: '1.5–2.0', lower: 1.5, upper: 2.0, count: 0 },
      { bucket: '2.0–2.5', lower: 2.0, upper: 2.5, count: 0 },
      { bucket: '2.5–3.0', lower: 2.5, upper: 3.0, count: 0 },
      { bucket: '3.0–3.5', lower: 3.0, upper: 3.5, count: 0 },
      { bucket: '3.5–4.0', lower: 3.5, upper: 4.0, count: 0 },
      { bucket: '4.0–4.5', lower: 4.0, upper: 4.5, count: 0 },
      { bucket: '4.5–5.0', lower: 4.5, upper: 5.0, count: 0 },
    ];
    for (const e of evaluations) {
      const n = e.overrideFinal ?? e.computedFinal;
      if (n == null) continue;
      // Last bucket is inclusive on the upper edge for the 5.0 case.
      let idx = Math.floor((n - 1) * 2);
      if (idx < 0) idx = 0;
      if (idx > buckets.length - 1) idx = buckets.length - 1;
      buckets[idx].count += 1;
    }
    return buckets;
  },

  /**
   * Average score per category (by grouping+name snapshot), across all
   * filtered evaluations. Uses responsibleScore to match per-person breakdown.
   */
  async orgCategoryBreakdown(
    orgId: string,
    filters: InsightsFilterQuery
  ): Promise<
    { grouping: string | null; categoryName: string; averageScore: number; evaluationCount: number }[]
  > {
    const resourceIds = await this._resolveFilteredResourceIds(orgId, filters);
    if (resourceIds.length === 0) return [];
    const windowStart = filters.from ? parseDateOnly(filters.from, false) : new Date(0);
    const windowEnd = filters.to
      ? parseDateOnly(filters.to, true)
      : new Date('9999-12-31T23:59:59.999Z');
    const evaluations = await prisma.evaluation.findMany({
      where: {
        orgId,
        state: 'finalized',
        resourceId: { in: resourceIds },
        periodEnd: { gte: windowStart, lte: windowEnd },
      },
      include: {
        categorySnapshots: true,
        scores: { select: { categorySnapshotId: true, responsibleScore: true } },
      },
    });
    if (evaluations.length === 0) return [];
    type Bucket = {
      grouping: string | null;
      categoryName: string;
      sortOrder: number;
      sum: number;
      count: number;
    };
    const buckets = new Map<string, Bucket>();
    for (const e of evaluations) {
      for (const snap of e.categorySnapshots) {
        const score = e.scores.find((s) => s.categorySnapshotId === snap.id);
        if (!score || score.responsibleScore == null) continue;
        const key = `${snap.categoryGroupingSnapshot ?? ''}::${snap.categoryNameSnapshot}`;
        const existing = buckets.get(key);
        if (existing) {
          existing.sum += score.responsibleScore;
          existing.count += 1;
        } else {
          buckets.set(key, {
            grouping: snap.categoryGroupingSnapshot ?? null,
            categoryName: snap.categoryNameSnapshot,
            sortOrder: snap.sortOrderSnapshot,
            sum: score.responsibleScore,
            count: 1,
          });
        }
      }
    }
    const sorted = Array.from(buckets.values()).sort((a, b) => {
      const ga = a.grouping ?? '';
      const gb = b.grouping ?? '';
      if (ga !== gb) return ga.localeCompare(gb);
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.categoryName.localeCompare(b.categoryName);
    });
    return sorted.map((b) => ({
      grouping: b.grouping,
      categoryName: b.categoryName,
      averageScore: round1(b.sum / b.count),
      evaluationCount: b.count,
    }));
  },

  /**
   * Heatmap: average responsible score by (domain, category). Returns the
   * domain axis, category axis and a cells array keyed by domain+category.
   */
  async orgCategoryHeatmap(
    orgId: string,
    filters: InsightsFilterQuery
  ): Promise<{
    domains: string[];
    categories: { grouping: string | null; categoryName: string }[];
    cells: { domain: string; grouping: string | null; categoryName: string; averageScore: number; count: number }[];
  }> {
    const resourceIds = await this._resolveFilteredResourceIds(orgId, filters);
    if (resourceIds.length === 0) return { domains: [], categories: [], cells: [] };
    const windowStart = filters.from ? parseDateOnly(filters.from, false) : new Date(0);
    const windowEnd = filters.to
      ? parseDateOnly(filters.to, true)
      : new Date('9999-12-31T23:59:59.999Z');

    // Pull resources with their roles so we know what domain(s) they belong to.
    // A person may have multiple roles — in that case, we attribute their
    // scores to each of their domains (common enough in small orgs).
    const resources = await prisma.resource.findMany({
      where: { id: { in: resourceIds } },
      select: { id: true, roles: { select: { domain: true } } },
    });
    const resourceDomains = new Map<string, string[]>();
    for (const r of resources) {
      const domains = Array.from(new Set(r.roles.map((rr) => rr.domain)));
      resourceDomains.set(r.id, domains);
    }

    const evaluations = await prisma.evaluation.findMany({
      where: {
        orgId,
        state: 'finalized',
        resourceId: { in: resourceIds },
        periodEnd: { gte: windowStart, lte: windowEnd },
      },
      include: {
        categorySnapshots: true,
        scores: { select: { categorySnapshotId: true, responsibleScore: true } },
      },
    });
    if (evaluations.length === 0) return { domains: [], categories: [], cells: [] };

    type Key = string; // domain::grouping::categoryName
    type Bucket = {
      domain: string;
      grouping: string | null;
      categoryName: string;
      sortOrder: number;
      sum: number;
      count: number;
    };
    const buckets = new Map<Key, Bucket>();
    const domainSet = new Set<string>();
    const categoryMap = new Map<string, { grouping: string | null; categoryName: string; sortOrder: number }>();

    for (const e of evaluations) {
      const domains = resourceDomains.get(e.resourceId) ?? [];
      if (domains.length === 0) continue;
      for (const snap of e.categorySnapshots) {
        const score = e.scores.find((s) => s.categorySnapshotId === snap.id);
        if (!score || score.responsibleScore == null) continue;
        const catKey = `${snap.categoryGroupingSnapshot ?? ''}::${snap.categoryNameSnapshot}`;
        if (!categoryMap.has(catKey)) {
          categoryMap.set(catKey, {
            grouping: snap.categoryGroupingSnapshot ?? null,
            categoryName: snap.categoryNameSnapshot,
            sortOrder: snap.sortOrderSnapshot,
          });
        }
        for (const d of domains) {
          domainSet.add(d);
          const key = `${d}::${catKey}`;
          const existing = buckets.get(key);
          if (existing) {
            existing.sum += score.responsibleScore;
            existing.count += 1;
          } else {
            buckets.set(key, {
              domain: d,
              grouping: snap.categoryGroupingSnapshot ?? null,
              categoryName: snap.categoryNameSnapshot,
              sortOrder: snap.sortOrderSnapshot,
              sum: score.responsibleScore,
              count: 1,
            });
          }
        }
      }
    }

    const domains = Array.from(domainSet).sort();
    const categories = Array.from(categoryMap.values())
      .sort((a, b) => {
        const ga = a.grouping ?? '';
        const gb = b.grouping ?? '';
        if (ga !== gb) return ga.localeCompare(gb);
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.categoryName.localeCompare(b.categoryName);
      })
      .map((c) => ({ grouping: c.grouping, categoryName: c.categoryName }));
    const cells = Array.from(buckets.values()).map((b) => ({
      domain: b.domain,
      grouping: b.grouping,
      categoryName: b.categoryName,
      averageScore: round1(b.sum / b.count),
      count: b.count,
    }));
    return { domains, categories, cells };
  },

  /**
   * Company trend line, equal-weighted mean of finalized evaluations per
   * bucket (month or quarter).
   */
  async orgTrend(
    orgId: string,
    filters: InsightsFilterQuery,
    bucket: 'month' | 'quarter'
  ): Promise<{ bucketStart: string; overall: number; evaluationCount: number; peopleCount: number }[]> {
    const evaluations = await this._getFilteredEvaluations(orgId, filters);
    if (evaluations.length === 0) return [];

    function bucketKey(d: Date): string {
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      if (bucket === 'quarter') {
        const q = Math.ceil(m / 3);
        return `${y}-Q${q}`;
      }
      return `${y}-${String(m).padStart(2, '0')}`;
    }

    type Group = { sum: number; count: number; people: Set<string> };
    const groups = new Map<string, Group>();
    for (const e of evaluations) {
      const n = e.overrideFinal ?? e.computedFinal;
      if (n == null) continue;
      const key = bucketKey(e.periodEnd);
      const existing = groups.get(key);
      if (existing) {
        existing.sum += n;
        existing.count += 1;
        existing.people.add(e.resourceId);
      } else {
        groups.set(key, { sum: n, count: 1, people: new Set([e.resourceId]) });
      }
    }

    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, g]) => ({
        bucketStart: key,
        overall: round1(g.sum / g.count),
        evaluationCount: g.count,
        peopleCount: g.people.size,
      }));
  },

  /**
   * Sorted people list: each person's mean final score across the filtered
   * evaluations, plus their evaluation count.
   */
  async orgPeopleList(
    orgId: string,
    filters: InsightsFilterQuery
  ): Promise<
    {
      resourceId: string;
      name: string;
      teamNames: string[];
      domains: string[];
      meanOverall: number;
      evaluationCount: number;
    }[]
  > {
    const resourceIds = await this._resolveFilteredResourceIds(orgId, filters);
    if (resourceIds.length === 0) return [];
    const windowStart = filters.from ? parseDateOnly(filters.from, false) : new Date(0);
    const windowEnd = filters.to
      ? parseDateOnly(filters.to, true)
      : new Date('9999-12-31T23:59:59.999Z');

    const evaluations = await prisma.evaluation.findMany({
      where: {
        orgId,
        state: 'finalized',
        resourceId: { in: resourceIds },
        periodEnd: { gte: windowStart, lte: windowEnd },
      },
      select: {
        resourceId: true,
        overrideFinal: true,
        computedFinal: true,
      },
    });
    if (evaluations.length === 0) return [];

    type Agg = { sum: number; count: number };
    const byPerson = new Map<string, Agg>();
    for (const e of evaluations) {
      const n = e.overrideFinal ?? e.computedFinal;
      if (n == null) continue;
      const existing = byPerson.get(e.resourceId);
      if (existing) {
        existing.sum += n;
        existing.count += 1;
      } else {
        byPerson.set(e.resourceId, { sum: n, count: 1 });
      }
    }
    if (byPerson.size === 0) return [];

    const personIds = Array.from(byPerson.keys());
    const people = await prisma.resource.findMany({
      where: { id: { in: personIds } },
      select: {
        id: true,
        name: true,
        teams: { select: { name: true } },
        roles: { select: { domain: true } },
      },
    });
    const peopleById = new Map(people.map((p) => [p.id, p]));

    return personIds
      .map((id) => {
        const p = peopleById.get(id);
        const agg = byPerson.get(id) as Agg;
        return {
          resourceId: id,
          name: p?.name ?? '—',
          teamNames: p ? Array.from(new Set(p.teams.map((t) => t.name))).sort() : [],
          domains: p ? Array.from(new Set(p.roles.map((r) => r.domain))).sort() : [],
          meanOverall: round1(agg.sum / agg.count),
          evaluationCount: agg.count,
        };
      })
      .sort((a, b) => b.meanOverall - a.meanOverall || a.name.localeCompare(b.name));
  },
};
