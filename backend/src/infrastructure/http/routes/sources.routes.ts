/**
 * Sources Routes (Infrastructure Layer)
 *
 * FEATURE: RSS AUTO-DISCOVERY (Sprint 9 & 32)
 * Rutas para gestión de fuentes RSS.
 * Sprint 32: Descubrimiento automático de fuentes locales.
 */

import { Router } from 'express';
import { SourcesController } from '../controllers/sources.controller';

export function createSourcesRoutes(controller: SourcesController): Router {
  const router = Router();

  /**
   * POST /api/sources/discover
   * Descubre automáticamente la URL del RSS de un medio usando IA
   *
   * Body: { query: string }
   * Response: { success: true, data: { query: string, rssUrl: string } }
   */
  router.post('/discover', async (req, res) => {
    await controller.discover(req, res);
  });

  /**
   * POST /api/sources/discover-local
   * Descubre periódicos locales/regionales con Gemini + Caché (Sprint 32)
   *
   * Body: { location: string, limit?: number }
   * Response: { success: true, data: { sources: [...], fromCache: boolean, location: string } }
   */
  router.post('/discover-local', async (req, res) => {
    await controller.discoverLocal(req, res);
  });

  /**
   * GET /api/sources/cache-stats
   * Obtiene estadísticas del caché de descubrimiento local
   */
  router.get('/cache-stats', async (req, res) => {
    await controller.getCacheStats(req, res);
  });

  /**
   * POST /api/sources/clear-cache
   * Limpia el caché de descubrimiento local (admin/debugging)
   */
  router.post('/clear-cache', async (req, res) => {
    await controller.clearCache(req, res);
  });

  return router;
}
