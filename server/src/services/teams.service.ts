import { prisma } from '../db/prisma.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';
import { BadRequestError } from '../utils/errors.js';

// undefined = leave stored value, null/'' = clear, string = set (encrypted).
type SecretInput = string | null | undefined;

interface TeamsConnectionInput {
  botAppId?: string | null;
  tenantId?: string | null;
  botAppPassword?: SecretInput;
}

function secretPatch(value: SecretInput): string | null | undefined {
  if (value === undefined) return undefined; // leave as-is
  if (value === null || value === '') return null; // clear
  return encryptSecret(value); // set (encrypted)
}

/** Never returns the secret — only whether one is stored. */
function maskConnection(
  c: { botAppId: string | null; tenantId: string | null; botAppPassword: string | null } | null
) {
  return {
    botAppId: c?.botAppId ?? '',
    tenantId: c?.tenantId ?? '',
    botAppPasswordSet: !!c?.botAppPassword,
    // The bot can only run once it has both an app id and a secret.
    configured: !!(c?.botAppId && c?.botAppPassword),
  };
}

export const teamsService = {
  async getConnection(orgId: string) {
    const c = await prisma.teamsConnection.findUnique({ where: { orgId } });
    return maskConnection(c);
  },

  async saveConnection(orgId: string, data: TeamsConnectionInput) {
    const secret = secretPatch(data.botAppPassword);
    const base = { botAppId: data.botAppId ?? null, tenantId: data.tenantId ?? null };
    await prisma.teamsConnection.upsert({
      where: { orgId },
      create: { orgId, ...base, botAppPassword: secret === undefined ? null : secret },
      update: { ...base, ...(secret !== undefined ? { botAppPassword: secret } : {}) },
    });
    return this.getConnection(orgId);
  },

  /**
   * Validate the stored bot credentials by requesting an app token from Entra
   * (client-credentials grant for the Bot Framework resource). Confirms the app
   * id / secret / tenant are correct without needing the bot SDK or a live chat.
   */
  async testConnection(orgId: string) {
    const c = await prisma.teamsConnection.findUnique({ where: { orgId } });
    if (!c?.botAppId || !c?.botAppPassword) {
      throw new BadRequestError('Add the bot App ID and app password first.');
    }
    if (!c.tenantId) {
      throw new BadRequestError('Add the tenant (directory) ID — the bot is single-tenant.');
    }
    const secret = decryptSecret(c.botAppPassword);
    if (!secret) throw new BadRequestError('Stored app password could not be read; re-enter it.');

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: c.botAppId,
      client_secret: secret,
      scope: 'https://api.botframework.com/.default',
    });
    const url = `https://login.microsoftonline.com/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/token`;

    let ok = false;
    let detail = '';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      ok = res.ok;
      if (!ok) {
        try {
          const j = (await res.json()) as { error?: string; error_description?: string };
          detail = j.error_description?.split('\n')[0] || j.error || '';
        } catch {
          /* non-JSON error body */
        }
      }
    } catch {
      throw new BadRequestError('Could not reach Microsoft to validate the credentials.');
    }
    if (!ok) throw new BadRequestError(`Azure rejected the credentials${detail ? `: ${detail}` : '.'}`);
    return { ok: true };
  },
};
