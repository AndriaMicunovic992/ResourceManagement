import { outboundUrlProblem } from '../utils/ssrf.js';

// Minimal Jira REST client for pulling reference data (projects, epics, user
// accounts). Cloud uses Basic auth (email:token); if no email is set we send
// the token as a Bearer, which is how Jira Data Center PATs work — so the same
// client serves both without a schema change.
//
// Network calls here can't be exercised in CI; the parsing/pagination is kept
// pure and is covered by tests against a mock server.

export interface JiraConn {
  baseUrl: string | null;
  jiraEmail: string | null;
  jiraApiToken: string | null;
}

export interface JiraProject { key: string; name: string }
export interface JiraEpic { key: string; name: string; projectKey: string | null }
export interface JiraAccountRow { accountId: string; displayName: string; email: string | null; active: boolean }

export class JiraError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'JiraError';
  }
}

function authHeader(conn: JiraConn): string {
  const token = (conn.jiraApiToken || '').trim();
  const email = (conn.jiraEmail || '').trim();
  if (!token) throw new JiraError('Missing Jira API token');
  if (email) {
    const basic = Buffer.from(`${email}:${token}`).toString('base64');
    return `Basic ${basic}`;
  }
  // No email → treat the token as a bearer (Jira Data Center PAT).
  return `Bearer ${token}`;
}

function baseUrl(conn: JiraConn): string {
  const b = (conn.baseUrl || '').trim().replace(/\/+$/, '');
  if (!b) throw new JiraError('Missing Jira base URL');
  // Defense in depth against SSRF: refuse to fetch internal/reserved addresses
  // even if such a value was stored before validation was added.
  const problem = outboundUrlProblem(b);
  if (problem) throw new JiraError(`Jira base URL ${problem}`);
  return b;
}

