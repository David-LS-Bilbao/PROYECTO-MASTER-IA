import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  'postgresql://postgres:postgres@localhost:5432/verity_news?schema=public';

// Neon provides two URLs:
//   DATABASE_URL  → pooler (-pooler. hostname) — fast for runtime queries
//   DIRECT_URL    → direct connection (no pooler) — required for migrations
//
// Prisma migrate deploy uses advisory locks (pg_advisory_lock) which are
// session-scoped and incompatible with PgBouncer (the Neon pooler).
// Using the direct URL for migrations avoids the P1002 timeout error.
//
// In Render: add DIRECT_URL env var = same as DATABASE_URL but without "-pooler" in hostname.
// Example: ep-shiny-sun-aggbif9m-pooler.eu-central-1... → ep-shiny-sun-aggbif9m.eu-central-1...
const directUrl =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  databaseUrl; // fallback: same URL (works if already pointing to direct connection)

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
    directUrl: directUrl, // Used by prisma migrate deploy (bypasses PgBouncer advisory lock issue)
  },
});
