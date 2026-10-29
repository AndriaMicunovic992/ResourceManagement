import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Shared delivery spaces: a Jira project whose issues name their client in a
// customer field (filled from the service desk). Runs the real sync/restamp
// against the database with a scripted Tempo/Jira, like tempoSync.test.ts.
vi.mock('../src/services/tempoClient.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/services/tempoClient.js')>();
  return { ...mod, tempoClient: { fetchWorklogs: vi.fn() } };
});
vi.mock('../src/services/jiraClient.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/services/jiraClient.js')>();
  return { ...mod, jiraClient: { ...mod.jiraClient, fetchIssues: vi.fn(), fetchIssueFieldValues: vi.fn() } };
});

import { prisma } from '../src/db/prisma.js';
import { integrationService } from '../src/services/integration.service.js';
import { tempoClient } from '../src/services/tempoClient.js';
import { jiraClient, fieldLabels, customerOrgOf } from '../src/services/jiraClient.js';
import { encryptSecret } from '../src/utils/crypto.js';

const HAS_DB = !!process.env.DATABASE_URL;
const FIELD = 'customfield_10500';

const wl = (id: string, issueId: string, seconds: number, date = '2026-06-10') => ({
  tempoWorklogId: id, seconds, date, accountId: 'acc-1', issueId, description: null,
});
const issue = (id: string, key: string, customerOrg: string | null) => ({
  id, key, projectKey: key.split('-')[0], epicKey: null, customerOrg,
});

describe('customer field value parsing', () => {
  it('reads plain text, select options, JSM organizations and arrays', () => {
    expect(fieldLabels(' Alpine AG ')).toEqual(['Alpine AG']);
    expect(fieldLabels({ value: 'Berg GmbH', id: '1' })).toEqual(['Berg GmbH']);
    expect(fieldLabels([{ id: 3, name: 'Alpine AG' }, { id: 4, name: 'Berg GmbH' }])).toEqual(['Alpine AG', 'Berg GmbH']);
    expect(fieldLabels({ type: 'doc', content: [] })).toEqual([]);
    expect(customerOrgOf(null)).toBe('');
    expect(customerOrgOf([{ name: 'Alpine AG' }, { name: 'Berg GmbH' }])).toBe('Alpine AG');
  });
});

