import bcrypt from 'bcryptjs';

// Cost factor for bcrypt. 12 is a reasonable modern default (10 is on the low
// side); override with BCRYPT_ROUNDS if hashing latency becomes a concern.
const ROUNDS = Math.min(15, Math.max(10, Number(process.env.BCRYPT_ROUNDS) || 12));

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
