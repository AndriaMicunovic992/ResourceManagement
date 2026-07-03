import { createRemoteJWKSet, jwtVerify } from 'jose';
import { prisma } from '../db/prisma.js';
import { decryptSecret } from '../utils/crypto.js';
import { BadRequestError } from '../utils/errors.js';
import { formatDigest, type ReminderLike } from './teamsReminders.helpers.js';

// ---------------------------------------------------------------------------
// Bot Framework transport (hand-rolled — no botbuilder SDK). Off-Azure-friendly:
// outbound auth uses the org's client secret; inbound activities are verified
// with `jose` against the Bot Framework signing keys.
// ---------------------------------------------------------------------------

type TeamsConnectionRow = {
  appType: string;
  botAppId: string | null;
  botAppPassword: string | null;
  tenantId: string | null;
};

/** Client-credentials app token for calling the Bot Connector. */
async function getBotToken(c: TeamsConnectionRow): Promise<string> {
  if (c.appType === 'UserAssignedMSI') {
    throw new BadRequestError(
      'This bot uses a managed identity, which only works when the server runs in Azure. Switch it to a client secret to send from here.'
    );
  }
  const secret = c.botAppPassword ? decryptSecret(c.botAppPassword) : null;
  if (!c.botAppId || !secret) throw new BadRequestError('The Teams bot connection is not fully configured.');
  const tenant = c.appType === 'SingleTenant' ? c.tenantId : 'botframework.com';
  if (!tenant) throw new BadRequestError('The single-tenant bot needs a tenant (directory) ID.');

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: c.botAppId,
    client_secret: secret,
    scope: 'https://api.botframework.com/.default',
  });
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new BadRequestError('Could not get a bot token from Microsoft — re-check the credentials.');
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new BadRequestError('Microsoft did not return a bot token.');
  return j.access_token;
}

// Bot Framework channel→bot signing keys (public cloud). Cached across requests.
const BF_OPENID = 'https://login.botframework.com/v1/.well-known/openidconfiguration';
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
async function botJwks() {
  if (!jwks) {
    const cfg = (await (await fetch(BF_OPENID)).json()) as { jwks_uri: string };
    jwks = createRemoteJWKSet(new URL(cfg.jwks_uri));
  }
  return jwks;
}

/** Verify an inbound activity's bearer token was issued by the Bot Connector for our bot. */
async function verifyInbound(authHeader: string | undefined, botAppId: string): Promise<void> {
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('missing bot token');
  await jwtVerify(token, await botJwks(), {
    issuer: 'https://api.botframework.com',
    audience: botAppId,
  });
}

// A Teams bot id arrives as "28:<appId>"; the app registration id is the suffix.
const botAppIdOf = (recipientId: string | undefined) => (recipientId || '').replace(/^28:/, '');

type Activity = {
  type?: string;
  serviceUrl?: string;
  conversation?: { id?: string };
  from?: { id?: string; name?: string; aadObjectId?: string };
  recipient?: { id?: string };
  membersAdded?: Array<{ id?: string; aadObjectId?: string }>;
};

type CaptureResult = 'linked' | 'unmatched' | 'skipped';

/** Persist a user's conversation reference so we can DM them later. */
async function captureConversation(activity: Activity): Promise<CaptureResult> {
  const serviceUrl = activity.serviceUrl;
  const conversationId = activity.conversation?.id;
  if (!serviceUrl || !conversationId) return 'skipped';
  const botId = activity.recipient?.id;
  // The user's Entra object id is usually on `from`, but on the silent install
  // event (the bot being added) it can ride on the added member instead.
  const aadObjectId =
    activity.from?.aadObjectId ||
    activity.membersAdded?.find((m) => m.aadObjectId && m.id !== botId)?.aadObjectId;
  if (!aadObjectId) return 'skipped';
  // We can only reach people whose account is linked via Entra (SSO) — that's
  // how we map the Teams user (aadObjectId) to our User (microsoftId).
  const user = await prisma.user.findUnique({ where: { microsoftId: aadObjectId } });
  if (!user) return 'unmatched';

  const conversationRef = {
    serviceUrl,
    conversationId,
    botId: botId ?? null,
    userId: activity.from?.id ?? null,
    userName: activity.from?.name ?? null,
  };
  await prisma.teamsUserLink.upsert({
    where: { userId: user.id },
    create: { userId: user.id, aadObjectId, serviceUrl, conversationRef },
    update: { aadObjectId, serviceUrl, conversationRef },
  });
  return 'linked';
}

