import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock the network clients before importing the service under test — the sync
// logic (mapping resolution, workType stamping, batched writes, idempotency)
// runs against the real database with a scripted Tempo/Jira.
vi.mock('../src/services/tempoClient.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/services/tempoClient.js')>();
  return {
    ...mod,
    tempoClient: { fetchWorklogs: vi.fn() },
  };
});
vi.mock('../src/services/jiraClient.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/services/jiraClient.js')>();
  return {
    ...mod,
    jiraClient: { ...mod.jiraClient, fetchIssues: vi.fn() },
  };
});

import { prisma } from '../src/db/prisma.js';
import { integrationService } from '../src/services/integration.service.js';
import { tempoClient } from '../src/services/tempoClient.js';
import { jiraClient } from '../src/services/jiraClient.js';
import { encryptSecret } from '../src/utils/crypto.js';

const HAS_DB = !!process.env.DATABASE_URL;

const wl = (id: number, accountId: string, issueId: string, seconds: number, date = '2026-03-10') => ({
  tempoWorklogId: String(id), seconds, date, accountId, issueId, description: null,
});

describe.skipIf(!HAS_DB)('Tempo sync', () => {
  const tag = 'it-temposync';
  let orgId: string;
  let personId: string;
  let customerId: string;

  beforeAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: tag } });
    const org = await prisma.organization.create({ data: { name: 'Sync Org', slug: tag } });
    orgId = org.id;
    await prisma.jiraConnection.create({
      data: {
        orgId, enabled: true, baseUrl: 'https://example.example', jiraEmail: 'x@example.test',
        jiraApiToken: encryptSecret('jira-token'), tempoApiToken: encryptSecret('tempo-token'),
      },
    });
    const person = await prisma.resource.create({ data: { orgId, name: 'Matched Person', capacity: 1, externalWorkId: 'acc-1' } });
    personId = person.id;
    const customer = await prisma.customer.create({ data: { orgId, name: 'Mapped Customer', status: 'realised' } });
    customerId = customer.id;
    await prisma.jiraWorkItem.create({ data: { orgId, kind: 'project', externalKey: 'CLI', name: 'Client project', customerId } });
    await prisma.jiraWorkItem.create({ data: { orgId, kind: 'project', externalKey: 'ABS', name: 'Absences', workType: 'absence' } });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it('creates, restamps and updates worklogs in batches (idempotent by tempoWorklogId)', async () => {
    (jiraClient.fetchIssues as any).mockResolvedValue([
      { id: '11', key: 'CLI-1', projectKey: 'CLI', epicKey: null },
      { id: '22', key: 'ABS-1', projectKey: 'ABS', epicKey: null },
    ]);
    // First pull: one client worklog (duplicated across pages — must dedupe),
    // one absence worklog.
    (tempoClient.fetchWorklogs as any).mockResolvedValue({
      worklogs: [wl(1, 'acc-1', '11', 7200), wl(1, 'acc-1', '11', 7200), wl(2, 'acc-1', '22', 3600)],
      truncated: false,
    });

    const first = await integrationService.syncHours(orgId, '2026-03-01');
    expect(first.worklogs).toBe(3);
    expect(first.createdWorklogs).toBe(2); // duplicate page row deduped
    expect(first.updatedWorklogs).toBe(0);
    expect(first.mappedWorklogs).toBe(3);

    const rows = await prisma.worklog.findMany({ where: { orgId }, orderBy: { tempoWorklogId: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ tempoWorklogId: '1', workType: 'client', customerId, resourceId: personId, seconds: 7200 });
    expect(rows[1]).toMatchObject({ tempoWorklogId: '2', workType: 'absence', customerId: null, seconds: 3600 });

    // Second pull: worklog 1 was edited in Tempo (new duration) — the re-sync
    // must update in place, never duplicate.
    (tempoClient.fetchWorklogs as any).mockResolvedValue({
      worklogs: [wl(1, 'acc-1', '11', 1800)],
      truncated: false,
    });
    const second = await integrationService.syncHours(orgId, '2026-03-01');
    expect(second.createdWorklogs).toBe(0);
    expect(second.updatedWorklogs).toBe(1);

    const after = await prisma.worklog.findMany({ where: { orgId } });
    expect(after).toHaveLength(2);
    expect(after.find((r) => r.tempoWorklogId === '1')?.seconds).toBe(1800);

    // The per-person actuals see client hours only (worklog 2 is an absence).
    const byResource = await integrationService.actualsByResource(orgId, '2026-03', '2026-03', null);
    expect(byResource[personId]?.['2026-03']).toBe(0.5);
  });

  it('reclassifying a work item restamps stored history immediately (no sync needed)', async () => {
    const cli = await prisma.jiraWorkItem.findFirstOrThrow({ where: { orgId, externalKey: 'CLI' } });

    // A delta sync never re-pulls old worklogs, so the mapping edit itself
    // must rewrite the stored attribution.
    await integrationService.updateWorkItem(orgId, cli.id, { workType: 'internal' });
    let row = await prisma.worklog.findFirstOrThrow({ where: { orgId, tempoWorklogId: '1' } });
    expect(row.workType).toBe('internal');
    expect(row.customerId).toBeNull();

    // …and mapping it back to a customer restores the client attribution.
    await integrationService.updateWorkItem(orgId, cli.id, { workType: 'client', customerId });
    row = await prisma.worklog.findFirstOrThrow({ where: { orgId, tempoWorklogId: '1' } });
    expect(row.workType).toBe('client');
    expect(row.customerId).toBe(customerId);
  });

  it('the on-demand restamp heals stale attribution and reports the count', async () => {
    // Simulate history stamped before the classification existed (the state a
    // delta sync can never fix on its own).
    await prisma.worklog.updateMany({
      where: { orgId, tempoWorklogId: '2' },
      data: { workType: 'client', customerId: null, projectId: null },
    });
    const r = await integrationService.restampAll(orgId);
    expect(r.restamped).toBeGreaterThanOrEqual(1);
    const row = await prisma.worklog.findFirstOrThrow({ where: { orgId, tempoWorklogId: '2' } });
    expect(row.workType).toBe('absence');
  });

  it('unmapped client hours group by Jira project for the drill-down', async () => {
    (jiraClient.fetchIssues as any).mockResolvedValue([
      { id: '33', key: 'ZZZ-9', projectKey: 'ZZZ', epicKey: null },
    ]);
    (tempoClient.fetchWorklogs as any).mockResolvedValue({
      worklogs: [wl(3, 'acc-1', '33', 5400, '2026-03-12')],
      truncated: false,
    });
    await integrationService.syncHours(orgId, '2026-03-01');

    const unmapped = await integrationService.actualsForResourceUnmapped(orgId, personId, '2026-03', '2026-03');
    expect(unmapped).toEqual([{ key: 'ZZZ', name: 'ZZZ', stale: false, months: { '2026-03': 1.5 } }]);

    // The dashboard's four buckets: mapped client, unmapped client, internal,
    // absence — over the same month.
    const bucketsRes = await integrationService.actualsWorkBuckets(orgId, '2026-03', '2026-03', null);
    expect(bucketsRes['2026-03']).toEqual({ client: 0.5, unmapped: 1.5, internal: 0, absence: 1 });
  });
});
