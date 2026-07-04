import { prisma } from '../db/prisma.js';
import type { VisibilityScope } from './visibility.service.js';

/**
 * In-app reminder engine: computes what's due for the requesting user from
 * org cadence settings. Stateless — derived on request, nothing stored.
 * Phase 2 will push the same items through Teams/Outlook via Graph.
 */

export interface ReminderItem {
  type: 'oneOnOne' | 'pmUpdate' | 'clientSignal';
  resourceId: string;
  resourceName: string;
  customerId?: string;
  customerName?: string;
  /** Last relevant activity, if any. */
  lastAt?: string | null;
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

type ReminderUnit = 'daily' | 'weekly' | 'monthly';

interface Schedule {
  every: number;
  unit: ReminderUnit;
  start: Date;
}

function parseSchedule(
  every: number | null,
  unit: string | null,
  start: string | null
): Schedule | null {
  if (!every || !unit || (unit !== 'daily' && unit !== 'weekly' && unit !== 'monthly')) return null;
  const startDate = start ? new Date(`${start}T00:00:00.000Z`) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) return null;
  return { every, unit, start: startDate };
}

/**
 * The most recent scheduled tick at or before `now` (anchored at the start
 * date, repeating every N units). Null when the schedule hasn't started yet.
 * An item is "due" when nothing relevant happened since this tick.
 */
function latestTick(schedule: Schedule, now: Date): Date | null {
  const { start, every, unit } = schedule;
  if (start > now) return null;
  if (unit === 'daily' || unit === 'weekly') {
    const periodMs = every * (unit === 'weekly' ? 7 : 1) * 86_400_000;
    const ticks = Math.floor((now.getTime() - start.getTime()) / periodMs);
    return new Date(start.getTime() + ticks * periodMs);
  }
  // monthly: count whole months elapsed, clamp day-of-month overflow
  // (e.g. start on the 31st → tick on the last day of shorter months).
  const monthsElapsed =
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - start.getUTCMonth());
  for (let k = Math.floor(monthsElapsed / every); k >= 0; k--) {
    const tick = new Date(start);
    const targetMonth = start.getUTCMonth() + k * every;
    tick.setUTCDate(1);
    tick.setUTCMonth(targetMonth);
    const daysInMonth = new Date(
      Date.UTC(tick.getUTCFullYear(), tick.getUTCMonth() + 1, 0)
    ).getUTCDate();
    tick.setUTCDate(Math.min(start.getUTCDate(), daysInMonth));
    if (tick <= now) return tick;
  }
  return null;
}

