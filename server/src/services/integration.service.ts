import { prisma } from '../db/prisma.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';
import { jiraClient, JiraError } from './jiraClient.js';
import type { JiraProject, JiraEpic, JiraAccountRow } from './jiraClient.js';
import { tempoClient, TempoError } from './tempoClient.js';

type ConnSecrets = { baseUrl: string | null; jiraEmail: string | null; jiraApiToken: string | null } | null;

// Validate we have enough to call Jira, with a Cloud-specific nudge: an API
// token alone (no email) can't authenticate to *.atlassian.net.
function assertJiraReady(conn: ConnSecrets) {
  if (!conn?.baseUrl || !conn.jiraApiToken) {
    throw new BadRequestError('Set the Jira base URL and API token first, then Save.');
  }
  if (/atlassian\.net/i.test(conn.baseUrl) && !conn.jiraEmail) {
    throw new BadRequestError('Jira Cloud needs the account email that owns the API token.');
  }
}

// Surface Jira failures (401, unreachable, …) as a clear message instead of a
// generic 500.
async function callJira<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof JiraError) throw new BadRequestError(e.message);
    throw e;
  }
}

async function callTempo<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof TempoError) throw new BadRequestError(e.message);
    throw e;
  }
}

interface Pulled { projects: JiraProject[]; epics: JiraEpic[]; accounts: JiraAccountRow[] }

// Upsert pulled Jira reference data, preserving existing customer/project
// mappings (matched by externalKey). Pure DB logic — covered by tests with a
// mock Jira so the fetch itself is the only unverified piece.
export async function applyPulled(orgId: string, pulled: Pulled) {
  for (const p of pulled.projects) {
    await prisma.jiraWorkItem.upsert({
      where: { orgId_externalKey: { orgId, externalKey: p.key } },
      create: { orgId, kind: 'project', externalKey: p.key, name: p.name },
      update: { kind: 'project', name: p.name },
    });
  }
  const items = await prisma.jiraWorkItem.findMany({ where: { orgId }, select: { id: true, externalKey: true } });
  const idByKey = new Map(items.map((i) => [i.externalKey, i.id]));
  for (const e of pulled.epics) {
    const parentId = e.projectKey ? idByKey.get(e.projectKey) ?? null : null;
    await prisma.jiraWorkItem.upsert({
      where: { orgId_externalKey: { orgId, externalKey: e.key } },
      create: { orgId, kind: 'epic', externalKey: e.key, name: e.name, parentId },
      update: { kind: 'epic', name: e.name, parentId },
    });
  }
  for (const a of pulled.accounts) {
    await prisma.jiraAccount.upsert({
      where: { orgId_accountId: { orgId, accountId: a.accountId } },
      create: { orgId, accountId: a.accountId, displayName: a.displayName, email: a.email, active: a.active },
      update: { displayName: a.displayName, email: a.email, active: a.active },
    });
  }
  return { projects: pulled.projects.length, epics: pulled.epics.length, accounts: pulled.accounts.length };
}

/**
 * External-integration settings (Jira / Tempo) per org:
 *  - the connection (base URL, email, two API tokens) — tokens are encrypted at
 *    rest and never returned to the client; the API exposes only whether each
 *    is set;
 *  - the Jira work-item hierarchy mapped onto our Customers/Projects.
 *
 * This is the mapping/config foundation; pulling actual hours comes later and
 * will read the decrypted tokens via getSecrets().
 */

type TokenInput = string | null | undefined; // undefined = leave, null/'' = clear

interface ConnectionInput {
  baseUrl?: string | null;
  jiraEmail?: string | null;
  enabled?: boolean;
  autoSyncEnabled?: boolean;
  jiraApiToken?: TokenInput;
  tempoApiToken?: TokenInput;
}

function tokenPatch(value: TokenInput): string | null | undefined {
  if (value === undefined) return undefined; // leave as-is
  if (value === null || value === '') return null; // clear
  return encryptSecret(value); // set (encrypted)
}

function maskConnection(c: {
  baseUrl: string | null;
  jiraEmail: string | null;
  enabled: boolean;
  jiraApiToken: string | null;
  tempoApiToken: string | null;
  worklogSyncedAt?: Date | null;
  autoSyncEnabled?: boolean;
  lastAutoSyncAt?: Date | null;
  lastAutoSyncStatus?: string | null;
  lastAutoSyncError?: string | null;
  customerFieldId?: string | null;
  customerFieldName?: string | null;
} | null) {
  return {
    baseUrl: c?.baseUrl ?? '',
    jiraEmail: c?.jiraEmail ?? '',
    enabled: c?.enabled ?? false,
    jiraApiTokenSet: !!c?.jiraApiToken,
    tempoApiTokenSet: !!c?.tempoApiToken,
    worklogSyncedAt: c?.worklogSyncedAt ? c.worklogSyncedAt.toISOString() : null,
    autoSyncEnabled: c?.autoSyncEnabled ?? true,
    lastAutoSyncAt: c?.lastAutoSyncAt ? c.lastAutoSyncAt.toISOString() : null,
    lastAutoSyncStatus: c?.lastAutoSyncStatus ?? null,
    lastAutoSyncError: c?.lastAutoSyncError ?? null,
    customerFieldId: c?.customerFieldId ?? null,
    customerFieldName: c?.customerFieldName ?? null,
  };
}

async function ensureCustomerOrProject(
  orgId: string,
  customerId: string | null | undefined,
  projectId: string | null | undefined
) {
  if (customerId && projectId) {
    throw new BadRequestError('Map a work item to a customer or a project, not both');
  }
  if (customerId) {
    const c = await prisma.customer.findFirst({ where: { id: customerId, orgId }, select: { id: true } });
    if (!c) throw new NotFoundError('Customer not found');
  }
  if (projectId) {
    const p = await prisma.project.findFirst({ where: { id: projectId, orgId }, select: { id: true } });
    if (!p) throw new NotFoundError('Project not found');
  }
}

// --- Worklog attribution (shared by the sync and the restamp pass) ---

type ResolvedTarget = { customerId: string | null; projectId: string | null; workType: string };
type MappingLookup = {
  workItemByKey: Map<string, { customerId: string | null; projectId: string | null; workType: string }>;
  customerByProject: Map<string, string | null>;
  // Jira project keys of shared delivery spaces (customer from the field).
  fieldModeProjects: Set<string>;
};

// Customer-field values live in the work-item table as kind "org" items. The
// prefix keeps them apart from Jira keys, which never contain a colon.
export const orgItemKey = (value: string) => `org:${value}`;

