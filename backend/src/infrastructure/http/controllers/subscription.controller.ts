/**
 * Subscription Controller
 * Handles promo code redemption for upgrading user plans
 */

import { Request, Response } from 'express';
import { getPrismaClient } from '../../persistence/prisma.client';
import { redeemCodeSchema } from '../schemas/subscription.schema';

const VALID_CODES = new Set(['VERITY_ADMIN', 'MASTER_AI_2026']);

export class SubscriptionController {
  /**
   * POST /api/subscription/redeem
   * Redeem a promo code to upgrade user plan
   */
  async redeemCode(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.uid;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
        });
        return;
      }

      const { code } = redeemCodeSchema.parse(req.body);

      if (!VALID_CODES.has(code)) {
        res.status(400).json({
          error: 'Invalid code',
        });
        return;
      }

      const prisma = getPrismaClient();

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionPlan: 'PREMIUM',
        },
      });

      res.status(200).json({
        success: true,
        plan: updatedUser.subscriptionPlan,
      });
    } catch (error) {
      console.error('❌ Error redeeming code:', error);
      res.status(500).json({
        success: false,
        error: 'Error al canjear código',
      });
    }
  }

  /**
   * POST /api/subscription/cancel
   * Downgrade subscription to FREE
   */
  async cancelSubscription(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.uid;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
        });
        return;
      }

      const prisma = getPrismaClient();

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionPlan: 'FREE',
        },
      });

      res.status(200).json({
        success: true,
        plan: updatedUser.subscriptionPlan,
      });
    } catch (error) {
      console.error('❌ Error canceling subscription:', error);
      res.status(500).json({
        success: false,
        error: 'Error al cancelar suscripción',
      });
    }
  }
}
