import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Shared PostgreSQL integration tests mutate the same database, so files must
    // run in series to avoid cross-suite cleanup races.
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.MBA_TEST_DATABASE_URL ?? 'postgresql://admin:adminpassword@localhost:5432/media_bias_atlas_test?schema=public',
      NODE_ENV: 'test',
      VITEST: 'true',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/index.ts',
      ],
      thresholds: {
        lines: 80,
      },
    },
  },
});
