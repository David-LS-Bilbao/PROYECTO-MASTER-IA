/**
 * Health Routes
 * Endpoints for health checks and readiness probes
 */

import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';

export function createHealthRoutes(healthController: HealthController): Router {
  const router = Router();

  /**
   * GET /health/check
   * Basic health check
   */
  router.get('/check', (req, res) => healthController.check(req, res));

  /**
   * GET /health/readiness
   * Readiness probe with database verification
   */
  router.get('/readiness', (req, res) => healthController.readiness(req, res));

  return router;
}
