/**
 * Subscription Routes
 * Defines HTTP routes for subscription management
 */

import { Router } from 'express';
import { SubscriptionController } from '../controllers/subscription.controller';
import { authenticate as authenticateMiddleware } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/async-handler';

export function createSubscriptionRoutes(controller: SubscriptionController): Router {
  const router = Router();

  /**
   * POST /api/subscription/redeem
   * Redeem promo code (authenticated users only)
   */
  router.post('/redeem', authenticateMiddleware, asyncHandler(controller.redeemCode.bind(controller)));

  /**
   * POST /api/subscription/cancel
   * Cancel subscription (authenticated users only)
   */
  router.post('/cancel', authenticateMiddleware, asyncHandler(controller.cancelSubscription.bind(controller)));

  return router;
}