async function loadMappingLookup(orgId: string): Promise<MappingLookup> {
  const [workItems, projectRows] = await Promise.all([
    prisma.jiraWorkItem.findMany({ where: { orgId }, select: { externalKey: true, customerId: true, projectId: true, workType: true, customerFromField: true } }),
    prisma.project.findMany({ where: { orgId }, select: { id: true, customerId: true } }),
  ]);
  return {
    workItemByKey: new Map(workItems.map((w) => [w.externalKey, w])),
    customerByProject: new Map(projectRows.map((p) => [p.id, p.customerId])),
    fieldModeProjects: new Set(workItems.filter((w) => w.customerFromField).map((w) => w.externalKey)),
  };
}

// The customer-field item key a worklog resolves through first, if any: only
// in a shared delivery space, and only when the issue carries a value.
function orgKeyFor(fieldModeProjects: Set<string>, projectKey: string | null, customerOrg: string | null | undefined): string | null {
  return customerOrg && projectKey && fieldModeProjects.has(projectKey) ? orgItemKey(customerOrg) : null;
}

// Resolve to our entity, most-specific first: the issue's customer-field value
// (shared delivery spaces only), then its epic, then the Jira project. An
// unmapped level falls through to the next, so a delivery space's own mapping
// (e.g. Internal work) catches issues whose organization isn't mapped yet.
// Internal/absence buckets classify the hours without a customer/project.
function resolveByKeys(lookup: MappingLookup, epicKey: string | null, projectKey: string | null, customerOrg: string | null = null): ResolvedTarget {
  for (const key of [orgKeyFor(lookup.fieldModeProjects, projectKey, customerOrg), epicKey, projectKey]) {
    if (!key) continue;
    const wi = lookup.workItemByKey.get(key);
    if (!wi) continue;
    if (wi.workType && wi.workType !== 'client') return { customerId: null, projectId: null, workType: wi.workType };
    if (wi.projectId) return { projectId: wi.projectId, customerId: lookup.customerByProject.get(wi.projectId) ?? null, workType: 'client' };
    if (wi.customerId) return { projectId: null, customerId: wi.customerId, workType: 'client' };
  }
  return { customerId: null, projectId: null, workType: 'client' };
}

// Jira issue keys are "PROJECTKEY-123" — the prefix identifies the Jira project.
function issueProjectKey(issueKey: string | null): string | null {
  if (!issueKey) return null;
  const i = issueKey.lastIndexOf('-');
  return i > 0 ? issueKey.slice(0, i) : null;
}

const normName = (n: string) => n.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Create the "org" work items for customer-field values not seen before. A
 * new value whose name matches exactly one customer (case/space-insensitive)
 * starts mapped to it; everything else starts unmapped. Existing items are
 * never touched, so a mapping the admin changed stays changed.
 */
async function ensureOrgItems(orgId: string, values: Iterable<string>): Promise<number> {
  const wanted = [...new Set([...values].filter(Boolean))];
  if (wanted.length === 0) return 0;
  const existing = new Set(
    (await prisma.jiraWorkItem.findMany({ where: { orgId, externalKey: { in: wanted.map(orgItemKey) } }, select: { externalKey: true } }))
      .map((e) => e.externalKey)
  );
  const missing = wanted.filter((v) => !existing.has(orgItemKey(v)));
  if (missing.length === 0) return 0;
  const customers = await prisma.customer.findMany({ where: { orgId }, select: { id: true, name: true } });
  const byName = new Map<string, string | null>();
  for (const c of customers) {
    const k = normName(c.name);
    byName.set(k, byName.has(k) ? null : c.id); // ambiguous name → no guess
  }
  await prisma.jiraWorkItem.createMany({
    data: missing.map((v) => ({ orgId, kind: 'org', externalKey: orgItemKey(v), name: v, customerId: byName.get(normName(v)) ?? null })),
    skipDuplicates: true,
  });
  return missing.length;
}

// Look up the customer-field value of at most this many issues per pass —
// bounds a first backfill of a large delivery space; the rest follow on the
// next sync.
const ORG_BACKFILL_CAP = 2000;

/**
 * Fill in the customer-field value on stored worklogs of shared delivery
 * spaces that were synced before the field (or the space's flag) was set up —
 * a delta sync never re-pulls them. Creates the "org" items for the values it
 * finds. Restamping is left to the caller. Returns how many issues it read.
 */
async function backfillCustomerOrgs(orgId: string, conn: { baseUrl: string | null; jiraEmail: string | null; jiraApiToken: string | null; customerFieldId: string | null }) {
  if (!conn.customerFieldId) return 0;
  const modeProjects = await prisma.jiraWorkItem.findMany({ where: { orgId, customerFromField: true }, select: { externalKey: true } });
  if (modeProjects.length === 0) return 0;
  const pending = await prisma.worklog.findMany({
    where: {
      orgId,
      jiraCustomerOrg: null,
      OR: modeProjects.map((p) => ({ jiraIssueKey: { startsWith: `${p.externalKey}-` } })),
    },
    distinct: ['jiraIssueKey'],
    select: { jiraIssueKey: true },
    take: ORG_BACKFILL_CAP,
  });
  const keys = pending.map((w) => w.jiraIssueKey).filter((k): k is string => !!k);
  if (keys.length === 0) return 0;
  const values = await callJira(() => jiraClient.fetchIssueFieldValues(conn, keys, conn.customerFieldId!));
  const keysByValue = new Map<string, string[]>();
  for (const [key, value] of values) keysByValue.set(value, [...(keysByValue.get(value) || []), key]);
  for (const [value, ks] of keysByValue) {
    for (let i = 0; i < ks.length; i += 5000) {
      await prisma.worklog.updateMany({ where: { orgId, jiraIssueKey: { in: ks.slice(i, i + 5000) }, jiraCustomerOrg: null }, data: { jiraCustomerOrg: value } });
    }
  }
  await ensureOrgItems(orgId, keysByValue.keys());
  return keys.length;
}

// How an unmapped client worklog is grouped in the people drill-down: by its
// customer-field value inside a shared delivery space (so each unmapped client
// shows by name), else by Jira project.
function unmappedGroupKey(fieldModeProjects: Set<string>, w: { jiraIssueKey: string | null; jiraCustomerOrg: string | null }): string {
  const projectKey = issueProjectKey(w.jiraIssueKey);
  return orgKeyFor(fieldModeProjects, projectKey, w.jiraCustomerOrg) || projectKey || '(no Jira issue)';
}

async function loadFieldModeProjects(orgId: string): Promise<Set<string>> {
  const rows = await prisma.jiraWorkItem.findMany({ where: { orgId, customerFromField: true }, select: { externalKey: true } });
  return new Set(rows.map((r) => r.externalKey));
}

type EpicDrillWorklog = {
  jiraEpicKey: string | null;
  jiraIssueKey: string | null;
  jiraCustomerOrg?: string | null;
  month: string;
  seconds: number;
  description: string | null;
  workDate: string;
  resourceId?: string | null;
};

