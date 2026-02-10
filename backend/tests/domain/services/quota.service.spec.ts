/**
 * QuotaService Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { QuotaService } from '../../../src/domain/services/quota.service';
import { QuotaExceededError } from '../../../src/domain/errors/domain.error';

describe('QuotaService', () => {
  const service = new QuotaService();

  it('permite analisis si esta bajo limite', () => {
    expect(() =>
      service.verifyQuota(
        {
          id: 'u1',
          subscriptionPlan: 'FREE',
          usageStats: { articlesAnalyzed: 10 },
        },
        'analysis'
      )
    ).not.toThrow();
  });

  it('lanza error cuando excede limite de analisis', () => {
    expect(() =>
      service.verifyQuota(
        {
          id: 'u2',
          subscriptionPlan: 'FREE',
          usageStats: { articlesAnalyzed: 1000 },
        },
        'analysis'
      )
    ).toThrow(QuotaExceededError);
  });

  it('mapea PREMIUM a PRO y valida chat', () => {
    expect(() =>
      service.verifyQuota(
        {
          id: 'u3',
          subscriptionPlan: 'PREMIUM',
          usageStats: { chatMessages: 1 },
        },
        'chat'
      )
    ).not.toThrow();
  });
});
