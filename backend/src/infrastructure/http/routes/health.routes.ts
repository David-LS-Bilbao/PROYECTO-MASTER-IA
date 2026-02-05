/**
 * Health Routes
 * Endpoints for health checks and readiness probes
 */

import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';
import { logger } from '../../logger/logger'; // Sprint 15: Test Sentry breadcrumbs

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

  /**
   * GET /health/test-sentry-breadcrumbs
   * 🧪 TEMPORARY TEST ENDPOINT - Sprint 15 Paso 2
   * Tests that Pino logs are sent to Sentry as breadcrumbs
   *
   * Expected behavior:
   * 1. Logger emits info → Sentry breadcrumb (info)
   * 2. Logger emits warn → Sentry breadcrumb (warning)
   * 3. Error thrown → Sentry captures exception WITH breadcrumbs
   *
   * HOW TO TEST:
   * 1. curl http://localhost:3000/health/test-sentry-breadcrumbs
   * 2. Check Sentry dashboard → should see error with 2 breadcrumbs
   *
   * TODO: Remove this endpoint after validation
   */
  router.get('/test-sentry-breadcrumbs', (req, res, next) => {
    try {
      // Step 1: Log info (should become breadcrumb)
      logger.info('🧪 Test: Paso 1 - Iniciando operación de prueba');

      // Step 2: Log warning (should become breadcrumb)
      logger.warn('🧪 Test: Paso 2 - Algo huele raro aquí...');

      // Step 3: Log with context (should include in breadcrumb)
      logger.info({ userId: 'test-user-123', action: 'test' }, '🧪 Test: Paso 3 - Log con contexto');

      // Step 4: Throw error (should capture with breadcrumbs)
      throw new Error('🧪 Test: Boom! Error intencional para probar Sentry breadcrumbs');
    } catch (error) {
      // Pass error to error handler (which will send to Sentry)
      next(error);
    }
  });

  return router;
}
