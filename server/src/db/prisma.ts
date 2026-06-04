import { PrismaClient } from '@prisma/client';

// Reuse a single PrismaClient across hot-reloads. Under `tsx watch` each reload
// re-evaluates this module; without the global guard that would open a new pool
// every time and eventually exhaust the database's connection limit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
