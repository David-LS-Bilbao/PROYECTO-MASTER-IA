/**
 * Analyze Routes
 * Defines HTTP routes for article analysis endpoints
 *
 * DEUDA TÉCNICA #7 (Sprint 14): Error handling centralizado
 * - ✅ Usa asyncHandler para capturar errores de promesas
 * - ✅ Los errores se propagan al middleware errorHandler
 * - ✅ No hay try-catch redundantes en las rutas
 */

import { Router } from 'express';
import { AnalyzeController } from '../controllers/analyze.controller';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/async-handler';

export function createAnalyzeRoutes(controller: AnalyzeController): Router {
  const router = Router();

  /**
   * POST /api/analyze/article
   * Analyze a single article by ID (Protected - requires authentication)
   * Body: { articleId: string (UUID) }
   * Headers: Authorization: Bearer <firebase-token>
   *
   * Errores manejados por middleware:
   * - ZodError → 400 Bad Request
   * - EntityNotFoundError → 404 Not Found
   * - ExternalAPIError → 503 Service Unavailable
   */
  router.post('/article', authenticate, asyncHandler(controller.analyzeArticle.bind(controller)));

  /**
   * POST /api/analyze/batch
   * Analyze multiple unanalyzed articles
   * Body: { limit: number (1-100, default: 10) }
   */
  router.post('/batch', asyncHandler(controller.analyzeBatch.bind(controller)));

  /**
   * GET /api/analyze/stats
   * Get analysis statistics (total, analyzed, pending, percentage)
   */
  router.get('/stats', asyncHandler(controller.getStats.bind(controller)));

  return router;
}
