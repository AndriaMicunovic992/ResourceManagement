import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import {
  allocationForScope,
  parseDateOnly,
  round1,
} from './performance.service.js';

type WindowInput = { from?: string; to?: string };

function resolveWindow(filters: WindowInput): { windowStart: Date; windowEnd: Date } {
  const windowStart = filters.from ? parseDateOnly(filters.from, false) : new Date(0);
  const windowEnd = filters.to
    ? parseDateOnly(filters.to, true)
    : new Date('9999-12-31T23:59:59.999Z');
  return { windowStart, windowEnd };
}

export type CustomerOverall = {
  overall: number | null;
  evaluationsIncluded: number;
  peopleIncluded: number;
};

export type CustomerPerPersonEntry = {
  resourceId: string;
  name: string;
  evaluationCount: number;
  meanOverall: number;
  totalAllocationShare: number;
};

export type CustomerTrendPoint = {
  bucketStart: string;
  overall: number;
  evaluationCount: number;
  peopleCount: number;
};

export const customerPerformanceService = {
  /**
   * FTE-weighted overall score rollup for a customer.
   *
   * For every finalized evaluation whose customerId matches the customer and
   * whose periodEnd falls inside the window, we use the evaluator's
   * allocation to the customer/project during the evaluation period as its
   * weight. The customer-wide overall is then
   *   sum(finalNumber_i * weight_i) / sum(weight_i)
   * which degrades gracefully to equal weighting when no allocation data
   * exists at all.
   */
  async overall(
    orgId: string,
    customerId: string,
    filters: WindowInput
  ): Promise<CustomerOverall> {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, orgId } });
    if (!customer) throw new NotFoundError('Customer not found');

    const { windowStart, windowEnd } = resolveWindow(filters);
    const evaluations = await prisma.evaluation.findMany({
      where: {
        orgId,
        customerId,
        state: 'finalized',
        periodEnd: { gte: windowStart, lte: windowEnd },
      },
      orderBy: { periodEnd: 'asc' },
    });

    if (evaluations.length === 0) {
      return { overall: null, evaluationsIncluded: 0, peopleIncluded: 0 };
    }

    const peopleSet = new Set<string>();
    const rawShares: { finalNumber: number; share: number }[] = [];
    for (const e of evaluations) {
      peopleSet.add(e.resourceId);
      const share = await allocationForScope(
        e.resourceId,
        e.customerId,
        e.projectId,
        e.periodStart,
        e.periodEnd
      );
      const finalNumber = e.overrideFinal ?? e.computedFinal ?? 0;
      rawShares.push({ finalNumber, share });
    }

    const allocSum = rawShares.reduce((acc, r) => acc + r.share, 0);
    let weights: number[];
    if (allocSum === 0) {
      weights = rawShares.map(() => 1 / rawShares.length);
    } else {
      weights = rawShares.map((r) => r.share / allocSum);
    }

    let overallSum = 0;
    rawShares.forEach((r, i) => {
      overallSum += r.finalNumber * weights[i];
    });

    return {
      overall: round1(overallSum),
      evaluationsIncluded: evaluations.length,
      peopleIncluded: peopleSet.size,
    };
  },

  /**
   * Per-person breakdown for a customer. Each row is one resource with their
   * mean final score across customer-scoped evaluations and their total
   * allocation share (sum of allocation across the evaluation periods) so
   * the UI can display relative contribution.
   */
  async perPerson(
    orgId: string,
    customerId: string,
    filters: WindowInput
  ): Promise<CustomerPerPersonEntry[]> {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, orgId } });
    if (!customer) throw new NotFoundError('Customer not found');

    const { windowStart, windowEnd } = resolveWindow(filters);
    const evaluations = await prisma.evaluation.findMany({
      where: {
        orgId,
        customerId,
        state: 'finalized',
        periodEnd: { gte: windowStart, lte: windowEnd },
      },
      orderBy: { periodEnd: 'asc' },
    });
    if (evaluations.length === 0) return [];

    type Agg = { sum: number; count: number; allocation: number };
    const byPerson = new Map<string, Agg>();
    for (const e of evaluations) {
      const n = e.overrideFinal ?? e.computedFinal;
      if (n == null) continue;
      const share = await allocationForScope(
        e.resourceId,
        e.customerId,
        e.projectId,
        e.periodStart,
        e.periodEnd
      );
      const existing = byPerson.get(e.resourceId);
      if (existing) {
        existing.sum += n;
        existing.count += 1;
        existing.allocation += share;
      } else {
        byPerson.set(e.resourceId, { sum: n, count: 1, allocation: share });
      }
    }
    if (byPerson.size === 0) return [];

    const personIds = Array.from(byPerson.keys());
    const people = await prisma.resource.findMany({
      where: { id: { in: personIds } },
      select: { id: true, name: true },
    });
    const peopleById = new Map(people.map((p) => [p.id, p]));

    return personIds
      .map((id) => {
        const p = peopleById.get(id);
        const agg = byPerson.get(id) as Agg;
        return {
          resourceId: id,
          name: p?.name ?? '—',
          evaluationCount: agg.count,
          meanOverall: round1(agg.sum / agg.count),
          totalAllocationShare: round1(agg.allocation),
        };
      })
      .sort((a, b) => b.meanOverall - a.meanOverall || a.name.localeCompare(b.name));
  },

  /**
   * Bucketed trend for the customer — equal-weighted mean of finalized
   * customer-scoped evaluations per month or quarter.
   */
  async trend(
    orgId: string,
    customerId: string,
    filters: WindowInput,
    bucket: 'month' | 'quarter'
  ): Promise<CustomerTrendPoint[]> {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, orgId } });
    if (!customer) throw new NotFoundError('Customer not found');

    const { windowStart, windowEnd } = resolveWindow(filters);
    const evaluations = await prisma.evaluation.findMany({
      where: {
        orgId,
        customerId,
        state: 'finalized',
        periodEnd: { gte: windowStart, lte: windowEnd },
      },
      select: {
        resourceId: true,
        periodEnd: true,
        overrideFinal: true,
        computedFinal: true,
      },
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

};
