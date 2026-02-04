/**
 * User Stats Tracker
 * Utility to increment user usage statistics
 */

import { getPrismaClient } from '../persistence/prisma.client';

interface UsageStats {
  articlesAnalyzed: number;
  searchesPerformed: number;
  chatMessages: number;
}

export class UserStatsTracker {
  /**
   * Increment articles analyzed counter
   */
  static async incrementArticlesAnalyzed(userId: string, count: number = 1): Promise<void> {
    try {
      const prisma = getPrismaClient();
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { usageStats: true }
      });

      if (!user) return;

      const currentStats = (user.usageStats as unknown as UsageStats) || {
        articlesAnalyzed: 0,
        searchesPerformed: 0,
        chatMessages: 0
      };

      await prisma.user.update({
        where: { id: userId },
        data: {
          usageStats: {
            ...currentStats,
            articlesAnalyzed: (currentStats.articlesAnalyzed || 0) + count
          }
        }
      });
    } catch (error) {
      console.error('[UserStatsTracker] Error incrementing articlesAnalyzed:', error);
      // No throw - tracking shouldn't break the main flow
    }
  }

  /**
   * Increment searches performed counter
   */
  static async incrementSearches(userId: string, count: number = 1): Promise<void> {
    try {
      const prisma = getPrismaClient();
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { usageStats: true }
      });

      if (!user) return;

      const currentStats = (user.usageStats as unknown as UsageStats) || {
        articlesAnalyzed: 0,
        searchesPerformed: 0,
        chatMessages: 0
      };

      await prisma.user.update({
        where: { id: userId },
        data: {
          usageStats: {
            ...currentStats,
            searchesPerformed: (currentStats.searchesPerformed || 0) + count
          }
        }
      });
    } catch (error) {
      console.error('[UserStatsTracker] Error incrementing searches:', error);
    }
  }

  /**
   * Increment chat messages counter
   */
  static async incrementChatMessages(userId: string, count: number = 1): Promise<void> {
    try {
      const prisma = getPrismaClient();
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { usageStats: true }
      });

      if (!user) return;

      const currentStats = (user.usageStats as unknown as UsageStats) || {
        articlesAnalyzed: 0,
        searchesPerformed: 0,
        chatMessages: 0
      };

      await prisma.user.update({
        where: { id: userId },
        data: {
          usageStats: {
            ...currentStats,
            chatMessages: (currentStats.chatMessages || 0) + count
          }
        }
      });
    } catch (error) {
      console.error('[UserStatsTracker] Error incrementing chatMessages:', error);
    }
  }

  /**
   * Reset monthly stats (for billing cycle)
   * Call this at the beginning of each month
   */
  static async resetMonthlyStats(userId: string): Promise<void> {
    try {
      const prisma = getPrismaClient();
      await prisma.user.update({
        where: { id: userId },
        data: {
          usageStats: {
            articlesAnalyzed: 0,
            searchesPerformed: 0,
            chatMessages: 0
          }
        }
      });
    } catch (error) {
      console.error('[UserStatsTracker] Error resetting monthly stats:', error);
    }
  }
}
