import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    env: {
      // Variables de entorno para tests
      GEMINI_API_KEY: 'test-api-key-for-integration-tests',
      JINA_API_KEY: 'test-jina-api-key-for-integration-tests',
      DATABASE_URL: 'postgresql://admin:adminpassword@localhost:5433/verity_news?schema=public',
      CHROMA_URL: 'http://localhost:8000',
      NODE_ENV: 'test',
      VITEST: 'true', // Flag para detectar entorno de test
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/index.ts',
        'src/infrastructure/config/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
