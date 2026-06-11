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
  daysOverdue?: number;
}

function daysSince(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
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
      select: { oneOnOneReminderDays: true, pmLogReminderDays: true },
    });
    if (!org) return [];

    const items: ReminderItem[] = [];
    // Duty-based scoping, independent of role (an admin is NOT implicitly
    // responsible for everything here — reminders follow explicit duties):
    //  - 1:1s: people this user actually manages (direct links + managed teams)
    //  - PM items: projects where this user is set as responsible (directly,
    //    or via being the customer's responsible person)
    const self = scope.selfResourceId;
    let managedIds: string[] = [];
    if (self) {
      const [links, teams] = await Promise.all([
        prisma.personManager.findMany({
          where: { orgId, managerId: self },
          select: { personId: true },
        }),
        prisma.team.findMany({
          where: { orgId, managerId: self },
          select: { resources: { select: { id: true } } },
        }),
      ]);
      const set = new Set<string>(links.map((l) => l.personId));
      for (const t of teams) for (const r of t.resources) set.add(r.id);
      set.delete(self);
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
    if (org.oneOnOneReminderDays && managedIds.length > 0) {
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
        const days = daysSince(effective);
        if (days === null || days >= org.oneOnOneReminderDays) {
          items.push({
            type: 'oneOnOne',
            resourceId: p.id,
            resourceName: p.name,
            lastAt: last ? last.toISOString() : null,
            daysOverdue: days === null ? undefined : days - org.oneOnOneReminderDays,
          });
        }
      }
    }

    // --- PM duties: per (responsible project → its customer) × person
    // allocated to those projects this month ---
    const projects = self
      ? await prisma.project.findMany({
          where: {
            orgId,
            OR: [
              { responsiblePersonId: self },
              { customer: { responsiblePersonId: self } },
            ],
          },
          select: { id: true, customerId: true },
        })
      : [];
    const responsibleCustomerIds = Array.from(new Set(projects.map((p) => p.customerId)));
    if (projects.length > 0) {
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

        // Existing signals for the current month.
        const signals = await prisma.clientSignal.findMany({
          where: { orgId, month, customerId: { in: responsibleCustomerIds } },
          select: { customerId: true, resourceId: true },
        });
        const signalSet = new Set(signals.map((s) => `${s.customerId}|${s.resourceId}`));

        // Latest update the user logged per (customer, person).
        const sinceLogs = org.pmLogReminderDays
          ? await prisma.log.findMany({
              where: {
                orgId,
                authorUserId: userId,
                customerId: { in: responsibleCustomerIds },
                resourceId: { in: allResourceIds },
              },
              select: { customerId: true, resourceId: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
            })
          : [];
        const latestLog = new Map<string, Date>();
        for (const l of sinceLogs) {
          const key = `${l.customerId}|${l.resourceId}`;
          if (!latestLog.has(key)) latestLog.set(key, l.createdAt);
        }

        // Exclude self: a PM never logs structured updates about themselves.
        for (const [customerId, resourceIds] of allocated) {
          for (const resourceId of resourceIds) {
            if (resourceId === scope.selfResourceId) continue;
            const key = `${customerId}|${resourceId}`;
            const signalDismissed = (() => {
              const at = latestDismissal.get(`clientSignal|${resourceId}|${customerId}`);
              return !!at && at.toISOString().slice(0, 7) === month;
            })();
            if (!signalSet.has(key) && !signalDismissed) {
              items.push({
                type: 'clientSignal',
                resourceId,
                resourceName: personName.get(resourceId) || '?',
                customerId,
                customerName: customerName.get(customerId) || '?',
              });
            }
            if (org.pmLogReminderDays) {
              const last = maxDate(
                latestLog.get(key) ?? null,
                latestDismissal.get(`pmUpdate|${resourceId}|${customerId}`)
              );
              const days = daysSince(last);
              if (days === null || days >= org.pmLogReminderDays) {
                items.push({
                  type: 'pmUpdate',
                  resourceId,
                  resourceName: personName.get(resourceId) || '?',
                  customerId,
                  customerName: customerName.get(customerId) || '?',
                  lastAt: last ? last.toISOString() : null,
                  daysOverdue: days === null ? undefined : days - org.pmLogReminderDays,
                });
              }
            }
          }
        }
      }
    }

    return items;
  },
};
