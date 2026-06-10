import { createRemoteJWKSet, jwtVerify } from 'jose';
import crypto from 'crypto';
import { prisma } from '../db/prisma.js';
import { config } from '../config.js';
import { inviteService } from './invite.service.js';
import { BadRequestError, ForbiddenError } from '../utils/errors.js';

// Transient login transactions (CSRF `state` → expected `nonce`). In-memory is
// fine for a single-instance deployment; entries expire after 10 minutes. Move
// to a shared store (Redis/cookie) if the API is ever horizontally scaled.
const STATE_TTL_MS = 10 * 60 * 1000;
const pending = new Map<string, { nonce: string; createdAt: number }>();

function sweep() {
  const now = Date.now();
  for (const [k, v] of pending) {
    if (now - v.createdAt > STATE_TTL_MS) pending.delete(k);
  }
}

function authority(): string {
  return `https://login.microsoftonline.com/${config.entra.tenantId}`;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${authority()}/discovery/v2.0/keys`));
  }
  return jwks;
}

export const microsoftService = {
  isEnabled(): boolean {
    return config.entra.enabled;
  },

  /** Build the Entra authorize URL and remember the state/nonce we expect back. */
  beginLogin(): string {
    if (!this.isEnabled()) throw new BadRequestError('Microsoft sign-in is not configured');
    sweep();
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    pending.set(state, { nonce, createdAt: Date.now() });

    const params = new URLSearchParams({
      client_id: config.entra.clientId!,
      response_type: 'code',
      redirect_uri: config.entra.redirectUri!,
      response_mode: 'query',
      scope: 'openid profile email',
      state,
      nonce,
    });
    return `${authority()}/oauth2/v2.0/authorize?${params.toString()}`;
  },

  /**
   * Validate the callback, verify the ID token, provision the user (invite-first),
   * and resolve the org to sign them into. Returns the identity the route will
   * mint an internal JWT for. Throws on any failure.
   */
  async completeLogin(code: string | undefined, state: string | undefined): Promise<{ userId: string; orgId: string }> {
    if (!this.isEnabled()) throw new BadRequestError('Microsoft sign-in is not configured');
    if (!code || !state) throw new BadRequestError('Missing code or state');

    const expected = pending.get(state);
    pending.delete(state);
    if (!expected) throw new BadRequestError('Invalid or expired sign-in state');

    // Exchange the auth code for tokens (confidential client, secret-authenticated).
    const tokenRes = await fetch(`${authority()}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.entra.clientId!,
        client_secret: config.entra.clientSecret!,
        code,
        redirect_uri: config.entra.redirectUri!,
        grant_type: 'authorization_code',
        scope: 'openid profile email',
      }),
    });
    if (!tokenRes.ok) {
      throw new BadRequestError('Token exchange with Microsoft failed');
    }
    const tokens = (await tokenRes.json()) as { id_token?: string };
    if (!tokens.id_token) throw new BadRequestError('No id_token returned by Microsoft');

    // Verify signature, issuer, audience against this tenant.
    const { payload } = await jwtVerify(tokens.id_token, getJwks(), {
      issuer: `${authority()}/v2.0`,
      audience: config.entra.clientId!,
    });
    if (payload.nonce !== expected.nonce) throw new BadRequestError('Nonce mismatch');

    const oid = payload.oid as string | undefined;
    const tid = payload.tid as string | undefined;
    const email = (payload.preferred_username || payload.email) as string | undefined;
    const name = (payload.name as string | undefined) || email || 'Microsoft User';
    if (!oid || !email) throw new BadRequestError('Microsoft token missing required claims');
    // Defense in depth: reject tokens from outside the configured tenant.
    if (tid && tid !== config.entra.tenantId) {
      throw new ForbiddenError('Sign-in is restricted to your organization');
    }

    const userId = await this.resolveUser(oid, email, name);
    await inviteService.consumeForUser(userId, email);

    const membership = await prisma.orgMember.findFirst({
      where: { userId },
      orderBy: { org: { createdAt: 'asc' } },
    });
    if (!membership) {
      // Authenticated with Microsoft, but nobody has invited this person.
      throw new ForbiddenError('no_access');
    }
    return { userId, orgId: membership.orgId };
  },

  /** Find-or-link-or-create the local User for a verified Microsoft identity. */
  async resolveUser(oid: string, email: string, name: string): Promise<string> {
    const byOid = await prisma.user.findUnique({ where: { microsoftId: oid } });
    if (byOid) return byOid.id;

    // Single-tenant + IdP-verified email: linking an existing local account by
    // email is safe here (the email is asserted by our own Entra tenant).
    const byEmail = await prisma.user.findFirst({
      where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' } },
    });
    if (byEmail) {
      await prisma.user.update({ where: { id: byEmail.id }, data: { microsoftId: oid } });
      return byEmail.id;
    }

    const created = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        name,
        microsoftId: oid,
        authProvider: 'microsoft',
        // password stays null — this account signs in via Microsoft only.
      },
    });
    return created.id;
  },
};
