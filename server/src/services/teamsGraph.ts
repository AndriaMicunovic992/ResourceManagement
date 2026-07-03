import { prisma } from '../db/prisma.js';
import { decryptSecret } from '../utils/crypto.js';
import { BadRequestError } from '../utils/errors.js';

// Proactive app install via Microsoft Graph: installs the databob Teams app for
// every SSO user so nobody has to add it or message the bot. Needs, on the bot's
// app registration (with admin consent): TeamsAppInstallation.ReadWriteForUser.All
// and AppCatalog.Read.All.
const GRAPH = 'https://graph.microsoft.com/v1.0';

type Conn = { appType: string; botAppId: string | null; botAppPassword: string | null; tenantId: string | null };

/** App-only Graph token via client credentials (the bot's secret). */
async function getGraphToken(c: Conn): Promise<string> {
  if (c.appType === 'UserAssignedMSI') {
    throw new BadRequestError('A managed-identity bot can only call Graph from inside Azure — use a client-secret bot for auto-install.');
  }
  const secret = c.botAppPassword ? decryptSecret(c.botAppPassword) : null;
  if (!c.botAppId || !secret) throw new BadRequestError('The Teams bot connection is not fully configured.');
  if (!c.tenantId) throw new BadRequestError('Add the tenant (directory) ID to enable auto-install.');

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: c.botAppId,
    client_secret: secret,
    scope: 'https://graph.microsoft.com/.default',
  });
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const d = await res.text().catch(() => '');
    throw new BadRequestError(`Could not get a Microsoft Graph token. ${d.slice(0, 180)}`);
  }
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new BadRequestError('Microsoft did not return a Graph token.');
  return j.access_token;
}

/** The app's catalog id (needed to install it). Matched on externalId = bot App ID. */
async function findCatalogAppId(token: string, botAppId: string): Promise<string> {
  const url = `${GRAPH}/appCatalogs/teamsApps?$filter=externalId eq '${encodeURIComponent(botAppId)}'`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const d = await res.text().catch(() => '');
    throw new BadRequestError(
      `Could not read the Teams app catalog (the bot app likely needs the AppCatalog.Read.All permission with admin consent). ${d.slice(0, 160)}`
    );
  }
  const j = (await res.json()) as { value?: Array<{ id: string }> };
  const app = j.value?.[0];
  if (!app) {
    throw new BadRequestError('The databob app is not in your org app catalog yet — upload it in the Teams admin center first.');
  }
  return app.id;
}

/** Install the app for one user (by Entra object id). Idempotent: 409 = already there. */
async function installForUser(token: string, catalogAppId: string, aadUserId: string): Promise<'installed' | 'already'> {
  const res = await fetch(`${GRAPH}/users/${encodeURIComponent(aadUserId)}/teamwork/installedApps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ 'teamsApp@odata.bind': `${GRAPH}/appCatalogs/teamsApps/${catalogAppId}` }),
  });
  if (res.status === 201) return 'installed';
  if (res.status === 409) return 'already'; // already installed for this user
  const d = await res.text().catch(() => '');
  throw new Error(`HTTP ${res.status} ${d.slice(0, 120)}`);
}

/**
 * Install the app for every org member with a Microsoft-linked account. The
 * install fires the bot's install event, which registers each person's
 * conversation (see teamsTransport.captureConversation) — so DMs work afterwards.
 */
export async function installForAllUsers(orgId: string) {
  const conn = await prisma.teamsConnection.findUnique({ where: { orgId } });
  if (!conn?.botAppId) throw new BadRequestError('Set up the Teams bot connection first.');
  const token = await getGraphToken(conn);
  const catalogAppId = await findCatalogAppId(token, conn.botAppId);

  const members = await prisma.orgMember.findMany({
    where: { orgId },
    include: { user: { select: { microsoftId: true } } },
  });
  // Only Microsoft-linked accounts can be installed for AND later matched.
  const targets = members
    .map((m) => m.user?.microsoftId)
    .filter((id): id is string => !!id);
  const skippedNoMicrosoft = members.length - targets.length;

  let installed = 0;
  let alreadyConnected = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const aadId of targets) {
    try {
      const r = await installForUser(token, catalogAppId, aadId);
      if (r === 'installed') installed++;
      else alreadyConnected++;
    } catch (e) {
      failed++;
      if (errors.length < 3) errors.push((e as Error).message);
    }
  }
  return { total: targets.length, installed, alreadyConnected, failed, skippedNoMicrosoft, errors };
}
