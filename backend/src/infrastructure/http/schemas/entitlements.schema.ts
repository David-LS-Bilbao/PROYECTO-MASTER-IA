/**
 * Zod Schemas for Entitlements API
 */

import { z } from 'zod';

/**
 * Schema for redeem promo code request
 */
export const redeemEntitlementCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'code is required')
    .max(64, 'code is too long'),
});

export type RedeemEntitlementCodeInput = z.infer<typeof redeemEntitlementCodeSchema>;
