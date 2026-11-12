// Prisma client singleton.
// Serverless functions can be re-used between requests, so we cache the
// client on globalThis to avoid opening a new connection pool every time.
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__prisma ?? new PrismaClient();

if (!globalForPrisma.__prisma) {
  globalForPrisma.__prisma = prisma;
}
