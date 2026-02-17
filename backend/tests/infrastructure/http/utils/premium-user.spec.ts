import { describe, expect, it } from 'vitest';
import { isPremiumUser } from '../../../../src/infrastructure/http/utils/premium-user';

describe('isPremiumUser', () => {
  it('returns false when email is missing', () => {
    process.env.PREMIUM_EMAILS = 'a@b.com';
    expect(isPremiumUser(undefined)).toBe(false);
    expect(isPremiumUser(null)).toBe(false);
    expect(isPremiumUser('')).toBe(false);
  });

  it('matches allowlisted emails case-insensitively', () => {
    process.env.PREMIUM_EMAILS = 'Admin@Verity.com, premium@example.com';

    expect(isPremiumUser('admin@verity.com')).toBe(true);
    expect(isPremiumUser('PREMIUM@example.com')).toBe(true);
    expect(isPremiumUser('free@example.com')).toBe(false);
  });
});
