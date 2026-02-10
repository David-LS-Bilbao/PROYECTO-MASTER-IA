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
