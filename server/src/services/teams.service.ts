import { prisma } from '../db/prisma.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';
import { BadRequestError } from '../utils/errors.js';

// undefined = leave stored value, null/'' = clear, string = set (encrypted).
type SecretInput = string | null | undefined;

// Bot Framework "MicrosoftAppType". A managed-identity bot (UserAssignedMSI) has
// no secret — it authenticates via the identity at runtime.
export const APP_TYPES = ['MultiTenant', 'SingleTenant', 'UserAssignedMSI'] as const;
type AppType = (typeof APP_TYPES)[number];

interface TeamsConnectionInput {
  appType?: AppType;
  botAppId?: string | null;
  tenantId?: string | null;
  botAppPassword?: SecretInput;
}

function secretPatch(value: SecretInput): string | null | undefined {
  if (value === undefined) return undefined; // leave as-is
  if (value === null || value === '') return null; // clear
  return encryptSecret(value); // set (encrypted)
}

/** Whether the bot has everything it needs to run, given its app type. */
function isConfigured(
  appType: string,
  botAppId: string | null,
  botAppPassword: string | null,
  tenantId: string | null
): boolean {
  if (!botAppId) return false;
  if (appType === 'UserAssignedMSI') return !!tenantId; // no secret; identity + tenant
  if (appType === 'SingleTenant') return !!(botAppPassword && tenantId);
  return !!botAppPassword; // MultiTenant
}

/** Never returns the secret — only whether one is stored. */
function maskConnection(
  c: { appType: string; botAppId: string | null; tenantId: string | null; botAppPassword: string | null } | null
) {
  const appType = c?.appType ?? 'SingleTenant';
  return {
    appType,
    botAppId: c?.botAppId ?? '',
    tenantId: c?.tenantId ?? '',
    botAppPasswordSet: !!c?.botAppPassword,
    configured: isConfigured(appType, c?.botAppId ?? null, c?.botAppPassword ?? null, c?.tenantId ?? null),
  };
}

export const teamsService = {
  async getConnection(orgId: string) {
    const c = await prisma.teamsConnection.findUnique({ where: { orgId } });
    return maskConnection(c);
  },

  async saveConnection(orgId: string, data: TeamsConnectionInput) {
    const appType = data.appType;
    // Managed identity has no secret — force-clear any stored one for that type;
    // otherwise honour the patch (leave / clear / set).
    const secretWrite = appType === 'UserAssignedMSI' ? null : secretPatch(data.botAppPassword);
    const base = { botAppId: data.botAppId ?? null, tenantId: data.tenantId ?? null };
    await prisma.teamsConnection.upsert({
      where: { orgId },
      create: {
        orgId,
        appType: appType ?? 'SingleTenant',
        ...base,
        botAppPassword: secretWrite ?? null,
      },
      update: {
        ...(appType ? { appType } : {}),
        ...base,
        ...(secretWrite !== undefined ? { botAppPassword: secretWrite } : {}),
      },
    });
    return this.getConnection(orgId);
  },

  /**
   * Validate the stored bot credentials. For secret-based bots this requests an
   * app token from Entra (client-credentials for the Bot Framework resource),
   * proving the app id / secret / tenant. A managed-identity bot has no secret to
   * test — it's authenticated at runtime inside Azure — so we just confirm the
   * fields are complete.
   */
  async testConnection(orgId: string) {
    const c = await prisma.teamsConnection.findUnique({ where: { orgId } });
    const appType = c?.appType ?? 'SingleTenant';
    if (!c?.botAppId) throw new BadRequestError('Add the bot App ID first.');

    if (appType === 'UserAssignedMSI') {
      if (!c.tenantId) throw new BadRequestError('Add the tenant (directory) ID for the managed identity.');
      return {
        ok: true,
        message:
          'Looks complete. A user-assigned managed identity is authenticated at runtime from Azure — there is no secret to verify here. Make sure the identity is assigned to the app’s Azure compute.',
      };
    }

    if (!c.botAppPassword) throw new BadRequestError('Add the app password (client secret) first.');
    if (appType === 'SingleTenant' && !c.tenantId) {
      throw new BadRequestError('Single-tenant bots need the tenant (directory) ID.');
    }
    const secret = decryptSecret(c.botAppPassword);
    if (!secret) throw new BadRequestError('Stored app password could not be read; re-enter it.');

    // Single-tenant uses the org's directory; multi-tenant uses the shared
    // botframework.com tenant that the Bot Connector authenticates against.
    const tenant = appType === 'SingleTenant' ? c.tenantId! : 'botframework.com';
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: c.botAppId,
      client_secret: secret,
      scope: 'https://api.botframework.com/.default',
    });
    const url = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;

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
    return { ok: true, message: 'Credentials verified with Microsoft.' };
  },
};
