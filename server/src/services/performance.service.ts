import { prisma } from '../db/prisma.js';
import { monthRange } from '../utils/months.js';
import { NotFoundError } from '../utils/errors.js';
import { isAdminRole, userIsManagerOf } from './personAccess.service.js';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function dateToYearMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function parseDateOnly(value: string, endOfDay: boolean): Date {
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
async function allocationForScope(
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
async function totalCapacity(resourceId: string, windowStart: Date, windowEnd: Date): Promise<number> {
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
    toStr?: string
  ): Promise<PerformanceOverall> {
    await ensureCanReadPerson(orgId, requestingUserId, requestingUserRole, resourceId);
    const resource = await prisma.resource.findFirst({ where: { id: resourceId, orgId } });
    if (!resource) throw new NotFoundError('Resource not found');

    const windowStart = fromStr ? parseDateOnly(fromStr, false) : new Date(0);
    // Default upper bound is far in the future so finalized evaluations whose
    // period ends in the future are still counted.
    const windowEnd = toStr ? parseDateOnly(toStr, true) : new Date('9999-12-31T23:59:59.999Z');

    const evaluations = await prisma.evaluation.findMany({
      where: {
        orgId,
        resourceId,
        state: 'finalized',
        periodEnd: { gte: windowStart, lte: windowEnd },
      },
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
    filters: { customerId?: string | null; projectId?: string | null }
  ): Promise<
    {
      grouping: string | null;
      categoryName: string;
      averageScore: number;
      evaluationCount: number;
    }[]
  > {
    await ensureCanReadPerson(orgId, requestingUserId, requestingUserRole, resourceId);

    const where: {
      orgId: string;
      resourceId: string;
      state: string;
      customerId?: string;
      projectId?: string | null;
    } = { orgId, resourceId, state: 'finalized' };
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
    bucket: 'month' | 'quarter'
  ): Promise<{ bucketStart: string; overall: number; evaluationCount: number }[]> {
    await ensureCanReadPerson(orgId, requestingUserId, requestingUserRole, resourceId);

    const evaluations = await prisma.evaluation.findMany({
      where: { orgId, resourceId, state: 'finalized' },
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
};