async function jiraGet<T>(conn: JiraConn, path: string, query: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(baseUrl(conn) + path);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Authorization: authHeader(conn), Accept: 'application/json' },
    });
  } catch (e) {
    throw new JiraError(`Could not reach Jira at ${conn.baseUrl}`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new JiraError('Jira rejected the credentials (check the email and API token)', res.status);
  }
  if (!res.ok) {
    throw new JiraError(`Jira request failed (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

/** Validate the credentials. Returns the authenticated user. */
export async function testConnection(conn: JiraConn): Promise<{ accountId: string; displayName: string }> {
  const me = await jiraGet<{ accountId: string; displayName: string }>(conn, '/rest/api/3/myself');
  return { accountId: me.accountId, displayName: me.displayName };
}

const MAX_PAGES = 50;

export async function fetchProjects(conn: JiraConn): Promise<JiraProject[]> {
  const out: JiraProject[] = [];
  let startAt = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await jiraGet<{ values: { key: string; name: string }[]; isLast?: boolean; total?: number }>(
      conn, '/rest/api/3/project/search', { startAt, maxResults: 50 }
    );
    for (const p of data.values || []) out.push({ key: p.key, name: p.name });
    if (data.isLast || !data.values || data.values.length === 0) break;
    startAt += data.values.length;
    if (data.total !== undefined && startAt >= data.total) break;
  }
  return out;
}

type IssueRow = { key: string; fields?: { summary?: string; project?: { key?: string } } };
const EPIC_JQL = 'issuetype = Epic order by created ASC';
const toEpic = (i: IssueRow): JiraEpic => ({ key: i.key, name: i.fields?.summary || i.key, projectKey: i.fields?.project?.key ?? null });

// Jira Cloud's enhanced search: token-paginated, no startAt/total. Replaces the
// classic /rest/api/3/search, which Atlassian retired (it now returns 410).
async function fetchEpicsJql(conn: JiraConn): Promise<JiraEpic[]> {
  const out: JiraEpic[] = [];
  let nextPageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const q: Record<string, string | number> = { jql: EPIC_JQL, fields: 'summary,project', maxResults: 100 };
    if (nextPageToken) q.nextPageToken = nextPageToken;
    const data = await jiraGet<{ issues?: IssueRow[]; nextPageToken?: string; isLast?: boolean }>(conn, '/rest/api/3/search/jql', q);
    for (const i of data.issues || []) out.push(toEpic(i));
    if (data.isLast || !data.nextPageToken || !(data.issues || []).length) break;
    nextPageToken = data.nextPageToken;
  }
  return out;
}

// Classic startAt/total search — Jira Data Center, which has no /search/jql.
async function fetchEpicsLegacy(conn: JiraConn): Promise<JiraEpic[]> {
  const out: JiraEpic[] = [];
  let startAt = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await jiraGet<{ issues?: IssueRow[]; total?: number }>(
      conn, '/rest/api/3/search', { jql: EPIC_JQL, fields: 'summary,project', startAt, maxResults: 50 }
    );
    for (const i of data.issues || []) out.push(toEpic(i));
    startAt += (data.issues || []).length;
    if (!data.issues || data.issues.length === 0 || startAt >= (data.total ?? 0)) break;
  }
  return out;
}

export async function fetchEpics(conn: JiraConn): Promise<JiraEpic[]> {
  try {
    return await fetchEpicsJql(conn);
  } catch (e) {
    // Data Center doesn't have /search/jql (404) — fall back to classic search.
    if (e instanceof JiraError && e.status === 404) return fetchEpicsLegacy(conn);
    throw e;
  }
}

export async function fetchAccounts(conn: JiraConn): Promise<JiraAccountRow[]> {
  const out: JiraAccountRow[] = [];
  let startAt = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await jiraGet<{ accountId: string; displayName: string; emailAddress?: string; active?: boolean; accountType?: string }[]>(
      conn, '/rest/api/3/users/search', { startAt, maxResults: 50 }
    );
    if (!Array.isArray(data) || data.length === 0) break;
    for (const u of data) {
      // Only real people (Jira returns app/customer accounts too).
      if (u.accountType && u.accountType !== 'atlassian') continue;
      out.push({ accountId: u.accountId, displayName: u.displayName, email: u.emailAddress ?? null, active: u.active ?? true });
    }
    startAt += data.length;
    if (data.length < 50) break;
  }
  return out;
}

export interface JiraIssueRef {
  id: string;
  key: string;
  projectKey: string | null;
  epicKey: string | null;
  // The customer-field value: null when no field was requested, "" when the
  // issue has none.
  customerOrg: string | null;
}

type IssueDetail = {
  id: string;
  key: string;
  fields?: { project?: { key?: string }; issuetype?: { name?: string }; parent?: { key?: string; fields?: { issuetype?: { name?: string } } } } & Record<string, unknown>;
};

/**
 * The display labels of a Jira field value, whatever its shape: plain text,
 * a select option ({ value }), a Service Management organization or user
 * ({ name } / { displayName }), or an array of any of those (multi-selects,
 * the JSM "Organizations" field). Unreadable shapes (rich text) yield none.
 */
export function fieldLabels(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === 'string') return v.trim() ? [v.trim()] : [];
  if (typeof v === 'number') return [String(v)];
  if (Array.isArray(v)) return v.flatMap(fieldLabels);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['name', 'value', 'displayName']) {
      if (typeof o[k] === 'string' && (o[k] as string).trim()) return [(o[k] as string).trim()];
    }
  }
  return [];
}

// One value per issue: the first label (a request rarely belongs to several
// organizations; when it does, the first one listed wins).
export const customerOrgOf = (v: unknown): string => fieldLabels(v)[0] ?? '';

function toIssueRef(i: IssueDetail, customerFieldId?: string | null): JiraIssueRef {
  const itype = i.fields?.issuetype?.name;
  const parent = i.fields?.parent;
  const parentIsEpic = parent?.fields?.issuetype?.name === 'Epic';
  // The epic a worklog rolls up to: the issue itself if it's an epic, else its
  // parent epic (one level up). Deeper nesting falls back to project level.
  const epicKey = itype === 'Epic' ? i.key : parentIsEpic ? parent?.key ?? null : null;
  return {
    id: String(i.id),
    key: i.key,
    projectKey: i.fields?.project?.key ?? null,
    epicKey,
    customerOrg: customerFieldId ? customerOrgOf(i.fields?.[customerFieldId]) : null,
  };
}

// Page a JQL search (Cloud /search/jql, falling back to the classic search on
// Data Center) and hand each page's issues to `onIssues`.
async function searchIssues(conn: JiraConn, jql: string, fields: string, onIssues: (issues: IssueDetail[]) => void) {
  let nextPageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const q: Record<string, string | number> = { jql, fields, maxResults: 100 };
    if (nextPageToken) q.nextPageToken = nextPageToken;
    let data: { issues?: IssueDetail[]; nextPageToken?: string; isLast?: boolean };
    try {
      data = await jiraGet(conn, '/rest/api/3/search/jql', q);
    } catch (e) {
      if (e instanceof JiraError && e.status === 404) {
        // Data Center: classic search.
        const legacy = await jiraGet<{ issues?: IssueDetail[] }>(conn, '/rest/api/3/search', { jql, fields, startAt: 0, maxResults: 100 });
        onIssues(legacy.issues || []);
        return;
      }
      throw e;
    }
    onIssues(data.issues || []);
    if (data.isLast || !data.nextPageToken || !(data.issues || []).length) break;
    nextPageToken = data.nextPageToken;
  }
}

/**
 * Resolve a set of Jira issue ids to their project + epic (for Tempo rollup),
 * plus the customer-field value when a field id is given.
 */
export async function fetchIssues(conn: JiraConn, issueIds: string[], customerFieldId?: string | null): Promise<JiraIssueRef[]> {
  const ids = [...new Set(issueIds.filter(Boolean))];
  const fields = ['project', 'issuetype', 'parent', ...(customerFieldId ? [customerFieldId] : [])].join(',');
  const out: JiraIssueRef[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const jql = `id in (${ids.slice(i, i + 50).join(',')})`;
    await searchIssues(conn, jql, fields, (issues) => { for (const it of issues) out.push(toIssueRef(it, customerFieldId)); });
  }
  return out;
}

/**
 * The customer-field value of each given issue key ("" when empty) — the
 * backfill for worklogs synced before the field was configured. A batch
 * naming a deleted issue fails JQL as a whole (400), so that batch falls back
 * to one lookup per issue; a missing issue reads as empty.
 */
export async function fetchIssueFieldValues(conn: JiraConn, issueKeys: string[], fieldId: string): Promise<Map<string, string>> {
  const keys = [...new Set(issueKeys.filter(Boolean))];
  const out = new Map<string, string>();
  for (let i = 0; i < keys.length; i += 50) {
    const batch = keys.slice(i, i + 50);
    try {
      await searchIssues(conn, `key in (${batch.join(',')})`, fieldId, (issues) => {
        for (const it of issues) out.set(it.key, customerOrgOf(it.fields?.[fieldId]));
      });
    } catch (e) {
      if (!(e instanceof JiraError) || e.status !== 400) throw e;
      for (const key of batch) {
        try {
          const it = await jiraGet<IssueDetail>(conn, `/rest/api/3/issue/${encodeURIComponent(key)}`, { fields: fieldId });
          out.set(key, customerOrgOf(it.fields?.[fieldId]));
        } catch (e2) {
          if (!(e2 instanceof JiraError) || e2.status !== 404) throw e2;
        }
      }
    }
    // Keys Jira didn't return (deleted, no access) read as empty so they
    // aren't looked up again on every sync.
    for (const key of batch) if (!out.has(key)) out.set(key, '');
  }
  return out;
}

export interface JiraField { id: string; name: string }

/** Custom issue fields — the picker for the customer field. */
export async function fetchFields(conn: JiraConn): Promise<JiraField[]> {
  const data = await jiraGet<{ id: string; name: string; custom?: boolean }[]>(conn, '/rest/api/3/field');
  return (Array.isArray(data) ? data : [])
    .filter((f) => f.custom)
    .map((f) => ({ id: f.id, name: f.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const jiraClient = { testConnection, fetchProjects, fetchEpics, fetchAccounts, fetchIssues, fetchIssueFieldValues, fetchFields };
