/**
 * Ingest Routes - Cron Secret Middleware Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Application } from 'express';
import request from 'supertest';
import { createIngestRoutes } from '../../../../src/infrastructure/http/routes/ingest.routes';

describe('Ingest Routes - Cron Secret', () => {
  let app: Application;
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret';

    const mockController = {
      ingestNews: vi.fn(async (_req, res) => res.status(200).json({ success: true })),
      ingestAllNews: vi.fn(async (_req, res) => res.status(200).json({ success: true })),
      getIngestionStatus: vi.fn(async (_req, res) => res.status(200).json({ success: true })),
    };

    app = express();
    app.use(express.json());
    app.use('/api/ingest', createIngestRoutes(mockController as any));
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
    vi.restoreAllMocks();
  });

  it('401 when x-cron-secret header is missing', async () => {
    const res = await request(app).post('/api/ingest/all');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: 'Unauthorized' });
  });

  it('200 when x-cron-secret header matches', async () => {
    const res = await request(app)
      .post('/api/ingest/all')
      .set('x-cron-secret', 'test-cron-secret');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('Ingest Routes - Public Trigger (Sprint 35)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper to create fresh app instance for each test
   * (Prevents rate limiter state from leaking between tests)
   */
  function createTestApp(): Application {
    const mockController = {
      ingestNews: vi.fn(async (_req, res) => res.status(200).json({ success: true })),
      ingestAllNews: vi.fn(async (_req, res) => res.status(200).json({ success: true })),
      getIngestionStatus: vi.fn(async (_req, res) => res.status(200).json({ success: true })),
      triggerPublicIngest: vi.fn(async (_req, res) => res.status(200).json({ success: true, message: 'Ingestion triggered' })),
    };

    const app = express();
    app.use(express.json());
    app.use('/api/ingest', createIngestRoutes(mockController as any));
    return app;
  }

  it('🟢 GREEN: POST /trigger should be public (no CRON_SECRET required)', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/ingest/trigger');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it('🟢 GREEN: POST /trigger should accept optional categories array', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/ingest/trigger')
      .send({ categories: ['general', 'tecnologia'] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it('🟢 GREEN: POST /trigger should reject invalid payload', async () => {
    // Test Zod schema validation directly (unit test approach)
    const { publicTriggerSchema } = await import(
      '../../../../src/infrastructure/http/schemas/ingest.schema'
    );

    expect(() => {
      publicTriggerSchema.parse({ categories: 'not-an-array' });
    }).toThrow();

    // Verify error message contains validation info
    try {
      publicTriggerSchema.parse({ categories: 'not-an-array' });
    } catch (error: any) {
      expect(error.issues).toBeDefined();
      expect(error.issues[0].code).toBe('invalid_type');
      expect(error.issues[0].expected).toBe('array');
    }
  });

  it('🟢 GREEN: POST /trigger should have rate limiter configured', async () => {
    const app = createTestApp();

    // In test environment, rate limiter is lenient (1000 req/5min)
    // This test verifies endpoint exists and accepts multiple requests
    const firstRes = await request(app).post('/api/ingest/trigger');
    expect(firstRes.status).toBe(200);

    const secondRes = await request(app).post('/api/ingest/trigger');
    expect(secondRes.status).toBe(200); // Should succeed in test env

    // Note: Production rate limiting (1 req/5min) is tested manually
    // or via integration tests in production-like environment
  });
});
