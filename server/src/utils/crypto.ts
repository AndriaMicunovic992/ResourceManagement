import crypto from 'node:crypto';
import { config } from '../config.js';

// AES-256-GCM encryption for secrets stored at rest (Jira / Tempo API tokens).
// The 256-bit key is derived from config.encryptionKey (ENCRYPTION_KEY, falling
// back to a hash of JWT_SECRET) so existing deployments work without new
// config. Rotating that secret makes previously-encrypted values unreadable.
const ALGO = 'aes-256-gcm';

function key(): Buffer {
  return crypto.createHash('sha256').update(config.encryptionKey).digest();
}

/** Encrypt a secret → "iv.tag.ciphertext" (all base64). */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.');
}

/** Decrypt a value produced by encryptSecret. Returns null on any failure. */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const [ivB, tagB, ctB] = stored.split('.');
    if (!ivB || !tagB || !ctB) return null;
    const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivB, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    const pt = Buffer.concat([decipher.update(Buffer.from(ctB, 'base64')), decipher.final()]);
    return pt.toString('utf8');
  } catch {
    // A stored value that won't decrypt usually means the encryption key changed
    // (e.g. JWT_SECRET was rotated while ENCRYPTION_KEY was unset). Log a distinct
    // signal rather than silently behaving as if no token were configured.
    console.warn('decryptSecret: stored value failed to decrypt — the encryption key may have changed.');
    return null;
  }
}
