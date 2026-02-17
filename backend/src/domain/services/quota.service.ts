/**
 * Quota Service (Domain Service)
 * Verifies if a user has exceeded their usage quotas
 *
 * Sprint 14 - Feature: Enforcement de Límites
 * Sprint 30 - Premium Chat with 7-day trial period
 */

import { USER_PLANS, TRIAL_PERIOD_DAYS } from '../../config/constants';
import { QuotaExceededError, FeatureLockedError } from '../errors/domain.error';

export interface User {
  id: string;
  subscriptionPlan: 'FREE' | 'PREMIUM';
  createdAt?: Date; // Sprint 30: For trial period calculation
  usageStats?: {
    articlesAnalyzed?: number;
    chatMessages?: number;
    searchesPerformed?: number;
  } | null;
}

export class QuotaService {
  /**
   * Sprint 30: Check if user can access Chat features (PREMIUM-only with 7-day trial)
   *
   * Access Rules:
   * - PREMIUM users → Always allowed
   * - FREE users within 7 days of signup → Allowed (trial period)
   * - FREE users after 7 days → Blocked (show upgrade CTA)
   *
   * @param user - User object with plan and createdAt
   * @returns true if user can access Chat, false otherwise
   * @throws FeatureLockedError if user is not eligible
   */
  canAccessChat(user: User): boolean {
    // PREMIUM users always have access
    if (user.subscriptionPlan === 'PREMIUM') {
      return true;
    }

    // FREE users: check trial period
    if (user.subscriptionPlan === 'FREE') {
      // If createdAt is missing, assume legacy user (created before feature) → deny access
      if (!user.createdAt) {
        throw new FeatureLockedError('Chat', 'El acceso al Chat requiere suscripción Premium', {
          reason: 'FREE_USER_NO_TRIAL',
          trialExpired: false,
        });
      }

      // Calculate days since account creation
      const now = new Date();
      const createdAt = new Date(user.createdAt);
      const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      // Within trial period?
      if (daysSinceCreation <= TRIAL_PERIOD_DAYS) {
        return true; // Trial active
      } else {
        // Trial expired
        throw new FeatureLockedError('Chat', 'Tu periodo de prueba ha expirado. Actualiza a Premium para continuar usando el Chat', {
          reason: 'TRIAL_EXPIRED',
          trialExpired: true,
          daysRemaining: 0,
        });
      }
    }

    // Fallback: deny access
    return false;
  }

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
