/**
 * Analyze Routes
 * Defines HTTP routes for article analysis endpoints
 */

import { Router } from 'express';
import { AnalyzeController } from '../controllers/analyze.controller';

export function createAnalyzeRoutes(controller: AnalyzeController): Router {
  const router = Router();

  /**
   * POST /api/analyze/article
   * Analyze a single article by ID
   * Body: { articleId: string (UUID) }
   */
  router.post('/article', (req, res) => controller.analyzeArticle(req, res));

  /**
   * POST /api/analyze/batch
   * Analyze multiple unanalyzed articles
   * Body: { limit: number (1-100, default: 10) }
   */
  router.post('/batch', (req, res) => controller.analyzeBatch(req, res));

  /**
   * GET /api/analyze/stats
   * Get analysis statistics (total, analyzed, pending, percentage)
   */
  router.get('/stats', (req, res) => controller.getStats(req, res));

  return router;
}
