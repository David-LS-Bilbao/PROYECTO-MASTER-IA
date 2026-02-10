/**
 * Zod Schemas for Subscription API (Shift Left Security)
 * All external input is validated here before reaching the controller
 */

import { z } from 'zod';

/**
 * Schema for redeem promo code request
 */
export const redeemCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'code is required')
    .max(64, 'code is too long'),
});

export type RedeemCodeInput = z.infer<typeof redeemCodeSchema>;
