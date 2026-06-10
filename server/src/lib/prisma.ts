/**
 * ────────────────────────────────────────────────────────────
 * Prisma Client — Singleton
 * ────────────────────────────────────────────────────────────
 *
 * WHY A SINGLETON?
 * In development, tools like `tsx watch` or `nodemon` restart
 * the server on every file change. Each restart would normally
 * create a **new** PrismaClient instance (and therefore a new
 * database connection pool). After a few restarts you'd hit
 * PostgreSQL's connection limit and see:
 *
 *   "Too many clients already" / FATAL: sorry, too many clients
 *
 * By caching the client on `globalThis` (which survives module
 * re-evaluations during hot reload), we reuse the same pool
 * across restarts.
 *
 * In production this is a no-op — the process starts once and
 * the module-level `prisma` constant is used directly.
 * ────────────────────────────────────────────────────────────
 */

import { PrismaClient } from "@prisma/client";

/**
 * Extend the global namespace so TypeScript knows about our
 * cached client without `any` casts.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Re-use an existing client from the global cache, or create a
 * new one. The `log` option in development surfaces slow queries
 * early so we can add indexes before they become a problem.
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

// Only cache in non-production environments (where hot reload happens).
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