// Group worklog rows by Jira epic → issue with per-month hour sums — the
// shared core of the person- and customer-scoped drill endpoints. Epics are
// named from the pulled JiraWorkItem rows; worklogs without an epic land
// under "(no epic)", without an issue key under "(no issue)". Each issue
// carries the most recent worklog note as a description hint. With
// `people`, each issue also lists who logged it ({ resourceId, name,
// months }, restricted to visibleResourceIds unless null = everyone) —
// hours of unmatched Jira accounts stay in the issue totals but get no
// person row. Every level sorts by total hours, largest first.
// Inside a shared delivery space the first level is the issue's customer
// organization instead of its epic (delivery tickets rarely sit under epics,
// and the organization is what the hours are about); those groups carry
// `org: true` and the "org:<value>" key of their work item.
async function groupWorklogsByEpic(
  orgId: string,
  rows: EpicDrillWorklog[],
  people?: { visibleResourceIds: string[] | null }
) {
  type PersonAgg = { seconds: Record<string, number>; total: number };
  type IssueAgg = { seconds: Record<string, number>; total: number; description: string | null; descDate: string; people: Map<string, PersonAgg> };
  type EpicAgg = { seconds: Record<string, number>; total: number; issues: Map<string, IssueAgg> };
  const epics = new Map<string, EpicAgg>();
  const fieldMode = rows.some((w) => w.jiraCustomerOrg) ? await loadFieldModeProjects(orgId) : new Set<string>();
  for (const w of rows) {
    const epicKey = orgKeyFor(fieldMode, issueProjectKey(w.jiraIssueKey), w.jiraCustomerOrg) || w.jiraEpicKey || '(no epic)';
    const issueKey = w.jiraIssueKey || '(no issue)';
    const epic = epics.get(epicKey) || { seconds: {}, total: 0, issues: new Map<string, IssueAgg>() };
    epic.seconds[w.month] = (epic.seconds[w.month] || 0) + w.seconds;
    epic.total += w.seconds;
    const issue = epic.issues.get(issueKey) || { seconds: {}, total: 0, description: null, descDate: '', people: new Map<string, PersonAgg>() };
    issue.seconds[w.month] = (issue.seconds[w.month] || 0) + w.seconds;
    issue.total += w.seconds;
    if (w.description && w.workDate >= issue.descDate) {
      issue.description = w.description;
      issue.descDate = w.workDate;
    }
    if (people && w.resourceId && (!people.visibleResourceIds || people.visibleResourceIds.includes(w.resourceId))) {
      const person = issue.people.get(w.resourceId) || { seconds: {}, total: 0 };
      person.seconds[w.month] = (person.seconds[w.month] || 0) + w.seconds;
      person.total += w.seconds;
      issue.people.set(w.resourceId, person);
    }
    epic.issues.set(issueKey, issue);
    epics.set(epicKey, epic);
  }
  if (epics.size === 0) return [];

  const named = await prisma.jiraWorkItem.findMany({
    where: { orgId, externalKey: { in: [...epics.keys()].filter((k) => k !== '(no epic)') } },
    select: { externalKey: true, name: true },
  });
  const nameByKey = new Map(named.map((n) => [n.externalKey, n.name]));
  const personIds = people
    ? [...new Set([...epics.values()].flatMap((e) => [...e.issues.values()].flatMap((i) => [...i.people.keys()])))]
    : [];
  const personName = personIds.length
    ? new Map((await prisma.resource.findMany({ where: { orgId, id: { in: personIds } }, select: { id: true, name: true } })).map((r) => [r.id, r.name]))
    : new Map<string, string>();
  const toHours = (secs: Record<string, number>) =>
    Object.fromEntries(Object.entries(secs).map(([m, s]) => [m, Math.round((s / 3600) * 10) / 10]));

  return [...epics.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, e]) => ({
      key,
      name: nameByKey.get(key) || (key.startsWith('org:') ? key.slice(4) : key),
      ...(key.startsWith('org:') ? { org: true } : {}),
      months: toHours(e.seconds),
      issues: [...e.issues.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([ikey, i]) => ({
          key: ikey,
          description: i.description,
          months: toHours(i.seconds),
          ...(people
            ? {
                people: [...i.people.entries()]
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([rid, p]) => ({ resourceId: rid, name: personName.get(rid) || 'Unknown person', months: toHours(p.seconds) })),
              }
            : {}),
        })),
    }));
}

/**
 * Re-resolve every stored worklog through the current mappings and rewrite the
 * rows whose target changed. The sync stamps rows as it pulls them, but a
 * delta sync never re-pulls old worklogs — so without this, reclassifying a
 * Jira project (e.g. as absences) or remapping it to another customer would
 * leave all history under the old attribution forever. Runs after mapping
 * edits and at the end of each sync. Rows with no Jira keys at all can't be
 * re-attributed and are left alone; grouped updateMany writes keep the pass
 * to a handful of queries even on large orgs.
 */
async function restampWorklogs(orgId: string): Promise<number> {
  const lookup = await loadMappingLookup(orgId);
  const changedByTarget = new Map<string, { target: ResolvedTarget; ids: string[] }>();
  const PAGE = 5000;
  let cursor: string | undefined;
  for (;;) {
    const page: { id: string; jiraIssueKey: string | null; jiraEpicKey: string | null; jiraCustomerOrg: string | null; customerId: string | null; projectId: string | null; workType: string }[] =
      await prisma.worklog.findMany({
        where: { orgId },
        select: { id: true, jiraIssueKey: true, jiraEpicKey: true, jiraCustomerOrg: true, customerId: true, projectId: true, workType: true },
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: PAGE,
      });
    if (page.length === 0) break;
    for (const w of page) {
      const projectKey = issueProjectKey(w.jiraIssueKey);
      if (!w.jiraEpicKey && !projectKey) continue;
      const next = resolveByKeys(lookup, w.jiraEpicKey, projectKey, w.jiraCustomerOrg);
      if (next.customerId === w.customerId && next.projectId === w.projectId && next.workType === w.workType) continue;
      const key = `${next.customerId}|${next.projectId}|${next.workType}`;
      const bucket = changedByTarget.get(key) || { target: next, ids: [] };
      bucket.ids.push(w.id);
      changedByTarget.set(key, bucket);
    }
    if (page.length < PAGE) break;
    cursor = page[page.length - 1].id;
  }
  let changed = 0;
  for (const { target, ids } of changedByTarget.values()) {
    for (let i = 0; i < ids.length; i += 5000) {
      const chunk = ids.slice(i, i + 5000);
      await prisma.worklog.updateMany({ where: { id: { in: chunk } }, data: target });
      changed += chunk.length;
    }
  }
  return changed;
}

// Reject a parent that is the item itself or one of its descendants (cycle).
async function assertNoCycle(orgId: string, itemId: string, parentId: string) {
  if (itemId === parentId) throw new BadRequestError('A work item cannot be its own parent');
  let cursor: string | null = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === itemId) throw new BadRequestError('That parent would create a loop');
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const node: { parentId: string | null } | null = await prisma.jiraWorkItem.findFirst({
      where: { id: cursor, orgId },
      select: { parentId: true },
    });
    cursor = node?.parentId ?? null;
  }
}

