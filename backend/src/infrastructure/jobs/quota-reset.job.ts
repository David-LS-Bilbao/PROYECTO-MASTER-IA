/**
 * Quota Reset Job (Sprint 14 - Paso 2: Automatización de Reset de Cuotas)
 *
 * Automated Cron Jobs for resetting user quotas:
 * - Daily Reset (0 0 * * *): Resets articlesAnalyzed to 0 for all users at midnight
 * - Monthly Reset (0 0 1 * *): Resets chatMessages and groundingSearches to 0 on 1st of month
 *
 * Error Handling:
 * - Catches database errors and logs them without crashing the server
 * - Job continues running even if a single reset fails
 */

import cron, { ScheduledTask } from 'node-cron';
import { PrismaClient } from '@prisma/client';

export class QuotaResetJob {
  private dailyTask?: ScheduledTask;
  private monthlyTask?: ScheduledTask;

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Resets daily analysis quota (articlesAnalyzed) for all users
   * Called daily at midnight (0 0 * * *)
   *
   * @returns Number of users updated
   */
  async runDailyReset(): Promise<number> {
    try {
      // Get all users to preserve other fields in usageStats
      const users = await this.prisma.user.findMany();

      let updatedCount = 0;

      // Update each user's articlesAnalyzed counter to 0
      // We need to use individual updates to preserve other usageStats fields
      for (const user of users) {
        const currentStats = (user.usageStats as any) || {};
        const updatedStats = {
          ...currentStats,
          articlesAnalyzed: 0,
        };

        await this.prisma.user.update({
          where: { id: user.id },
          data: { usageStats: updatedStats },
        });

        updatedCount++;
      }

      console.log(`🔄 Daily Quota Reset executed: ${updatedCount} users updated`);
      return updatedCount;
    } catch (error) {
      console.error('[QuotaResetJob] Daily reset failed:', error);
      // Don't re-throw: let the server continue running
      return 0;
    }
  }

  /**
   * Resets monthly quotas for all users
   * Called on 1st of month at midnight (0 0 1 * *)
   * Resets: chatMessages, groundingSearches
   *
   * @returns Number of users updated
   */
  async runMonthlyReset(): Promise<number> {
    try {
      // Get all users
      const users = await this.prisma.user.findMany();

      let updatedCount = 0;

      // Update each user's monthly counters to 0
      for (const user of users) {
        const currentStats = (user.usageStats as any) || {};
        const updatedStats = {
          ...currentStats,
          chatMessages: 0,
          groundingSearches: 0,
        };

        await this.prisma.user.update({
          where: { id: user.id },
          data: { usageStats: updatedStats },
        });

        updatedCount++;
      }

      console.log(`📅 Monthly Quota Reset executed: ${updatedCount} users updated`);
      return updatedCount;
    } catch (error) {
      console.error('[QuotaResetJob] Monthly reset failed:', error);
      // Don't re-throw: let the server continue running
      return 0;
    }
  }

  /**
   * Starts the cron jobs
   * - Daily reset at midnight
   * - Monthly reset on 1st of month
   *
   * This should be called once on server startup
   */
  start(): void {
    try {
      // Schedule daily reset (every day at midnight)
      this.dailyTask = cron.schedule('0 0 * * *', async () => {
        await this.runDailyReset();
      });

      // Schedule monthly reset (1st of month at midnight)
      this.monthlyTask = cron.schedule('0 0 1 * *', async () => {
        await this.runMonthlyReset();
      });

      console.log('✅ Quota Reset Job started');
      console.log('   📅 Daily reset: Every day at 00:00 (UTC)');
      console.log('   📅 Monthly reset: 1st of month at 00:00 (UTC)');
    } catch (error) {
      console.error('[QuotaResetJob] Failed to start:', error);
      throw error; // Critical: can't continue without job scheduler
    }
  }

  /**
   * Stops the cron jobs
   * Should be called on graceful shutdown
   */
  stop(): void {
    if (this.dailyTask) {
      this.dailyTask.stop();
      this.dailyTask.destroy();
    }

    if (this.monthlyTask) {
      this.monthlyTask.stop();
      this.monthlyTask.destroy();
    }

    console.log('⏹️  Quota Reset Job stopped');
  }
}
