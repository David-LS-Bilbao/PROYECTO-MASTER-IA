/**
 * QuotaService Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { QuotaService } from '../../../src/domain/services/quota.service';
import { FeatureLockedError, QuotaExceededError } from '../../../src/domain/errors/domain.error';

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

  it('lanza error cuando excede limite de chat', () => {
    expect(() =>
      service.verifyQuota(
        {
          id: 'u4',
          subscriptionPlan: 'PREMIUM',
          usageStats: { chatMessages: 10000 },
        },
        'chat'
      )
    ).toThrow(QuotaExceededError);
  });

  it('en chat usa fallback 0 cuando usageStats/chatMessages no existen', () => {
    expect(() =>
      service.verifyQuota(
        {
          id: 'u4b',
          subscriptionPlan: 'PREMIUM',
          usageStats: undefined,
        },
        'chat'
      )
    ).not.toThrow();
  });

  it('usa fallback FREE cuando el plan no esta mapeado', () => {
    expect(() =>
      service.verifyQuota(
        {
          id: 'u5',
          subscriptionPlan: 'ENTERPRISE' as any,
          usageStats: undefined,
        },
        'analysis'
      )
    ).not.toThrow();
  });

  it('canAccessChat permite PREMIUM sin mirar trial', () => {
    expect(
      service.canAccessChat({
        id: 'premium-1',
        subscriptionPlan: 'PREMIUM',
      })
    ).toBe(true);
  });

  it('canAccessChat permite FREE con entitlement deepAnalysis', () => {
    expect(
      service.canAccessChat({
        id: 'free-entitled',
        subscriptionPlan: 'FREE',
        entitlements: { deepAnalysis: true },
      })
    ).toBe(true);
  });

  it('canAccessChat bloquea FREE sin entitlement', () => {
    expect(() =>
      service.canAccessChat({
        id: 'free-no-entitlement',
        subscriptionPlan: 'FREE',
      })
    ).toThrow(FeatureLockedError);
    expect(() =>
      service.canAccessChat({
        id: 'free-no-entitlement',
        subscriptionPlan: 'FREE',
      })
    ).toThrow('Solo para usuarios Premium');
  });
});
