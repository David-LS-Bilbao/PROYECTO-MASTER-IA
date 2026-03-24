import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7.x: all connection URLs live in prisma.config.ts, NOT in schema.prisma.
//
// Neon provides two connection modes:
//   DATABASE_URL  → pooler (-pooler. hostname) — PgBouncer, fast for runtime queries
//   DIRECT_URL    → direct connection (no pooler) — required for prisma migrate deploy
//
// Prisma migrate deploy uses pg_advisory_lock (session-scoped advisory locks).
// PgBouncer runs in transaction mode and does NOT support session-level locks → P1002 timeout.
// The directUrl bypasses PgBouncer so Prisma can acquire the advisory lock successfully.
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  'postgresql://admin:adminpassword@localhost:5433/verity_news?schema=public';

const directUrl =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  databaseUrl;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
    directUrl,
  },
});
