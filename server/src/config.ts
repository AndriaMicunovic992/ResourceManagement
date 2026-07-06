// Centralized runtime configuration. Import `config` anywhere; call
// `assertProductionConfig()` at boot (start.ts) to fail fast on misconfiguration
// instead of limping along with insecure defaults.

const isProd = process.env.NODE_ENV === 'production';

function entraConfig() {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;
  const redirectUri = process.env.ENTRA_REDIRECT_URI;
  // SSO lights up only when every Entra value is present. Until then the
  // Microsoft button is hidden and the endpoints report disabled.
  const enabled = Boolean(tenantId && clientId && clientSecret && redirectUri);
  return { tenantId, clientId, clientSecret, redirectUri, enabled };
}

export const config = {
  isProd,
  // Local email/password login. On by default for seeded test personas and
  // break-glass admin access; set ALLOW_LOCAL_AUTH=false to disable in prod.
  localAuthEnabled: process.env.ALLOW_LOCAL_AUTH !== 'false',
  jwtSecret: process.env.JWT_SECRET,
  // Key for encrypting secrets at rest (Jira/Tempo tokens). Falls back to the
  // JWT secret so no extra config is required; set ENCRYPTION_KEY to rotate
  // independently. Changing it makes already-stored secrets unreadable.
  encryptionKey: process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'insecure-dev-encryption-key',
  // Lifetime of a normal session token, and of a short-lived "view as" token.
  tokenTtl: process.env.TOKEN_TTL || '7d',
  impersonationTtl: '1h',
  // Where to bounce the browser after the Microsoft callback. Empty = same
  // origin (production serves the SPA itself); set to e.g. http://localhost:5173
  // in dev.
  clientUrl: process.env.CLIENT_URL || '',
  get entra() {
    return entraConfig();
  },
};

/** Returns a list of fatal configuration problems (empty = OK). */
export function assertProductionConfig(): string[] {
  const errors: string[] = [];
  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is required');
  } else if (process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }
  return errors;
}

/** Non-fatal configuration warnings to surface at boot. */
export function configWarnings(): string[] {
  const warnings: string[] = [];
  if (isProd && !process.env.ENCRYPTION_KEY) {
    warnings.push(
      'ENCRYPTION_KEY is not set — integration tokens are encrypted with a key derived from JWT_SECRET. ' +
        'Rotating JWT_SECRET will make all stored Jira/Tempo/Teams tokens undecryptable. ' +
        'Set ENCRYPTION_KEY to decouple them.'
    );
  }
  return warnings;
}
