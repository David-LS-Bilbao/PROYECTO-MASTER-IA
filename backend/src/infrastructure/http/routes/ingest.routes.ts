/**
 * Ingest Routes
 *
 * SECURITY:
 * - Global ingestion (/all) is heavily rate-limited (5 req/hour in prod)
 * - Category ingestion (/news) has moderate rate limiting (30 req/15min in prod)
 * - Status checks (/status) are leniently limited (60 req/min)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IngestController } from '../controllers/ingest.controller';
import {
  globalIngestRateLimiter,
  categoryIngestRateLimiter,
  statusCheckRateLimiter,
} from '../middleware/rate-limit.middleware';

function requireCronSecret(req: Request, res: Response, next: NextFunction): void {
  const providedSecret = req.header('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET || '';

  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
    return;
  }

  next();
}

export function createIngestRoutes(ingestController: IngestController): Router {
  const router = Router();

  /**
   * POST /api/ingest/news
   * Trigger manual news ingestion for a specific category
   *
   * Rate Limit: 30 requests per 15 minutes (production)
   */
  router.post(
    '/news',
    requireCronSecret,
    categoryIngestRateLimiter, // Apply moderate rate limiting
    (req, res) => ingestController.ingestNews(req, res)
  );

  /**
   * POST /api/ingest/all
   * Trigger global ingestion for ALL categories
   *
   * Rate Limit: 5 requests per hour (production) - STRICT
   *
   * WARNING: This endpoint is resource-intensive:
   * - Processes 8+ categories in parallel
   * - Makes 200+ HTTP requests to RSS feeds
   * - Consumes 50K+ Gemini tokens (~€0.50 per request)
   */
  router.post(
    '/all',
    requireCronSecret,
    globalIngestRateLimiter, // Apply strict rate limiting (CRITICAL)
    (req, res) => ingestController.ingestAllNews(req, res)
  );

  /**
   * GET /api/ingest/status
   * Get last ingestion status
   *
   * Rate Limit: 60 requests per minute (lenient)
   */
  router.get(
    '/status',
    requireCronSecret,
    statusCheckRateLimiter, // Apply lenient rate limiting
    (req, res) => ingestController.getIngestionStatus(req, res)
  );

  return router;
}
