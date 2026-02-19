import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Runtime URL: pooler connection (fast for queries, PgBouncer)
// directUrl for migrations is configured in schema.prisma via env("DIRECT_URL")
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  'postgresql://postgres:postgres@localhost:5432/verity_news?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});
