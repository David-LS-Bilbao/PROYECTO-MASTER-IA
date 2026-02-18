/**
 * Quota Service (Domain Service)
 * Verifies if a user has exceeded their usage quotas
 */

import { USER_PLANS } from '../../config/constants';
import { QuotaExceededError, FeatureLockedError } from '../errors/domain.error';

export interface User {
  id: string;
  subscriptionPlan: 'FREE' | 'PREMIUM';
  entitlements?: {
    deepAnalysis?: boolean;
  } | null;
  usageStats?: {
    articlesAnalyzed?: number;
    chatMessages?: number;
    searchesPerformed?: number;
  } | null;
}

export class QuotaService {
  /**
   * Chat access gate shared by article/general chat endpoints.
   *
   * Access rules:
   * - PREMIUM plan -> allowed
   * - deepAnalysis entitlement (promo) -> allowed
   * - otherwise -> blocked
   */
  canAccessChat(user: User): boolean {
    if (user.subscriptionPlan === 'PREMIUM' || user.entitlements?.deepAnalysis === true) {
      return true;
    }

    throw new FeatureLockedError('Chat', 'Solo para usuarios Premium', {
      reason: 'PREMIUM_REQUIRED',
    });
  }

  /**
   * Verifies if a user can perform the requested action.
   * Throws QuotaExceededError if quota is exceeded.
   */
  verifyQuota(user: User, resource: 'analysis' | 'chat'): void {
    // Map SubscriptionPlan to constants USER_PLANS
    // FREE -> FREE
    // PREMIUM -> PRO
    const planMapping: Record<string, 'FREE' | 'PRO'> = {
      FREE: 'FREE',
      PREMIUM: 'PRO',
    };

    const mappedPlan = planMapping[user.subscriptionPlan] || 'FREE';
    const planConfig = USER_PLANS[mappedPlan];

    const usageStats = user.usageStats || {};

    if (resource === 'analysis') {
      const articlesAnalyzed = usageStats.articlesAnalyzed || 0;
      const limit = planConfig.monthlyAnalysisLimit;

      if (articlesAnalyzed >= limit) {
        throw new QuotaExceededError(
          `Monthly analysis limit (${limit}) exceeded for plan ${mappedPlan}`,
          {
            plan: mappedPlan,
            resource: 'analysis',
            currentUsage: articlesAnalyzed,
            monthlyLimit: limit,
            userId: user.id,
          }
        );
      }
    }

    if (resource === 'chat') {
      const chatMessages = usageStats.chatMessages || 0;
      const limit = planConfig.monthlyChatLimit;

      if (chatMessages >= limit) {
        throw new QuotaExceededError(
          `Monthly chat limit (${limit}) exceeded for plan ${mappedPlan}`,
          {
            plan: mappedPlan,
            resource: 'chat',
            currentUsage: chatMessages,
            monthlyLimit: limit,
            userId: user.id,
          }
        );
      }
    }
  }
}
