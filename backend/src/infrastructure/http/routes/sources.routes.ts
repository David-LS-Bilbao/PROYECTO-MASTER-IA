/**
 * Sources Routes (Infrastructure Layer)
 * 
 * FEATURE: RSS AUTO-DISCOVERY (Sprint 9)
 * Rutas para gestión de fuentes RSS.
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

  return router;
}
