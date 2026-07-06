import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { assignmentService } from '../src/services/assignment.service.js';
import { getOneOnOne, createOneOnOne } from '../src/services/oneOnOne.service.js';
import { getLog } from '../src/services/log.service.js';
import { createLog } from '../src/services/log.service.js';
import { resourceService } from '../src/services/resource.service.js';
import { NotFoundError, ConflictError } from '../src/utils/errors.js';

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

  it('deleting a person with history is blocked (Restrict), not a silent cascade', async () => {
    // r1 now has a 1:1 and a log → the delete must be refused.
    await expect(resourceService.delete(orgId, r1)).rejects.toBeInstanceOf(ConflictError);
    // r2 has no history → deletes cleanly.
    const res3 = await prisma.resource.create({ data: { orgId, name: 'Person Three', capacity: 1 } });
    await expect(resourceService.delete(orgId, res3.id)).resolves.toBeTruthy();
  });
});