describe.skipIf(!HAS_DB)('Customer field attribution (shared delivery spaces)', () => {
  const tag = 'it-customerfield';
  let orgId: string;
  let personId: string;
  let alpineId: string;
  let bergId: string;
  let standaloneId: string;
  let delId: string;

  beforeAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: tag } });
    const org = await prisma.organization.create({ data: { name: 'Field Org', slug: tag } });
    orgId = org.id;
    await prisma.jiraConnection.create({
      data: {
        orgId, enabled: true, baseUrl: 'https://example.example', jiraEmail: 'x@example.test',
        jiraApiToken: encryptSecret('jira-token'), tempoApiToken: encryptSecret('tempo-token'),
        customerFieldId: FIELD, customerFieldName: 'Customer Organization',
      },
    });
    personId = (await prisma.resource.create({ data: { orgId, name: 'Delivery Person', capacity: 1, externalWorkId: 'acc-1' } })).id;
    alpineId = (await prisma.customer.create({ data: { orgId, name: 'Alpine  AG', status: 'realised' } })).id;
    bergId = (await prisma.customer.create({ data: { orgId, name: 'Berg Holding', status: 'realised' } })).id;
    standaloneId = (await prisma.customer.create({ data: { orgId, name: 'Standalone Corp', status: 'realised' } })).id;
    // The delivery space as it stood before: classified as internal work.
    delId = (await prisma.jiraWorkItem.create({ data: { orgId, kind: 'project', externalKey: 'DEL', name: 'Delivery', workType: 'internal' } })).id;
    await prisma.jiraWorkItem.create({ data: { orgId, kind: 'project', externalKey: 'STA', name: 'Standalone', customerId: standaloneId } });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  const row = (id: string) => prisma.worklog.findFirstOrThrow({ where: { orgId, tempoWorklogId: id } });

  it('only Jira projects can be flagged as a delivery space', async () => {
    const epic = await prisma.jiraWorkItem.create({ data: { orgId, kind: 'epic', externalKey: 'DEL-500', name: 'An epic' } });
    await expect(integrationService.updateWorkItem(orgId, epic.id, { customerFromField: true })).rejects.toThrow(/Jira project/);
  });

  it('history synced before the flag gets its field value backfilled when the space is flagged', async () => {
    // A worklog already stored from an earlier sync, with no field value read.
    await prisma.worklog.create({
      data: { orgId, tempoWorklogId: 'old-1', accountId: 'acc-1', resourceId: personId, workType: 'internal', jiraIssueKey: 'DEL-9', workDate: '2026-05-04', month: '2026-05', seconds: 3600 },
    });
    (jiraClient.fetchIssueFieldValues as any).mockResolvedValue(new Map([['DEL-9', 'Alpine AG']]));

    await integrationService.updateWorkItem(orgId, delId, { customerFromField: true });

    expect(jiraClient.fetchIssueFieldValues).toHaveBeenCalledWith(expect.anything(), ['DEL-9'], FIELD);
    // "Alpine AG" auto-matched the customer "Alpine  AG" (spacing/case-insensitive).
    const org = await prisma.jiraWorkItem.findFirstOrThrow({ where: { orgId, externalKey: 'org:Alpine AG' } });
    expect(org).toMatchObject({ kind: 'org', name: 'Alpine AG', customerId: alpineId });
    expect(await row('old-1')).toMatchObject({ jiraCustomerOrg: 'Alpine AG', workType: 'client', customerId: alpineId });
  });

  it('sync attributes delivery-space hours by the field; unmapped values fall back to the space mapping', async () => {
    (jiraClient.fetchIssueFieldValues as any).mockClear();
    (jiraClient.fetchIssues as any).mockResolvedValue([
      issue('1', 'DEL-1', 'Alpine AG'),
      issue('2', 'DEL-2', 'Berg GmbH'), // no customer by that name → unmapped item
      issue('3', 'DEL-3', ''), // request without an organization
      issue('4', 'STA-1', 'Alpine AG'), // standalone project: field ignored
    ]);
    (tempoClient.fetchWorklogs as any).mockResolvedValue({
      worklogs: [wl('w1', '1', 3600), wl('w2', '2', 7200), wl('w3', '3', 1800), wl('w4', '4', 5400)],
      truncated: false,
    });
    const r = await integrationService.syncHours(orgId, '2026-06-01');
    expect(r.customerOrgIssues).toBe(0); // every stored row already has its value
    expect(jiraClient.fetchIssueFieldValues).not.toHaveBeenCalled();
    expect(jiraClient.fetchIssues).toHaveBeenCalledWith(expect.anything(), expect.any(Array), FIELD);

    expect(await row('w1')).toMatchObject({ workType: 'client', customerId: alpineId, jiraCustomerOrg: 'Alpine AG' });
    expect(await row('w2')).toMatchObject({ workType: 'internal', customerId: null, jiraCustomerOrg: 'Berg GmbH' });
    expect(await row('w3')).toMatchObject({ workType: 'internal', customerId: null, jiraCustomerOrg: '' });
    expect(await row('w4')).toMatchObject({ workType: 'client', customerId: standaloneId });

    const berg = await prisma.jiraWorkItem.findFirstOrThrow({ where: { orgId, externalKey: 'org:Berg GmbH' } });
    expect(berg.customerId).toBeNull();
    // Values outside delivery spaces never become org items.
    expect(await prisma.jiraWorkItem.count({ where: { orgId, kind: 'org' } })).toBe(2);
  });

  it('mapping an organization re-attributes its history; customer actuals pick it up', async () => {
    const berg = await prisma.jiraWorkItem.findFirstOrThrow({ where: { orgId, externalKey: 'org:Berg GmbH' } });
    await integrationService.updateWorkItem(orgId, berg.id, { customerId: bergId });
    expect(await row('w2')).toMatchObject({ workType: 'client', customerId: bergId });

    const byCustomer = await integrationService.actualsByCustomer(orgId, '2026-06', '2026-06', null);
    expect(byCustomer[alpineId]?.['2026-06']).toBe(1);
    expect(byCustomer[bergId]?.['2026-06']).toBe(2);
    expect(byCustomer[standaloneId]?.['2026-06']).toBe(1.5);
  });

  it('the drills group delivery-space hours by organization instead of epic', async () => {
    // Both organizations planned under one customer (the SME maintenance case).
    const berg = await prisma.jiraWorkItem.findFirstOrThrow({ where: { orgId, externalKey: 'org:Berg GmbH' } });
    await integrationService.updateWorkItem(orgId, berg.id, { customerId: alpineId });

    const custDrill = await integrationService.actualsForCustomerEpics(orgId, alpineId, '2026-06', '2026-06');
    expect(custDrill.map((e) => [e.key, e.name, e.org])).toEqual([
      ['org:Berg GmbH', 'Berg GmbH', true],
      ['org:Alpine AG', 'Alpine AG', true],
    ]);
    expect(custDrill[0].issues[0]).toMatchObject({ key: 'DEL-2', people: [{ resourceId: personId, months: { '2026-06': 2 } }] });
    const personDrill = await integrationService.actualsForResourceEpics(orgId, personId, '2026-06', '2026-06', { customerId: alpineId });
    expect(personDrill.map((e) => e.key)).toEqual(['org:Berg GmbH', 'org:Alpine AG']);
    // A standalone project's hours keep their epic grouping.
    const sta = await integrationService.actualsForCustomerEpics(orgId, standaloneId, '2026-06', '2026-06');
    expect(sta.map((e) => [e.key, e.org])).toEqual([['(no epic)', undefined]]);

    await integrationService.updateWorkItem(orgId, berg.id, { customerId: bergId });
  });

  it('with the space unclassified, unmapped organizations show by name in the drill-down', async () => {
    await integrationService.updateWorkItem(orgId, delId, { workType: 'client' });
    (jiraClient.fetchIssues as any).mockResolvedValue([issue('5', 'DEL-5', 'Cima SA')]);
    (tempoClient.fetchWorklogs as any).mockResolvedValue({ worklogs: [wl('w5', '5', 9000)], truncated: false });
    await integrationService.syncHours(orgId, '2026-06-01');

    const unmapped = await integrationService.actualsForResourceUnmapped(orgId, personId, '2026-06', '2026-06');
    expect(unmapped).toEqual([
      { key: 'org:Cima SA', name: 'Cima SA', org: true, projectKey: 'DEL', stale: false, months: { '2026-06': 2.5 } },
      { key: 'DEL', name: 'Delivery', stale: false, months: { '2026-06': 0.5 } }, // DEL-3, no organization
    ]);
    const drill = await integrationService.actualsForResourceEpics(orgId, personId, '2026-06', '2026-06', { bucket: 'unmapped', projectKey: 'org:Cima SA' });
    expect(drill[0].issues.map((i) => i.key)).toEqual(['DEL-5']);
    const rest = await integrationService.actualsForResourceEpics(orgId, personId, '2026-06', '2026-06', { bucket: 'unmapped', projectKey: 'DEL' });
    expect(rest[0].issues.map((i) => i.key)).toEqual(['DEL-3']);
  });

  it('switching the customer field drops the stored values and re-reads them', async () => {
    (jiraClient.fetchIssueFieldValues as any).mockResolvedValue(
      new Map([['DEL-1', 'Berg GmbH'], ['DEL-2', 'Berg GmbH'], ['DEL-3', ''], ['DEL-5', ''], ['DEL-9', '']])
    );
    const res = await integrationService.setCustomerField(orgId, { fieldId: 'customfield_99', fieldName: 'Organizations' });
    expect(res).toMatchObject({ customerFieldId: 'customfield_99', customerFieldName: 'Organizations', backfillError: null });
    expect(jiraClient.fetchIssueFieldValues).toHaveBeenLastCalledWith(expect.anything(), expect.arrayContaining(['DEL-1', 'DEL-9']), 'customfield_99');
    expect(await row('w1')).toMatchObject({ jiraCustomerOrg: 'Berg GmbH', customerId: bergId });
    expect(await row('old-1')).toMatchObject({ jiraCustomerOrg: '', customerId: null });
    // STA rows aren't in a delivery space, so their value isn't re-read.
    expect((await row('w4')).jiraCustomerOrg).toBeNull();

    // Clearing the field turns field attribution off entirely.
    await integrationService.setCustomerField(orgId, { fieldId: null });
    expect(await row('w1')).toMatchObject({ jiraCustomerOrg: null, workType: 'client', customerId: null });
  });
});
