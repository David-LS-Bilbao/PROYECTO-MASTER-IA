/**
 * News Cleanup Job (Sprint 19.5 - Tarea 1: Limpieza Automática)
 *
 * Automated Cron Job for cleaning up old news articles:
 * - Runs daily at 2:00 AM UTC (0 2 * * *)
 * - Deletes articles older than 30 days
 * - PRESERVES articles that are favorited by any user
 *
 * Business Rules:
 * 1. Article age is calculated from publishedAt field
 * 2. An article is preserved if it exists in the Favorite table (any userId)
 * 3. Deletion is permanent and cannot be undone
 *
 * Error Handling:
 * - Catches database errors and logs them without crashing the server
 * - Job continues running even if a single cleanup fails
 */

import cron, { ScheduledTask } from 'node-cron';
import { PrismaClient } from '@prisma/client';

export class CleanupNewsJob {
  private cleanupTask?: ScheduledTask;
  private readonly RETENTION_DAYS = 30;

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Deletes articles older than RETENTION_DAYS that are NOT favorited
   * Called daily at 2:00 AM (0 2 * * *)
   *
   * @returns Object with deletedCount and preservedCount
   */
  async runCleanup(): Promise<{ deletedCount: number; preservedCount: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

      console.log(`\n🧹 Starting News Cleanup Job...`);
      console.log(`   📅 Cutoff Date: ${cutoffDate.toISOString()}`);
      console.log(`   📅 Deleting articles published before: ${cutoffDate.toLocaleDateString()}`);

      // 1. Find all articles older than cutoff date
      const oldArticles = await this.prisma.article.findMany({
        where: {
          publishedAt: {
            lt: cutoffDate,
          },
        },
        select: {
          id: true,
          title: true,
          publishedAt: true,
        },
      });

      console.log(`   📊 Found ${oldArticles.length} old articles`);

      if (oldArticles.length === 0) {
        console.log(`   ✅ No old articles to clean up\n`);
        return { deletedCount: 0, preservedCount: 0 };
      }

      // 2. Get IDs of articles that are favorited (must be preserved)
      const favoritedArticleIds = await this.prisma.favorite.findMany({
        where: {
          articleId: {
            in: oldArticles.map(a => a.id),
          },
        },
        select: {
          articleId: true,
        },
        distinct: ['articleId'],
      });

      const favoritedIds = new Set(favoritedArticleIds.map(f => f.articleId));

      console.log(`   ❤️  Preserving ${favoritedIds.size} favorited articles`);

      // 3. Separate articles into deletable and preserved
      const articlesToDele = oldArticles.filter(a => !favoritedIds.has(a.id));
      const articlesToPreserve = oldArticles.filter(a => favoritedIds.has(a.id));

      console.log(`   🗑️  Deleting ${articlesToDele.length} non-favorited articles`);

      if (articlesToDele.length > 0) {
        // Log first 3 articles to be deleted (for debugging)
        console.log(`   📰 Sample articles to delete:`);
        articlesToDele.slice(0, 3).forEach(article => {
          console.log(`      - [${article.id.substring(0, 8)}...] ${article.title.substring(0, 50)}...`);
        });

        // 4. Delete articles that are not favorited
        const deleteResult = await this.prisma.article.deleteMany({
          where: {
            id: {
              in: articlesToDele.map(a => a.id),
            },
          },
        });

        console.log(`   ✅ Successfully deleted ${deleteResult.count} articles`);
      }

      console.log(`   ✅ News Cleanup Job completed\n`);

      return {
        deletedCount: articlesToDele.length,
        preservedCount: articlesToPreserve.length,
      };
    } catch (error) {
      console.error('[CleanupNewsJob] Cleanup failed:', error);
      // Don't re-throw: let the server continue running
      return { deletedCount: 0, preservedCount: 0 };
    }
  }

  /**
   * Starts the cron job
   * Runs daily at 2:00 AM UTC (0 2 * * *)
   *
   * This should be called once on server startup
   */
  start(): void {
    try {
      // Schedule cleanup at 2:00 AM daily (low traffic time)
      this.cleanupTask = cron.schedule('0 2 * * *', async () => {
        await this.runCleanup();
      });

      console.log('✅ News Cleanup Job started');
      console.log('   🗑️  Daily cleanup: Every day at 02:00 (UTC)');
      console.log(`   📅 Retention period: ${this.RETENTION_DAYS} days`);
    } catch (error) {
      console.error('[CleanupNewsJob] Failed to start:', error);
      throw error; // Critical: can't continue without job scheduler
    }
  }

  /**
   * Stops the cron job
   * Should be called on graceful shutdown
   */
  stop(): void {
    if (this.cleanupTask) {
      this.cleanupTask.stop();
      this.cleanupTask.destroy();
    }

    console.log('⏹️  News Cleanup Job stopped');
  }

  /**
   * Manual cleanup trigger (for testing or manual execution)
   * Can be called from an admin endpoint if needed
   */
  async manualCleanup(): Promise<{ deletedCount: number; preservedCount: number }> {
    console.log('🔧 Manual cleanup triggered');
    return this.runCleanup();
  }
}
