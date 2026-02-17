/**
 * Entitlements Routes
 */

import { Router } from 'express';
import { EntitlementsController } from '../controllers/entitlements.controller';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/async-handler';

export function createEntitlementsRoutes(controller: EntitlementsController): Router {
  const router = Router();

  /**
   * GET /api/entitlements
   * Returns current user's feature entitlements.
   */
  router.get('/', authenticate, asyncHandler(controller.getEntitlements.bind(controller)));

  /**
   * POST /api/entitlements/redeem
   * Redeem promo code and unlock entitlements.
   */
  router.post('/redeem', authenticate, asyncHandler(controller.redeemCode.bind(controller)));

  return router;
}
