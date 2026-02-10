/**
 * Quota Service (Domain Service)
 * Verifies if a user has exceeded their usage quotas
 *
 * Sprint 14 - Feature: Enforcement de Límites
 */

import { USER_PLANS } from '../../config/constants';
import { QuotaExceededError } from '../errors/domain.error';

export interface User {
  id: string;
  subscriptionPlan: 'FREE' | 'PREMIUM';
  usageStats?: {
    articlesAnalyzed?: number;
    chatMessages?: number;
    searchesPerformed?: number;
  } | null;
}

export class QuotaService {
  /**
   * Verifies if a user can perform the requested action
   * Throws QuotaExceededError if quota is exceeded
   *
   * @param user - User object with plan and usageStats
   * @param resource - Type of resource being consumed ('analysis' | 'chat')
   * @throws QuotaExceededError if quota exceeded
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