export const reminderService = {
  async dismiss(
    orgId: string,
    userId: string,
    data: { type: string; resourceId: string; customerId?: string | null }
  ) {
    return prisma.reminderDismissal.create({
      data: {
        orgId,
        userId,
        type: data.type,
        resourceId: data.resourceId,
        customerId: data.customerId ?? null,
      },
    });
  },

  async forUser(orgId: string, userId: string, scope: VisibilityScope): Promise<ReminderItem[]> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        oneOnOneReminderEvery: true,
        oneOnOneReminderUnit: true,
        oneOnOneReminderStart: true,
        pmLogReminderEvery: true,
        pmLogReminderUnit: true,
        pmLogReminderStart: true,
      },
    });
    if (!org) return [];

    const now = new Date();
    const oneOnOneSchedule = parseSchedule(
      org.oneOnOneReminderEvery,
      org.oneOnOneReminderUnit,
      org.oneOnOneReminderStart
    );
    const pmLogSchedule = parseSchedule(
      org.pmLogReminderEvery,
      org.pmLogReminderUnit,
      org.pmLogReminderStart
    );
    const oneOnOneTick = oneOnOneSchedule ? latestTick(oneOnOneSchedule, now) : null;
    const pmLogTick = pmLogSchedule ? latestTick(pmLogSchedule, now) : null;

    const items: ReminderItem[] = [];
    // Duty-based scoping, independent of role (an admin is NOT implicitly
    // responsible for everything here — reminders follow explicit duties):
    //  - 1:1s: people this user actually manages (direct links + managed teams)
    //  - PM items: projects where this user is set as responsible (directly,
    //    or via being the customer's responsible person)
    const self = scope.selfResourceId;
    let managedIds: string[] = [];
    {
      // Managers are keyed on the login user, so 1:1 duties follow whoever is
      // set as manager — no need for the user to be a staffable Resource.
      const [links, teams] = await Promise.all([
        prisma.personManager.findMany({
          where: { orgId, managerUserId: userId },
          select: { personId: true },
        }),
        prisma.team.findMany({
          where: { orgId, managerUserId: userId },
          select: { resources: { select: { id: true } } },
        }),
      ]);
      const set = new Set<string>(links.map((l) => l.personId));
      for (const t of teams) for (const r of t.resources) set.add(r.id);
      if (self) set.delete(self);
      managedIds = Array.from(set);
    }

    // Dismissals ("on leave this month" etc.): for cadence-based reminders the
    // dismissal counts as activity; for monthly signals it hides the month.
    const dismissals = await prisma.reminderDismissal.findMany({
      where: { orgId, userId },
      orderBy: { createdAt: 'desc' },
    });
    const latestDismissal = new Map<string, Date>();
    for (const d of dismissals) {
      const key = `${d.type}|${d.resourceId}|${d.customerId ?? ''}`;
      if (!latestDismissal.has(key)) latestDismissal.set(key, d.createdAt);
    }
    const maxDate = (a: Date | null, b: Date | undefined): Date | null => {
      if (!b) return a;
      if (!a) return b;
      return a > b ? a : b;
    };

    // --- Overdue 1:1s for people the user manages (direct or via team) ---
    // Due = no 1:1 (and no dismissal) since the latest scheduled tick.
    if (oneOnOneTick && managedIds.length > 0) {
      const people = await prisma.resource.findMany({
        where: { orgId, id: { in: managedIds } },
        select: { id: true, name: true },
      });
      const latest = await prisma.oneOnOne.groupBy({
        by: ['resourceId'],
        where: { orgId, resourceId: { in: managedIds } },
        _max: { meetingDate: true },
      });
      const latestBy = new Map(latest.map((l) => [l.resourceId, l._max.meetingDate]));
      for (const p of people) {
        const last = latestBy.get(p.id) ?? null;
        const effective = maxDate(last, latestDismissal.get(`oneOnOne|${p.id}|`));
        if (!effective || effective < oneOnOneTick) {
          items.push({
            type: 'oneOnOne',
            resourceId: p.id,
            resourceName: p.name,
            lastAt: last ? last.toISOString() : null,
          });
        }
      }
    }

    // --- PM review duties: for each (responsible project → its customer) ×
    // person allocated this month, remind the PM when they haven't logged an
    // update since the latest cadence tick. Client signals are recorded in the
    // cockpit but are optional — they no longer raise a reminder of their own,
    // so a missing signal alone never nags. ---
    const projects = await prisma.project.findMany({
      where: {
        orgId,
        OR: [
          { responsibleUserId: userId },
          { customer: { responsibleUserId: userId } },
        ],
      },
      select: { id: true, customerId: true },
    });
    const responsibleCustomerIds = Array.from(new Set(projects.map((p) => p.customerId)));
    if (projects.length > 0 && pmLogTick) {
      const month = currentMonthKey();
      const customers = await prisma.customer.findMany({
        where: { orgId, id: { in: responsibleCustomerIds } },
        select: { id: true, name: true },
      });
      const projByid = new Map(projects.map((p) => [p.id, p]));
      const needs = await prisma.need.findMany({
        where: { orgId, projectId: { in: projects.map((p) => p.id) } },
        select: { id: true, projectId: true },
      });
      const needToCustomer = new Map(
        needs.map((n) => [n.id, projByid.get(n.projectId)?.customerId])
      );
      const assignments = await prisma.assignment.findMany({
        where: { orgId, needId: { in: needs.map((n) => n.id) } },
        select: { resourceId: true, needId: true, monthAllocations: true },
      });

      // (customerId → set of resourceIds allocated this month)
      const allocated = new Map<string, Set<string>>();
      for (const a of assignments) {
        const alloc = (a.monthAllocations as Record<string, number> | null) || {};
        if ((alloc[month] || 0) <= 0) continue;
        const customerId = needToCustomer.get(a.needId);
        if (!customerId) continue;
        if (!allocated.has(customerId)) allocated.set(customerId, new Set());
        allocated.get(customerId)!.add(a.resourceId);
      }

      const allResourceIds = Array.from(
        new Set(Array.from(allocated.values()).flatMap((s) => Array.from(s)))
      );
      if (allResourceIds.length > 0) {
        const people = await prisma.resource.findMany({
          where: { orgId, id: { in: allResourceIds } },
          select: { id: true, name: true },
        });
        const personName = new Map(people.map((p) => [p.id, p.name]));
        const customerName = new Map(customers.map((c) => [c.id, c.name]));

        // Latest update the user logged per (customer, person).
        const sinceLogs = await prisma.log.findMany({
          where: {
            orgId,
            authorUserId: userId,
            customerId: { in: responsibleCustomerIds },
            resourceId: { in: allResourceIds },
          },
          select: { customerId: true, resourceId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
        const latestLog = new Map<string, Date>();
        for (const l of sinceLogs) {
          const key = `${l.customerId}|${l.resourceId}`;
          if (!latestLog.has(key)) latestLog.set(key, l.createdAt);
        }

        // Exclude self: a PM never logs structured updates about themselves.
        // Due = no update (and no dismissal) since the latest scheduled tick.
        for (const [customerId, resourceIds] of allocated) {
          for (const resourceId of resourceIds) {
            if (resourceId === scope.selfResourceId) continue;
            const key = `${customerId}|${resourceId}`;
            const last = maxDate(
              latestLog.get(key) ?? null,
              latestDismissal.get(`pmUpdate|${resourceId}|${customerId}`)
            );
            if (!last || last < pmLogTick) {
              items.push({
                type: 'pmUpdate',
                resourceId,
                resourceName: personName.get(resourceId) || '?',
                customerId,
                customerName: customerName.get(customerId) || '?',
                lastAt: latestLog.get(key)?.toISOString() ?? null,
              });
            }
          }
        }
      }
    }

    return items;
  },
};
