/**
 * Ingest Routes
 */

import { Router } from 'express';
import { IngestController } from '../controllers/ingest.controller';

export function createIngestRoutes(ingestController: IngestController): Router {
  const router = Router();

  /**
   * POST /api/ingest/news
   * Trigger manual news ingestion
   */
  router.post('/news', (req, res) => ingestController.ingestNews(req, res));

  /**
   * POST /api/ingest/all
   * Trigger global ingestion for ALL categories
   */
  router.post('/all', (req, res) => ingestController.ingestAllNews(req, res));

  /**
   * GET /api/ingest/status
   * Get last ingestion status
   */
  router.get('/status', (req, res) => ingestController.getIngestionStatus(req, res));

  return router;
}
