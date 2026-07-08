import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { assignmentService } from '../src/services/assignment.service.js';
import { getOneOnOne, createOneOnOne } from '../src/services/oneOnOne.service.js';
import { getLog } from '../src/services/log.service.js';
import { createLog } from '../src/services/log.service.js';
import { resourceService } from '../src/services/resource.service.js';
import { integrationService } from '../src/services/integration.service.js';
import { NotFoundError, ConflictError, BadRequestError } from '../src/utils/errors.js';

// DB-backed invariant tests. They exercise the actual services against a real
// Postgres, so they only run when DATABASE_URL is configured (CI provides a
// Postgres service + `prisma migrate deploy`; locally, point DATABASE_URL at a
// throwaway db). Without it they skip, keeping the pure-unit suite DB-free.
const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)('DB invariants', () => {
  const tag = 'it-invariants';
  let orgId: string;
  let userId: string;
  let r1: string;
  let r2: string;
  let needId: string;

  beforeAll(async () => {
    // Clean any leftovers from a previous aborted run.
    await prisma.organization.deleteMany({ where: { slug: tag } });
    const user = await prisma.user.create({ data: { email: `${tag}@example.test`, name: 'IT', password: 'x' } });
    userId = user.id;
    const org = await prisma.organization.create({ data: { name: 'IT Org', slug: tag } });
    orgId = org.id;
    await prisma.orgMember.create({ data: { userId, orgId, role: 'owner' } });
    const res1 = await prisma.resource.create({ data: { orgId, name: 'Person One', capacity: 1 } });
    const res2 = await prisma.resource.create({ data: { orgId, name: 'Person Two', capacity: 1 } });
    r1 = res1.id;
    r2 = res2.id;
    const customer = await prisma.customer.create({ data: { orgId, name: 'Cust', status: 'realised' } });
    const project = await prisma.project.create({
      data: { orgId, name: 'Proj', customerId: customer.id, status: 'realised', startMonth: '2026-01', endMonth: '2026-03' },
    });
    const need = await prisma.need.create({
      data: {
        orgId, projectId: project.id, domain: 'Eng', role: 'Backend', seniority: 'Senior',
        status: 'realised', startMonth: '2026-01', endMonth: '2026-03',
        monthAllocations: { '2026-01': 1, '2026-02': 1, '2026-03': 1 },
      },
    });
    needId = need.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('upsertMonth merges months into a single row per (need, resource)', async () => {
    await assignmentService.upsertMonth(orgId, { needId, resourceId: r1, monthAllocations: { '2026-01': 0.4 } });
    await assignmentService.upsertMonth(orgId, { needId, resourceId: r1, monthAllocations: { '2026-02': 0.6 } });
    const rows = await prisma.assignment.findMany({ where: { orgId, needId, resourceId: r1 } });
    expect(rows).toHaveLength(1); // never a second row for the same pair
    const alloc = rows[0].monthAllocations as Record<string, number>;
    expect(alloc['2026-01']).toBe(0.4); // first write preserved
    expect(alloc['2026-02']).toBe(0.6); // second write merged, not replaced
  });

  it('sub-resource access is bound to the person in the URL (visibility == existence)', async () => {
    const oo = await createOneOnOne(orgId, r1, userId, { meetingDate: '2026-02-01', overallScore: 4 });
    // Correct person: returns the record.
    await expect(getOneOnOne(orgId, r1, oo.id, userId)).resolves.toMatchObject({ id: oo.id });
    // Wrong person: 404, even though the caller could otherwise see r2.
    await expect(getOneOnOne(orgId, r2, oo.id, userId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('a log is not reachable via a different person’s page', async () => {
    const log = await createLog(orgId, r1, userId, 'owner', { content: 'note', kind: 'note' });
    await expect(getLog(orgId, r1, log.id, userId, 'owner')).resolves.toMatchObject({ id: log.id });
    await expect(getLog(orgId, r2, log.id, userId, 'owner')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('setAbsences merges per-month days; 0 clears the month instead of storing it', async () => {
    await resourceService.setAbsences(orgId, r1, { '2026-08': 10, '2026-09': 21.5 });
    // A second write to a different month must not clobber the first.
    await resourceService.setAbsences(orgId, r1, { '2026-10': 3.25 });
    let row = await prisma.resource.findUniqueOrThrow({ where: { id: r1 } });
    let abs = row.plannedAbsences as Record<string, number>;
    expect(abs['2026-08']).toBe(10);
    expect(abs['2026-09']).toBe(21.5);
    expect(abs['2026-10']).toBe(3.5); // rounded to the half-day grain

    // Clearing a month removes the key entirely (no lingering zeros).
    await resourceService.setAbsences(orgId, r1, { '2026-08': 0 });
    row = await prisma.resource.findUniqueOrThrow({ where: { id: r1 } });
    abs = row.plannedAbsences as Record<string, number>;
    expect(abs['2026-08']).toBeUndefined();
    expect(abs['2026-09']).toBe(21.5);

    // Cross-org: the person must not be reachable from another org.
    const otherOrg = await prisma.organization.create({ data: { name: 'Other', slug: `${tag}-other` } });
    await expect(resourceService.setAbsences(otherOrg.id, r1, { '2026-09': 1 })).rejects.toBeInstanceOf(NotFoundError);
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });

  it('deleting a person with history is blocked (Restrict), not a silent cascade', async () => {
    // r1 now has a 1:1 and a log → the delete must be refused.
    await expect(resourceService.delete(orgId, r1)).rejects.toBeInstanceOf(ConflictError);
    // r2 has no history → deletes cleanly.
    const res3 = await prisma.resource.create({ data: { orgId, name: 'Person Three', capacity: 1 } });
    await expect(resourceService.delete(orgId, res3.id)).resolves.toBeTruthy();
  });

  it('work-item workType and customer/project mapping are mutually exclusive', async () => {
    const customer = await prisma.customer.findFirstOrThrow({ where: { orgId } });
    await integrationService.createWorkItem(orgId, {
      kind: 'project', externalKey: 'WT-1', name: 'Some Jira project', customerId: customer.id,
    });
    const byKey = async (key: string) =>
      prisma.jiraWorkItem.findFirstOrThrow({ where: { orgId, externalKey: key } });
    let item = await byKey('WT-1');
    expect(item.workType).toBe('client');

    // Reclassifying as internal clears the customer mapping.
    await integrationService.updateWorkItem(orgId, item.id, { workType: 'internal' });
    item = await byKey('WT-1');
    expect(item.workType).toBe('internal');
    expect(item.customerId).toBeNull();

    // An explicit customer alongside a non-client type is a contradiction.
    await expect(
      integrationService.updateWorkItem(orgId, item.id, { workType: 'absence', customerId: customer.id })
    ).rejects.toBeInstanceOf(BadRequestError);
    await expect(
      integrationService.createWorkItem(orgId, {
        kind: 'project', externalKey: 'WT-2', name: 'Bad combo', workType: 'absence', customerId: customer.id,
      })
    ).rejects.toBeInstanceOf(BadRequestError);

    // Mapping it back to a customer flips it to client work again.
    await integrationService.updateWorkItem(orgId, item.id, { workType: 'client', customerId: customer.id });
    item = await byKey('WT-1');
    expect(item.workType).toBe('client');
    expect(item.customerId).toBe(customer.id);
  });

  it('absence worklogs are excluded from per-person actuals; internal ones count', async () => {
    const mk = (id: string, workType: string, seconds: number) =>
      prisma.worklog.create({
        data: {
          orgId, tempoWorklogId: `wt-test-${id}`, accountId: 'acc-x', resourceId: r1,
          workType, workDate: '2026-02-10', month: '2026-02', seconds,
        },
      });
    await mk('client', 'client', 2 * 3600);
    await mk('internal', 'internal', 1 * 3600);
    await mk('absence', 'absence', 8 * 3600);

    const byResource = await integrationService.actualsByResource(orgId, '2026-02', '2026-02', null);
    // 2h client + 1h internal; the 8h absence never counts as logged work.
    expect(byResource[r1]?.['2026-02']).toBe(3);

    // The unfiltered per-type companion returns the full breakdown — it feeds
    // the stacked bar, the work-type filter and the drill-down buckets.
    const byType = await integrationService.actualsByResourceType(orgId, '2026-02', '2026-02', null);
    expect(byType[r1]?.['2026-02']).toEqual({ client: 2, internal: 1, absence: 8 });
  });
});