export const integrationService = {
  // --- Connection ---
  async getConnection(orgId: string) {
    const c = await prisma.jiraConnection.findUnique({ where: { orgId } });
    return maskConnection(c);
  },

  /** Decrypted tokens for server-side use (future sync). Never sent to client. */
  async getSecrets(orgId: string) {
    const c = await prisma.jiraConnection.findUnique({ where: { orgId } });
    if (!c) return null;
    return {
      baseUrl: c.baseUrl,
      jiraEmail: c.jiraEmail,
      enabled: c.enabled,
      jiraApiToken: decryptSecret(c.jiraApiToken),
      tempoApiToken: decryptSecret(c.tempoApiToken),
      customerFieldId: c.customerFieldId,
    };
  },

  /** Validate the stored credentials against Jira. */
  async testConnection(orgId: string) {
    const conn = await this.getSecrets(orgId);
    assertJiraReady(conn);
    const me = await callJira(() => jiraClient.testConnection(conn!));
    return { ok: true, user: me };
  },

  /** Pull projects, epics and accounts from Jira into the local cache. */
  async refreshFromJira(orgId: string) {
    const conn = await this.getSecrets(orgId);
    assertJiraReady(conn);
    const [projects, epics, accounts] = await callJira(() =>
      Promise.all([
        jiraClient.fetchProjects(conn!),
        jiraClient.fetchEpics(conn!),
        jiraClient.fetchAccounts(conn!),
      ])
    );
    const counts = await applyPulled(orgId, { projects, epics, accounts });
    // Also read the customer field on already-synced delivery-space hours, so
    // their organizations show up for mapping without waiting for a sync.
    const customerOrgIssues = await backfillCustomerOrgs(orgId, conn!);
    if (customerOrgIssues > 0) await restampWorklogs(orgId);
    return { ...counts, customerOrgIssues };
  },

  /**
   * Pull Tempo worklogs for [from, to], resolve each through the mappings
   * (author → person, issue → epic/project → customer/project), and upsert them
   * as Worklog rows (idempotent by tempoWorklogId). Returns a sync summary.
   */
  async syncHours(orgId: string, updatedFrom: string) {
    const conn = await this.getSecrets(orgId);
    assertJiraReady(conn);
    if (!conn?.tempoApiToken) throw new BadRequestError('Add the Tempo API token first');

    const connRow = await prisma.jiraConnection.findUnique({
      where: { orgId },
      select: { worklogSyncedAt: true },
    });
    const prevCursor = connRow?.worklogSyncedAt ?? null;

    const { worklogs, truncated } = await callTempo(() =>
      tempoClient.fetchWorklogs(conn.tempoApiToken, updatedFrom)
    );

    // Resolve the worklogs' Jira issues → project/epic keys.
    const issueIds = [...new Set(worklogs.map((w) => w.issueId).filter(Boolean))];
    const issues = issueIds.length ? await callJira(() => jiraClient.fetchIssues(conn, issueIds, conn.customerFieldId)) : [];
    const issueById = new Map(issues.map((i) => [i.id, i]));

    // New customer-field values in shared delivery spaces become mappable
    // "org" items (auto-matched by customer name) before resolving.
    const modeProjects = await loadFieldModeProjects(orgId);
    await ensureOrgItems(orgId, issues.filter((i) => i.projectKey && modeProjects.has(i.projectKey)).map((i) => i.customerOrg || ''));

    // Mapping lookups.
    const [lookup, mappedResources] = await Promise.all([
      loadMappingLookup(orgId),
      prisma.resource.findMany({ where: { orgId, externalWorkId: { not: null } }, select: { id: true, externalWorkId: true } }),
    ]);
    const resourceByAccount = new Map(mappedResources.map((r) => [r.externalWorkId as string, r.id]));
    const resolveEntity = (epicKey: string | null, projectKey: string | null, customerOrg: string | null) => resolveByKeys(lookup, epicKey, projectKey, customerOrg);

    let totalSeconds = 0;
    let mapped = 0;
    const matchedResourceIds = new Set<string>();
    const unmatchedAccounts = new Set<string>();
    const secondsByResource = new Map<string, number>();
    const secondsByCustomer = new Map<string, number>();
    const seenWorklogIds = new Set<string>();

    // Resolve every worklog first, then write in batches. Per-row upserts
    // round-trip the database thousands of times on a first full pull — slow
    // enough to push the request past upstream proxy timeouts, which surfaces
    // in the UI as an opaque "Request failed".
    const rows: {
      tempoWorklogId: string; accountId: string; resourceId: string | null;
      customerId: string | null; projectId: string | null; workType: string;
      jiraIssueKey: string | null; jiraEpicKey: string | null; jiraCustomerOrg: string | null;
      workDate: string; month: string; seconds: number; description: string | null;
    }[] = [];
    for (const w of worklogs) {
      seenWorklogIds.add(w.tempoWorklogId);
      const resourceId = resourceByAccount.get(w.accountId) ?? null;
      if (resourceId) { matchedResourceIds.add(resourceId); secondsByResource.set(resourceId, (secondsByResource.get(resourceId) || 0) + w.seconds); }
      else if (w.accountId) unmatchedAccounts.add(w.accountId);

      const ref = issueById.get(w.issueId) || null;
      const customerOrg = ref?.customerOrg ?? null;
      const { customerId, projectId, workType } = resolveEntity(ref?.epicKey ?? null, ref?.projectKey ?? null, customerOrg);
      if (customerId || projectId || workType !== 'client') mapped += 1;
      if (customerId) secondsByCustomer.set(customerId, (secondsByCustomer.get(customerId) || 0) + w.seconds);
      totalSeconds += w.seconds;

      rows.push({
        tempoWorklogId: w.tempoWorklogId, accountId: w.accountId, resourceId,
        customerId, projectId, workType, jiraIssueKey: ref?.key ?? null, jiraEpicKey: ref?.epicKey ?? null,
        jiraCustomerOrg: customerOrg, workDate: w.date, month: (w.date || '').slice(0, 7), seconds: w.seconds, description: w.description,
      });
    }

    // Tempo pagination can return the same worklog on two pages when rows shift
    // mid-pull — keep the last occurrence so createMany can't hit the unique key.
    const uniqueRows = [...new Map(rows.map((r) => [r.tempoWorklogId, r])).values()];

    // Split into create vs update against what's already stored.
    const existingIds = new Set<string>();
    const allIds = uniqueRows.map((r) => r.tempoWorklogId);
    for (let i = 0; i < allIds.length; i += 5000) {
      const found = await prisma.worklog.findMany({
        where: { orgId, tempoWorklogId: { in: allIds.slice(i, i + 5000) } },
        select: { tempoWorklogId: true },
      });
      for (const f of found) existingIds.add(f.tempoWorklogId);
    }
    const toCreate = uniqueRows.filter((r) => !existingIds.has(r.tempoWorklogId));
    const toUpdate = uniqueRows.filter((r) => existingIds.has(r.tempoWorklogId));
    for (let i = 0; i < toCreate.length; i += 1000) {
      await prisma.worklog.createMany({
        data: toCreate.slice(i, i + 1000).map((r) => ({ orgId, ...r })),
        skipDuplicates: true,
      });
    }
    for (let i = 0; i < toUpdate.length; i += 200) {
      // updateMany per row (not update) so a row deleted by a concurrent full
      // sync's reconciliation can't throw and abort the chunk.
      await prisma.$transaction(
        toUpdate.slice(i, i + 200).map(({ tempoWorklogId, ...data }) =>
          prisma.worklog.updateMany({ where: { orgId, tempoWorklogId }, data })
        )
      );
    }

    const names = await prisma.resource.findMany({ where: { orgId, id: { in: [...secondsByResource.keys()] } }, select: { id: true, name: true } });
    const nameById = new Map(names.map((n) => [n.id, n.name]));
    const byPerson = [...secondsByResource.entries()]
      .map(([id, s]) => ({ name: nameById.get(id) || '?', hours: Math.round((s / 3600) * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);

    const custNames = await prisma.customer.findMany({ where: { orgId, id: { in: [...secondsByCustomer.keys()] } }, select: { id: true, name: true } });
    const custNameById = new Map(custNames.map((c) => [c.id, c.name]));
    const byCustomer = [...secondsByCustomer.entries()]
      .map(([id, s]) => ({ name: custNameById.get(id) || '?', hours: Math.round((s / 3600) * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);

    // Reconcile deletions: on a full pull (updatedFrom at the beginning of time)
    // that wasn't truncated, any local worklog Tempo didn't return no longer
    // exists there — remove it so actuals stop over-counting. Only when the pull
    // returned something, so an API glitch returning empty can't wipe the org.
    const isFullPull = updatedFrom <= '2001-01-01';
    let deleted = 0;
    if (isFullPull && !truncated && seenWorklogIds.size > 0) {
      const res = await prisma.worklog.deleteMany({
        where: { orgId, tempoWorklogId: { notIn: [...seenWorklogIds] } },
      });
      deleted = res.count;
    }

    // Older delivery-space rows synced before the customer field was set up
    // get their value read now, so the restamp below can attribute them.
    const customerOrgIssues = await backfillCustomerOrgs(orgId, conn);

    // Heal older rows the delta didn't re-pull: mappings may have changed since
    // they were stamped (a Jira project reclassified as absences, a remapped
    // customer). The rows written above already match, so this only touches
    // genuinely stale history.
    const restamped = await restampWorklogs(orgId);

    // Advance the delta cursor only when this pull actually covers everything
    // since the previous cursor and wasn't truncated. A narrow manual re-pull
    // that starts after the cursor must not jump it forward (that would leave
    // the gap permanently unfetched); a truncated pull mustn't advance either.
    const syncedAt = new Date();
    const updatedFromDate = new Date(`${updatedFrom}T00:00:00.000Z`);
    const coversGap = !prevCursor || updatedFromDate <= prevCursor;
    if (coversGap && !truncated) {
      await prisma.jiraConnection.update({ where: { orgId }, data: { worklogSyncedAt: syncedAt } });
    }

    return {
      updatedFrom,
      syncedAt: syncedAt.toISOString(),
      worklogs: worklogs.length,
      createdWorklogs: toCreate.length,
      updatedWorklogs: toUpdate.length,
      restampedWorklogs: restamped,
      customerOrgIssues,
      hours: Math.round((totalSeconds / 3600) * 10) / 10,
      matchedPeople: matchedResourceIds.size,
      unmatchedAccounts: unmatchedAccounts.size,
      mappedWorklogs: mapped,
      unmappedWorklogs: worklogs.length - mapped,
      deletedWorklogs: deleted,
      truncated,
      cursorAdvanced: coversGap && !truncated,
      byPerson,
      byCustomer,
    };
  },

  /**
   * Actual hours (from synced worklogs) for a customer in a month, per person.
   * `visibleResourceIds` (null = admin/all) limits the per-person breakdown to
   * people the caller may see — worklog authors are resolved via Jira mapping,
   * not planner assignments, so they aren't otherwise scope-bound.
   */
  async actualsForCustomerMonth(
    orgId: string,
    customerId: string,
    month: string,
    visibleResourceIds: string[] | null
  ) {
    const where: any = { orgId, customerId, month, resourceId: { not: null } };
    if (visibleResourceIds) where.resourceId = { in: visibleResourceIds };
    const rows = await prisma.worklog.groupBy({
      by: ['resourceId'],
      where,
      _sum: { seconds: true },
    });
    const out: Record<string, number> = {};
    for (const r of rows) {
      if (!r.resourceId) continue;
      out[r.resourceId] = Math.round(((r._sum.seconds || 0) / 3600) * 10) / 10;
    }
    return out;
  },

  /**
   * Actual hours per person per month over [fromMonth, toMonth]. Scoped to the
   * given resource ids (the caller's visible people); null = all (admin).
   * Absence hours are excluded — time off is not logged work, and counting it
   * would inflate a person's actual utilization. Internal hours count.
   * Returned as { [resourceId]: { [month]: hours } } for easy lookup.
   */
  async actualsByResource(orgId: string, fromMonth: string, toMonth: string, visibleIds: string[] | null) {
    const where: any = { orgId, month: { gte: fromMonth, lte: toMonth }, workType: { not: 'absence' } };
    where.resourceId = visibleIds ? { in: visibleIds } : { not: null };
    const rows = await prisma.worklog.groupBy({
      by: ['resourceId', 'month'],
      where,
      _sum: { seconds: true },
    });
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (!r.resourceId) continue;
      (out[r.resourceId] = out[r.resourceId] || {})[r.month] = Math.round(((r._sum.seconds || 0) / 3600) * 10) / 10;
    }
    return out;
  },

  /**
   * Actual hours per person per month per work type over [fromMonth, toMonth] —
   * the un-filtered companion to actualsByResource. Feeds the People-capacity
   * heatmap's stacked client/internal bar, its work-type filter, and the
   * per-person drill-down's Internal/Absence bucket rows. Scoped like
   * actualsByResource; null = all (admin).
   * Returned as { [resourceId]: { [month]: { [workType]: hours } } }.
   */
  async actualsByResourceType(orgId: string, fromMonth: string, toMonth: string, visibleIds: string[] | null) {
    const where: any = { orgId, month: { gte: fromMonth, lte: toMonth } };
    where.resourceId = visibleIds ? { in: visibleIds } : { not: null };
    const rows = await prisma.worklog.groupBy({
      by: ['resourceId', 'month', 'workType'],
      where,
      _sum: { seconds: true },
    });
    const out: Record<string, Record<string, Record<string, number>>> = {};
    for (const r of rows) {
      if (!r.resourceId) continue;
      const months = (out[r.resourceId] = out[r.resourceId] || {});
      const types = (months[r.month] = months[r.month] || {});
      types[r.workType || 'client'] = Math.round(((r._sum.seconds || 0) / 3600) * 10) / 10;
    }
    return out;
  },

  /**
   * Org-wide logged hours per month split into the four buckets the home
   * dashboard chart stacks: client (mapped work), unmapped (client-type hours
   * with no customer/project), internal, and absence. Only hours resolved to a
   * person count (an account only resolves once it's matched), scoped to the
   * caller's visible people; null = all (admin).
   * Returned as { [month]: { client, unmapped, internal, absence } } in hours.
   */
  async actualsWorkBuckets(orgId: string, fromMonth: string, toMonth: string, visibleIds: string[] | null) {
    const where: any = { orgId, month: { gte: fromMonth, lte: toMonth } };
    where.resourceId = visibleIds ? { in: visibleIds } : { not: null };
    const [byType, unmappedRows] = await Promise.all([
      prisma.worklog.groupBy({ by: ['month', 'workType'], where, _sum: { seconds: true } }),
      prisma.worklog.groupBy({
        by: ['month'],
        where: { ...where, workType: 'client', customerId: null, projectId: null },
        _sum: { seconds: true },
      }),
    ]);
    const h = (s: number | null) => Math.round(((s || 0) / 3600) * 10) / 10;
    const out: Record<string, { client: number; unmapped: number; internal: number; absence: number }> = {};
    const bucket = (m: string) => (out[m] = out[m] || { client: 0, unmapped: 0, internal: 0, absence: 0 });
    for (const r of byType) {
      const b = bucket(r.month);
      if (r.workType === 'internal') b.internal += h(r._sum.seconds);
      else if (r.workType === 'absence') b.absence += h(r._sum.seconds);
      else b.client += h(r._sum.seconds);
    }
    for (const r of unmappedRows) {
      const b = bucket(r.month);
      b.unmapped = h(r._sum.seconds);
      b.client = Math.round((b.client - b.unmapped) * 10) / 10;
    }
    return out;
  },

  /**
   * Actual hours per customer per month over [fromMonth, toMonth], scoped to the
   * given customer ids (caller's visible customers); null = all (admin).
   * Returned as { [customerId]: { [month]: hours } }.
   */
  async actualsByCustomer(orgId: string, fromMonth: string, toMonth: string, visibleIds: string[] | null, resourceIds: string[] | null = null) {
    const where: any = { orgId, month: { gte: fromMonth, lte: toMonth }, customerId: { not: null } };
    if (visibleIds) where.customerId = { in: visibleIds };
    // Team lens: count only these people's hours (worklogs of unmatched Jira
    // accounts have no resourceId and drop out — they can't be attributed).
    if (resourceIds) where.resourceId = { in: resourceIds };
    const rows = await prisma.worklog.groupBy({
      by: ['customerId', 'month'],
      where,
      _sum: { seconds: true },
    });
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (!r.customerId) continue;
      (out[r.customerId] = out[r.customerId] || {})[r.month] = Math.round(((r._sum.seconds || 0) / 3600) * 10) / 10;
    }
    return out;
  },

  /**
   * Actual hours per project per month over [fromMonth, toMonth], scoped to the
   * given project ids (caller's visible projects); null = all (admin). Only
   * worklogs whose mapping resolves to a project appear here — the per-customer
   * aggregation is the authoritative total.
   * Returned as { [projectId]: { [month]: hours } }.
   */
  async actualsByProject(orgId: string, fromMonth: string, toMonth: string, visibleIds: string[] | null, resourceIds: string[] | null = null) {
    const where: any = { orgId, month: { gte: fromMonth, lte: toMonth }, projectId: { not: null } };
    if (visibleIds) where.projectId = { in: visibleIds };
    // Team lens: count only these people's hours (worklogs of unmatched Jira
    // accounts have no resourceId and drop out — they can't be attributed).
    if (resourceIds) where.resourceId = { in: resourceIds };
    const rows = await prisma.worklog.groupBy({
      by: ['projectId', 'month'],
      where,
      _sum: { seconds: true },
    });
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (!r.projectId) continue;
      (out[r.projectId] = out[r.projectId] || {})[r.month] = Math.round(((r._sum.seconds || 0) / 3600) * 10) / 10;
    }
    return out;
  },

  /**
   * Actual hours for one person, broken down by customer + month. Feeds the
   * 1:1 cockpit chart when a project (→ customer) is focused.
   * Returned as { [customerId]: { [month]: hours } }.
   */
  async actualsForResourceByCustomer(
    orgId: string,
    resourceId: string,
    fromMonth: string,
    toMonth: string,
    visibleCustomerIds: string[] | null
  ) {
    const where: any = { orgId, resourceId, month: { gte: fromMonth, lte: toMonth }, customerId: { not: null } };
    if (visibleCustomerIds) where.customerId = { in: visibleCustomerIds };
    const rows = await prisma.worklog.groupBy({
      by: ['customerId', 'month'],
      where,
      _sum: { seconds: true },
    });
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (!r.customerId) continue;
      (out[r.customerId] = out[r.customerId] || {})[r.month] = Math.round(((r._sum.seconds || 0) / 3600) * 10) / 10;
    }
    return out;
  },

  /**
   * A person's client-type hours that resolve to no customer/project, grouped
   * by Jira project (from the issue-key prefix) per month — the drill-down's
   * per-project "not mapped" rows, so unmapped time is inspectable by name
   * instead of one opaque bucket. Named from the cached JiraWorkItem when the
   * project was pulled from Jira; hours whose issue lookup failed at sync time
   * land under "(no Jira issue)".
   * Returned as [{ key, name, months: { [month]: hours } }], largest first.
   */
  async actualsForResourceUnmapped(orgId: string, resourceId: string, fromMonth: string, toMonth: string) {
    const [rows, fieldMode] = await Promise.all([
      prisma.worklog.findMany({
        where: {
          orgId, resourceId, month: { gte: fromMonth, lte: toMonth },
          workType: 'client', customerId: null, projectId: null,
        },
        select: { jiraIssueKey: true, jiraCustomerOrg: true, month: true, seconds: true },
      }),
      loadFieldModeProjects(orgId),
    ]);
    const byKey = new Map<string, Record<string, number>>();
    const projectOfKey = new Map<string, string | null>();
    for (const w of rows) {
      const key = unmappedGroupKey(fieldMode, w);
      projectOfKey.set(key, issueProjectKey(w.jiraIssueKey));
      const months = byKey.get(key) || {};
      months[w.month] = (months[w.month] || 0) + w.seconds;
      byKey.set(key, months);
    }
    if (byKey.size === 0) return [];
    const items = await prisma.jiraWorkItem.findMany({
      where: { orgId, externalKey: { in: [...byKey.keys()] } },
      select: { externalKey: true, name: true, kind: true, customerId: true, projectId: true, workType: true },
    });
    const itemByKey = new Map(items.map((n) => [n.externalKey, n]));
    const total = (months: Record<string, number>) => Object.values(months).reduce((s, v) => s + v, 0);
    return [...byKey.entries()]
      .sort((a, b) => total(b[1]) - total(a[1]))
      .map(([key, secondsByMonth]) => {
        const wi = itemByKey.get(key);
        // The Jira project IS mapped/classified but these hours predate it —
        // the stale-attribution case a "Re-apply mappings" run fixes.
        const stale = !!wi && (!!wi.customerId || !!wi.projectId || wi.workType !== 'client');
        const isOrg = key.startsWith('org:');
        return {
          key,
          name: wi?.name || (isOrg ? key.slice(4) : key),
          // A customer-field value inside a shared delivery space (projectKey
          // = that space) rather than a whole Jira project.
          ...(isOrg ? { org: true, projectKey: projectOfKey.get(key) ?? null } : {}),
          stale,
          months: Object.fromEntries(
            Object.entries(secondsByMonth).map(([m, s]) => [m, Math.round((s / 3600) * 10) / 10])
          ),
        };
      });
  },

  /**
   * A person's logged hours grouped by Jira epic → issue, for one drill-down
   * row of the people heatmap. No plan exists at this depth — actual hours
   * only. Scope is exactly one of:
   *   { customerId }                       — hours attributed to that customer
   *   { bucket: 'internal' | 'absence' }   — the org-level buckets
   *   { bucket: 'unmapped', projectKey? }  — client hours with no customer/
   *     project, optionally narrowed to one Jira project (issue-key prefix)
   * Grouping semantics live in groupWorklogsByEpic.
   */
  async actualsForResourceEpics(
    orgId: string,
    resourceId: string,
    fromMonth: string,
    toMonth: string,
    scope: { customerId?: string; bucket?: 'internal' | 'absence' | 'unmapped'; projectKey?: string }
  ) {
    const where: any = { orgId, resourceId, month: { gte: fromMonth, lte: toMonth } };
    if (scope.customerId) where.customerId = scope.customerId;
    else if (scope.bucket === 'internal' || scope.bucket === 'absence') where.workType = scope.bucket;
    else if (scope.bucket === 'unmapped') Object.assign(where, { workType: 'client', customerId: null, projectId: null });
    else throw new BadRequestError('Provide customerId or bucket');

    let rows = await prisma.worklog.findMany({
      where,
      select: { jiraEpicKey: true, jiraIssueKey: true, jiraCustomerOrg: true, month: true, seconds: true, description: true, workDate: true },
    });
    // The unmapped drill is per Jira project (or per customer-field value in a
    // shared delivery space) — keep only that group's issues.
    if (scope.bucket === 'unmapped' && scope.projectKey) {
      const fieldMode = await loadFieldModeProjects(orgId);
      rows = rows.filter((w) => unmappedGroupKey(fieldMode, w) === scope.projectKey);
    }
    return groupWorklogsByEpic(orgId, rows);
  },

  /** A team's people ids — the team lens the actuals endpoints filter by. */
  async resourceIdsForTeam(orgId: string, teamId: string) {
    const rows = await prisma.resource.findMany({
      where: { orgId, teams: { some: { id: teamId } } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  },

  /**
   * A customer's logged hours grouped by Jira epic → issue → person — the
   * Client-Staffing drill. Covers everything attributed to the customer
   * (directly or via a project mapping); optionally narrowed to one team's
   * people via resourceIds. The person level only names people in
   * visibleResourceIds (null = everyone). Actual hours only — no plan exists
   * at this depth.
   */
  async actualsForCustomerEpics(
    orgId: string,
    customerId: string,
    fromMonth: string,
    toMonth: string,
    resourceIds: string[] | null = null,
    visibleResourceIds: string[] | null = null
  ) {
    const where: any = { orgId, customerId, month: { gte: fromMonth, lte: toMonth } };
    if (resourceIds) where.resourceId = { in: resourceIds };
    const rows = await prisma.worklog.findMany({
      where,
      select: { jiraEpicKey: true, jiraIssueKey: true, jiraCustomerOrg: true, month: true, seconds: true, description: true, workDate: true, resourceId: true },
    });
    return groupWorklogsByEpic(orgId, rows, { visibleResourceIds });
  },

  /**
   * Actual hours for one customer, broken down by person + month. Feeds the
   * PM-review chart when a person is focused.
   * Returned as { [resourceId]: { [month]: hours } }.
   */
  async actualsForCustomerByResource(
    orgId: string,
    customerId: string,
    fromMonth: string,
    toMonth: string,
    visibleResourceIds: string[] | null
  ) {
    const where: any = { orgId, customerId, month: { gte: fromMonth, lte: toMonth }, resourceId: { not: null } };
    if (visibleResourceIds) where.resourceId = { in: visibleResourceIds };
    const rows = await prisma.worklog.groupBy({
      by: ['resourceId', 'month'],
      where,
      _sum: { seconds: true },
    });
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (!r.resourceId) continue;
      (out[r.resourceId] = out[r.resourceId] || {})[r.month] = Math.round(((r._sum.seconds || 0) / 3600) * 10) / 10;
    }
    return out;
  },

  async listAccounts(orgId: string) {
    return prisma.jiraAccount.findMany({
      where: { orgId },
      orderBy: { displayName: 'asc' },
      select: { id: true, accountId: true, displayName: true, email: true, active: true },
    });
  },

  async saveConnection(orgId: string, data: ConnectionInput) {
    const jira = tokenPatch(data.jiraApiToken);
    const tempo = tokenPatch(data.tempoApiToken);
    // Leave autoSyncEnabled untouched when the caller omits it (create defaults
    // to true via the schema).
    const autoSync = data.autoSyncEnabled !== undefined ? { autoSyncEnabled: data.autoSyncEnabled } : {};
    const base = {
      baseUrl: data.baseUrl ?? null,
      jiraEmail: data.jiraEmail ?? null,
      enabled: data.enabled ?? false,
    };
    await prisma.jiraConnection.upsert({
      where: { orgId },
      create: {
        orgId,
        ...base,
        ...autoSync,
        jiraApiToken: jira === undefined ? null : jira,
        tempoApiToken: tempo === undefined ? null : tempo,
      },
      update: {
        ...base,
        ...autoSync,
        ...(jira !== undefined ? { jiraApiToken: jira } : {}),
        ...(tempo !== undefined ? { tempoApiToken: tempo } : {}),
      },
    });
    return this.getConnection(orgId);
  },

  /**
   * Re-resolve every stored worklog through the current mappings, on demand.
   * The same pass runs automatically after mapping edits and at the end of
   * each sync, but the explicit lever matters when history predates those
   * hooks (e.g. projects classified before this feature deployed) or when a
   * broken sync keeps the automatic pass from running.
   */
  async restampAll(orgId: string) {
    const restamped = await restampWorklogs(orgId);
    return { restamped };
  },

  // --- Work items (Jira hierarchy → our customers/projects) ---
  async listWorkItems(orgId: string) {
    const items = await prisma.jiraWorkItem.findMany({
      where: { orgId },
      orderBy: [{ kind: 'asc' }, { externalKey: 'asc' }],
      select: {
        id: true, kind: true, workType: true, customerFromField: true, externalKey: true, name: true, parentId: true,
        customerId: true, projectId: true,
        customer: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });
    return items;
  },

  async createWorkItem(
    orgId: string,
    data: { kind: string; workType?: string; externalKey: string; name: string; parentId?: string | null; customerId?: string | null; projectId?: string | null }
  ) {
    const workType = data.workType ?? 'client';
    // Internal/absence items classify hours org-wide — a customer/project
    // target alongside them is a contradiction.
    if (workType !== 'client' && (data.customerId || data.projectId)) {
      throw new BadRequestError('Internal/absence items cannot also map to a customer or project');
    }
    await ensureCustomerOrProject(orgId, data.customerId, data.projectId);
    if (data.parentId) {
      const parent = await prisma.jiraWorkItem.findFirst({ where: { id: data.parentId, orgId }, select: { id: true } });
      if (!parent) throw new NotFoundError('Parent work item not found');
    }
    try {
      await prisma.jiraWorkItem.create({
        data: {
          orgId,
          kind: data.kind,
          workType,
          externalKey: data.externalKey.trim(),
          name: data.name.trim(),
          parentId: data.parentId ?? null,
          customerId: data.customerId ?? null,
          projectId: data.projectId ?? null,
        },
      });
    } catch (e) {
      throw new ConflictError('A work item with that key already exists');
    }
    // Attribution may have changed for already-synced hours under this key.
    await restampWorklogs(orgId);
    return this.listWorkItems(orgId);
  },

  async updateWorkItem(
    orgId: string,
    id: string,
    data: { kind?: string; workType?: string; customerFromField?: boolean; externalKey?: string; name?: string; parentId?: string | null; customerId?: string | null; projectId?: string | null }
  ) {
    const item = await prisma.jiraWorkItem.findFirst({ where: { id, orgId } });
    if (!item) throw new NotFoundError('Work item not found');
    if (data.customerFromField && (data.kind ?? item.kind) !== 'project') {
      throw new BadRequestError('Only a Jira project can take its customer from the customer field');
    }

    // Resolve the effective state so the invariants hold on partial updates too:
    // at most one of customer/project, and never a customer/project on an
    // internal/absence bucket.
    const nextWorkType = data.workType !== undefined ? data.workType : item.workType;
    let nextCustomer = data.customerId !== undefined ? data.customerId : item.customerId;
    let nextProject = data.projectId !== undefined ? data.projectId : item.projectId;
    if (nextWorkType !== 'client') {
      if (data.customerId || data.projectId) {
        throw new BadRequestError('Internal/absence items cannot also map to a customer or project');
      }
      // Reclassifying clears any previous customer/project mapping.
      nextCustomer = null;
      nextProject = null;
    }
    // Assigning a customer/project makes it client work again.
    const effectiveWorkType = nextCustomer || nextProject ? 'client' : nextWorkType;
    await ensureCustomerOrProject(orgId, nextCustomer, nextProject);

    if (data.parentId) await assertNoCycle(orgId, id, data.parentId);

    try {
      await prisma.jiraWorkItem.update({
        where: { id },
        data: {
          kind: data.kind ?? undefined,
          workType: effectiveWorkType,
          customerFromField: data.customerFromField ?? undefined,
          externalKey: data.externalKey?.trim() ?? undefined,
          name: data.name?.trim() ?? undefined,
          parentId: data.parentId !== undefined ? data.parentId : undefined,
          customerId: nextCustomer,
          projectId: nextProject,
        },
      });
    } catch (e) {
      throw new ConflictError('A work item with that key already exists');
    }
    // Newly flagged delivery space: read the customer field on its synced
    // hours now. Best effort — if Jira is unreachable the next sync does it.
    if (data.customerFromField && !item.customerFromField) {
      const conn = await this.getSecrets(orgId);
      if (conn?.customerFieldId && conn.jiraApiToken) {
        try { await backfillCustomerOrgs(orgId, conn); } catch { /* next sync */ }
      }
    }
    // Apply the new mapping/classification to already-synced hours immediately
    // — a delta sync would never re-pull them, so the stamped attribution
    // would otherwise stay stale forever.
    await restampWorklogs(orgId);
    return this.listWorkItems(orgId);
  },

  // --- Customer field (shared delivery spaces) ---

  /** Custom Jira issue fields, for picking the customer field. */
  async listJiraFields(orgId: string) {
    const conn = await this.getSecrets(orgId);
    assertJiraReady(conn);
    return callJira(() => jiraClient.fetchFields(conn!));
  },

  /**
   * Set (or clear, with a null id) the Jira field that names the client on
   * shared delivery spaces. A different field makes every stored value stale,
   * so they're dropped and re-read right away (best effort — the next sync
   * finishes the job if Jira is unreachable), then history is restamped.
   */
  async setCustomerField(orgId: string, data: { fieldId: string | null; fieldName?: string | null }) {
    const existing = await prisma.jiraConnection.findUnique({ where: { orgId }, select: { customerFieldId: true } });
    if (!existing) throw new BadRequestError('Save the Jira connection first');
    const fieldId = data.fieldId?.trim() || null;
    await prisma.jiraConnection.update({
      where: { orgId },
      data: { customerFieldId: fieldId, customerFieldName: fieldId ? data.fieldName?.trim() || fieldId : null },
    });
    let backfillError: string | null = null;
    if (fieldId !== existing.customerFieldId) {
      await prisma.worklog.updateMany({ where: { orgId, jiraCustomerOrg: { not: null } }, data: { jiraCustomerOrg: null } });
      const conn = await this.getSecrets(orgId);
      if (fieldId && conn?.jiraApiToken) {
        try { await backfillCustomerOrgs(orgId, conn); } catch (e) { backfillError = (e as Error).message || 'Jira lookup failed'; }
      }
      await restampWorklogs(orgId);
    }
    return { ...(await this.getConnection(orgId)), backfillError };
  },

  async deleteWorkItem(orgId: string, id: string) {
    const item = await prisma.jiraWorkItem.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!item) throw new NotFoundError('Work item not found');
    await prisma.jiraWorkItem.delete({ where: { id } });
    // Hours attributed through this item fall back to unmapped.
    await restampWorklogs(orgId);
    return this.listWorkItems(orgId);
  },
};