/** Bot → user reply in the same conversation (uses the inbound serviceUrl). */
async function sendReply(
  conn: TeamsConnectionRow,
  serviceUrl: string,
  conversationId: string,
  text: string
): Promise<void> {
  const token = await getBotToken(conn);
  const url = `${serviceUrl.replace(/\/$/, '')}/v3/conversations/${encodeURIComponent(conversationId)}/activities`;
  await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'message', text }),
  });
}

/**
 * Handle an inbound Bot Framework activity (the /api/teams/messages endpoint).
 * Verifies the token, then captures the conversation reference. Returns whether
 * the token was valid so the route can answer 200 vs 401.
 */
export async function handleInboundActivity(body: unknown, authHeader: string | undefined): Promise<boolean> {
  const activity = (body ?? {}) as Activity;
  const botAppId = botAppIdOf(activity?.recipient?.id);
  if (!botAppId) return false;
  // Only accept activities for a bot we actually know. Case-insensitive so a
  // differently-cased stored App ID still matches the recipient.
  const conn = await prisma.teamsConnection.findFirst({
    where: { botAppId: { equals: botAppId, mode: 'insensitive' } },
  });
  if (!conn) return false;

  await verifyInbound(authHeader, botAppId); // throws on an invalid token

  // Capture on any activity that carries a user + conversation — including the
  // silent conversationUpdate / installationUpdate fired when the app is installed
  // for someone, so people never have to message the bot first.
  let result: CaptureResult = 'skipped';
  try {
    result = await captureConversation(activity);
  } catch {
    /* non-fatal — the token was already valid */
  }

  // For a direct message, answer with the outcome. Getting *any* reply proves the
  // messaging endpoint + auth are working; the text says whether we could link
  // the person — turning "say hi" into a one-glance diagnostic.
  if (activity.type === 'message' && activity.serviceUrl && activity.conversation?.id) {
    const text =
      result === 'linked'
        ? '✅ You’re connected — databob reminders will arrive here.'
        : result === 'unmatched'
        ? '⚠️ I got your message, but couldn’t match you to a databob account. Sign in to databob with this same Microsoft account, then message me again.'
        : '⚠️ I got your message, but couldn’t read your Teams identity from Teams.';
    try {
      await sendReply(conn, activity.serviceUrl, activity.conversation.id, text);
    } catch {
      /* non-fatal */
    }
  }
  return true;
}

const DEFAULT_INTRO = 'Here are your open items in databob:';

/** Compose the DM body: the org's intro line (or the default) + the digest. */
export function buildReminderText(intro: string | null | undefined, reminders: ReminderLike[]): string {
  const head = intro && intro.trim() ? intro.trim() : DEFAULT_INTRO;
  const body = formatDigest(reminders);
  return body ? `${head}\n\n${body}` : head;
}

/** Send a proactive DM to a person via their stored Teams conversation. */
export async function sendProactiveMessage(orgId: string, userId: string, text: string) {
  const conn = await prisma.teamsConnection.findUnique({ where: { orgId } });
  if (!conn?.botAppId) throw new BadRequestError('Set up the Teams bot connection first.');
  const link = await prisma.teamsUserLink.findUnique({ where: { userId } });
  if (!link) {
    throw new BadRequestError(
      'No Teams conversation for this person yet. They need to open the bot in Teams once (say "hi") so we can reach them.'
    );
  }
  const ref = link.conversationRef as unknown as {
    serviceUrl: string;
    conversationId: string;
    botId?: string | null;
    userId?: string | null;
  };
  const token = await getBotToken(conn);
  const url = `${ref.serviceUrl.replace(/\/$/, '')}/v3/conversations/${encodeURIComponent(ref.conversationId)}/activities`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'message',
      text,
      ...(ref.botId ? { from: { id: ref.botId } } : {}),
      ...(ref.userId ? { recipient: { id: ref.userId } } : {}),
      conversation: { id: ref.conversationId },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new BadRequestError(`Teams rejected the message (HTTP ${res.status}). ${detail.slice(0, 200)}`);
  }
  return { ok: true };
}

/** Send a labelled test DM to the given user, using the org's configured intro. */
export async function sendTestMessage(orgId: string, userId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { teamsReminderMessage: true },
  });
  const sample: ReminderLike[] = [
    { type: 'oneOnOne', resourceName: 'Sample Person' },
    { type: 'pmUpdate', resourceName: 'Sample Person', customerName: 'Sample Customer' },
  ];
  const text = `✅ Test message from databob.\n\n${buildReminderText(org?.teamsReminderMessage, sample)}`;
  return sendProactiveMessage(orgId, userId, text);
}
