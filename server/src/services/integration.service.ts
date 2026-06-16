import { prisma } from '../db/prisma.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';
import { jiraClient, JiraError } from './jiraClient.js';
import type { JiraProject, JiraEpic, JiraAccountRow } from './jiraClient.js';

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
} | null) {
  return {
    baseUrl: c?.baseUrl ?? '',
    jiraEmail: c?.jiraEmail ?? '',
    enabled: c?.enabled ?? false,
    jiraApiTokenSet: !!c?.jiraApiToken,
    tempoApiTokenSet: !!c?.tempoApiToken,
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
    return applyPulled(orgId, { projects, epics, accounts });
  },

  async listAccounts(orgId: string) {
    return prisma.jiraAccount.findMany({
      where: { orgId },
      orderBy: { displayName: 'asc' },
      select: { id: true, accountId: true, displayName: true, email: true, active: true },
    });
  },

  /**
   * Map one of OUR entities (a customer or project) to a Jira work item, from
   * the our-entity side. Enforces one Jira item per entity and one entity per
   * item. Pass workItemId = null to clear the mapping.
   */
  async mapEntityToWorkItem(
    orgId: string,
    target: { customerId?: string | null; projectId?: string | null },
    workItemId: string | null
  ) {
    const isCustomer = !!target.customerId;
    const entityId = target.customerId || target.projectId;
    if (!entityId) throw new BadRequestError('A customer or project is required');
    if (isCustomer) {
      const c = await prisma.customer.findFirst({ where: { id: entityId, orgId }, select: { id: true } });
      if (!c) throw new NotFoundError('Customer not found');
    } else {
      const p = await prisma.project.findFirst({ where: { id: entityId, orgId }, select: { id: true } });
      if (!p) throw new NotFoundError('Project not found');
    }
    const field = isCustomer ? 'customerId' : 'projectId';
    // Clear whatever item currently points at this entity.
    await prisma.jiraWorkItem.updateMany({ where: { orgId, [field]: entityId }, data: { [field]: null } });
    if (workItemId) {
      const item = await prisma.jiraWorkItem.findFirst({ where: { id: workItemId, orgId }, select: { id: true } });
      if (!item) throw new NotFoundError('Work item not found');
      // A work item maps to one of ours — set the chosen side, clear the other.
      await prisma.jiraWorkItem.update({
        where: { id: workItemId },
        data: { customerId: target.customerId ?? null, projectId: target.projectId ?? null },
      });
    }
    return this.listWorkItems(orgId);
  },

  async saveConnection(orgId: string, data: ConnectionInput) {
    const jira = tokenPatch(data.jiraApiToken);
    const tempo = tokenPatch(data.tempoApiToken);
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
        jiraApiToken: jira === undefined ? null : jira,
        tempoApiToken: tempo === undefined ? null : tempo,
      },
      update: {
        ...base,
        ...(jira !== undefined ? { jiraApiToken: jira } : {}),
        ...(tempo !== undefined ? { tempoApiToken: tempo } : {}),
      },
    });
    return this.getConnection(orgId);
  },

  // --- Work items (Jira hierarchy → our customers/projects) ---
  async listWorkItems(orgId: string) {
    const items = await prisma.jiraWorkItem.findMany({
      where: { orgId },
      orderBy: [{ kind: 'asc' }, { externalKey: 'asc' }],
      select: {
        id: true, kind: true, externalKey: true, name: true, parentId: true,
        customerId: true, projectId: true,
        customer: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });
    return items;
  },

  async createWorkItem(
    orgId: string,
    data: { kind: string; externalKey: string; name: string; parentId?: string | null; customerId?: string | null; projectId?: string | null }
  ) {
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
    return this.listWorkItems(orgId);
  },

  async updateWorkItem(
    orgId: string,
    id: string,
    data: { kind?: string; externalKey?: string; name?: string; parentId?: string | null; customerId?: string | null; projectId?: string | null }
  ) {
    const item = await prisma.jiraWorkItem.findFirst({ where: { id, orgId } });
    if (!item) throw new NotFoundError('Work item not found');

    // Resolve the effective mapping so "set both" is rejected even on partial updates.
    const nextCustomer = data.customerId !== undefined ? data.customerId : item.customerId;
    const nextProject = data.projectId !== undefined ? data.projectId : item.projectId;
    await ensureCustomerOrProject(orgId, nextCustomer, nextProject);

    if (data.parentId) await assertNoCycle(orgId, id, data.parentId);

    try {
      await prisma.jiraWorkItem.update({
        where: { id },
        data: {
          kind: data.kind ?? undefined,
          externalKey: data.externalKey?.trim() ?? undefined,
          name: data.name?.trim() ?? undefined,
          parentId: data.parentId !== undefined ? data.parentId : undefined,
          customerId: data.customerId !== undefined ? data.customerId : undefined,
          projectId: data.projectId !== undefined ? data.projectId : undefined,
        },
      });
    } catch (e) {
      throw new ConflictError('A work item with that key already exists');
    }
    return this.listWorkItems(orgId);
  },

  async deleteWorkItem(orgId: string, id: string) {
    const item = await prisma.jiraWorkItem.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!item) throw new NotFoundError('Work item not found');
    await prisma.jiraWorkItem.delete({ where: { id } });
    return this.listWorkItems(orgId);
  },
};
