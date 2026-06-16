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

export const jiraClient = { testConnection, fetchProjects, fetchEpics, fetchAccounts };
