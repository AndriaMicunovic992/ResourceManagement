import { prisma } from '../db/prisma.js';
import { BadRequestError } from '../utils/errors.js';
import { config } from '../config.js';
import { inviteService } from './invite.service.js';
import {
  getGraphToken,
  findCatalogAppId,
  findTenantUserByEmail,
  installAndOpen,
} from './teamsGraph.js';
import { sendProactiveMessage } from './teamsTransport.js';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Absolute URL of the app for the sign-in link in the welcome DM. Prefers
 * CLIENT_URL; falls back to the origin of the Entra redirect URI, which is
 * always set when Microsoft sign-in (and therefore this feature) is configured.
 */
function signInUrl(): string {
  if (config.clientUrl) return config.clientUrl.replace(/\/$/, '');
  const redirect = config.entra.redirectUri;
  if (redirect) {
    try {
      return new URL(redirect).origin;
    } catch {
      /* ignore a malformed redirect URI */
    }
  }
  return '';
}

function welcomeText(orgName: string): string {
  const url = signInUrl();
  const link = url ? `\n\nSign in to get started: ${url}` : '';
  return (
    `👋 You've been invited to **${orgName}** on databob.${link}` +
    `\n\nUse **Sign in with Microsoft** — the same account you use for Teams. ` +
    `Your reminders and updates will arrive right here once you're in.`
  );
}

/**
 * Find or lazily create the local User for a verified tenant identity so the bot
 * can link the conversation (captureConversation matches on microsoftId). Mirrors
 * microsoftService.resolveUser, but admin-initiated rather than invite-gated —
 * we've just created the invite ourselves.
 */
async function ensureMatchableUser(email: string, aadId: string, displayName: string) {
  const byOid = await prisma.user.findUnique({ where: { microsoftId: aadId } });
  if (byOid) return byOid;
  const byEmail = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (byEmail) {
    // Attach the Microsoft identity only if the account doesn't already have one.
    if (!byEmail.microsoftId) {
      return prisma.user.update({ where: { id: byEmail.id }, data: { microsoftId: aadId } });
    }
    return byEmail;
  }
  return prisma.user.create({
    data: { email, name: displayName || email, microsoftId: aadId, authProvider: 'microsoft' },
  });
}

export interface InviteOverTeamsResult {
  status: 'invited' | 'already_member';
  microsoftName: string;
  installed: 'installed' | 'already';
  welcomed: boolean;
}

/**
 * Onboard a person over Teams: create the pending invite, resolve them in the
 * Entra tenant, install the databob bot for them, and DM them a sign-in link.
 * The DM relies on the bot's install event registering the conversation, so we
 * briefly wait for that link before sending (or send immediately if they were
 * already connected). Idempotent — safe to run again.
 */
export async function inviteOverTeams(
  orgId: string,
  email: string,
  role: string,
  invitedByUserId: string
): Promise<InviteOverTeamsResult> {
  const normalized = email.trim().toLowerCase();
  const conn = await prisma.teamsConnection.findUnique({ where: { orgId } });
  if (!conn?.botAppId) throw new BadRequestError('Set up the Teams bot connection first.');
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  // Already a member? There's no seat to grant — but we can still (re)send the
  // Teams ping, so we skip the invite and continue.
  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    select: { memberships: { where: { orgId }, select: { id: true } } },
  });
  const alreadyMember = !!existing && existing.memberships.length > 0;
  if (!alreadyMember) await inviteService.create(orgId, normalized, role, invitedByUserId);

  const token = await getGraphToken(conn);
  const entra = await findTenantUserByEmail(token, normalized);
  if (!entra) {
    throw new BadRequestError(
      `No Microsoft account found for ${normalized} in your tenant. Double-check the address, or add them from the Members list instead.`
    );
  }

  const user = await ensureMatchableUser(normalized, entra.aadId, entra.displayName);
  // Snapshot before the install: an existing link means we can DM immediately;
  // otherwise we wait for the install event to register a fresh one.
  const hadLink = !!(await prisma.teamsUserLink.findFirst({
    where: { userId: user.id, OR: [{ orgId }, { orgId: null }] },
    select: { id: true },
  }));

  const catalogAppId = await findCatalogAppId(token, conn.botAppId);
  const { status: installed } = await installAndOpen(token, catalogAppId, conn.botAppId, entra.aadId);

  const text = welcomeText(org?.name || 'your team');
  let welcomed = false;
  try {
    if (hadLink) {
      await sendProactiveMessage(orgId, user.id, text);
      welcomed = true;
    } else {
      // The install event lands on our webhook (same process) within a couple of
      // seconds; poll for the captured conversation, then DM.
      for (let i = 0; i < 6 && !welcomed; i++) {
        await sleep(1000);
        const link = await prisma.teamsUserLink.findFirst({
          where: { userId: user.id, OR: [{ orgId }, { orgId: null }] },
          select: { id: true },
        });
        if (link) {
          await sendProactiveMessage(orgId, user.id, text);
          welcomed = true;
        }
      }
    }
  } catch {
    // Non-fatal: the app is installed and the invite exists; the welcome can be
    // re-sent, and reminders will reach them once the conversation registers.
    welcomed = false;
  }

  return {
    status: alreadyMember ? 'already_member' : 'invited',
    microsoftName: entra.displayName,
    installed,
    welcomed,
  };
}
