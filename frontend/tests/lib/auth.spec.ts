import { describe, expect, it } from 'vitest';
import { isUserPremium } from '@/lib/auth';

describe('isUserPremium', () => {
  it('returns true for PREMIUM plan', () => {
    expect(isUserPremium({ plan: 'PREMIUM', entitlements: { deepAnalysis: false } })).toBe(true);
  });

  it('returns true for deepAnalysis entitlement even in FREE plan', () => {
    expect(isUserPremium({ plan: 'FREE', entitlements: { deepAnalysis: true } })).toBe(true);
  });

  it('returns false for FREE plan without entitlement', () => {
    expect(isUserPremium({ plan: 'FREE', entitlements: { deepAnalysis: false } })).toBe(false);
  });

  it('returns false for null user', () => {
    expect(isUserPremium(null)).toBe(false);
  });
});

