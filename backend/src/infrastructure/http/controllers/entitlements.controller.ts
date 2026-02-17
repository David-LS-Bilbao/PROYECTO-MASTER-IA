/**
 * Entitlements Controller
 * Handles feature access flags (e.g., deep analysis) independent from billing.
 */

import { Request, Response } from 'express';
import { getPrismaClient } from '../../persistence/prisma.client';
import { redeemEntitlementCodeSchema } from '../schemas/entitlements.schema';
import { safeParseUserEntitlements, safeParseUserPreferences } from '../schemas/user-profile.schema';

function getValidPromoCodes(): Set<string> {
  return new Set(
    (process.env.PROMO_CODES || '')
      .split(',')
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean)
  );
}

export class EntitlementsController {
  /**
   * GET /api/entitlements
   * Returns current entitlements for authenticated user.
   */
  async getEntitlements(req: Request, res: Response): Promise<void> {
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
      });
      return;
    }

    const entitlements = safeParseUserEntitlements(req.user?.entitlements);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({
      success: true,
      data: {
        entitlements,
      },
    });
  }

  /**
   * POST /api/entitlements/redeem
   * Redeem promo code and unlock deep analysis entitlement.
   */
  async redeemCode(req: Request, res: Response): Promise<void> {
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
      });
      return;
    }

    const { code } = redeemEntitlementCodeSchema.parse(req.body);
    const normalizedCode = code.trim().toUpperCase();
    const validCodes = getValidPromoCodes();

    if (!validCodes.has(normalizedCode)) {
      res.status(400).json({
        success: false,
        error: 'Invalid code',
      });
      return;
    }

    const prisma = getPrismaClient();
    const safePreferences = safeParseUserPreferences(req.user?.preferences);
    const updatedEntitlements = safeParseUserEntitlements({
      ...safePreferences.entitlements,
      deepAnalysis: true,
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        preferences: {
          ...safePreferences,
          entitlements: updatedEntitlements,
        },
      },
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({
      success: true,
      data: {
        entitlements: updatedEntitlements,
      },
      message: 'Entitlements updated',
    });
  }
}
