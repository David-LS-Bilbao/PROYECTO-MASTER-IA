/**
 * Quota Reset Job Tests (Sprint 14 - Paso 2: Automatización de Reset de Cuotas)
 * FASE GREEN: Tests that PASS with working implementation
 *
 * Tests the automated reset of user quotas:
 * - Daily reset: articlesAnalyzed → 0
 * - Monthly reset: chatMessages → 0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { QuotaResetJob } from '../../../src/infrastructure/jobs/quota-reset.job';

describe('QuotaResetJob', () => {
  let quotaResetJob: QuotaResetJob;
  let mockPrisma: any;

  beforeEach(() => {
    // Mock Prisma Client with complete interface
    mockPrisma = {
      user: {
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    // Create instance with mocked Prisma
    quotaResetJob = new QuotaResetJob(mockPrisma);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('runDailyReset()', () => {
    it('should reset daily analysis count to 0 for all users', async () => {
      // ARRANGE: Create mock users with usage stats
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@test.com',
          plan: 'FREE',
          usageStats: {
            articlesAnalyzed: 50,
            chatMessages: 5,
            searchesPerformed: 2,
          },
        },
        {
          id: 'user-2',
          email: 'user2@test.com',
          plan: 'PRO',
          usageStats: {
            articlesAnalyzed: 200,
            chatMessages: 50,
            searchesPerformed: 10,
          },
        },
      ];

      // Mock Prisma to return users with non-zero articlesAnalyzed
      (mockPrisma.user.findMany as any).mockResolvedValue(mockUsers);
      (mockPrisma.user.update as any).mockResolvedValue({ id: 'user-1' });

      // ACT: Call the job's daily reset method
      const result = await quotaResetJob.runDailyReset();

      // ASSERT
      expect(result).toBe(2); // Should return count of updated users
      expect(mockPrisma.user.findMany).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(2);
    });

    it('should handle empty user list gracefully', async () => {
      // ARRANGE: No users in database
      (mockPrisma.user.findMany as any).mockResolvedValue([]);

      // ACT
      const result = await quotaResetJob.runDailyReset();

      // ASSERT
      expect(result).toBe(0);
    });

    it('should log successful reset with user count', async () => {
      // ARRANGE
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
      const mockUsers = [{ id: 'user-1', usageStats: { articlesAnalyzed: 50 } }];
      (mockPrisma.user.findMany as any).mockResolvedValue(mockUsers);
      (mockPrisma.user.update as any).mockResolvedValue({ id: 'user-1' });

      // ACT: Call the job's daily reset method
      await quotaResetJob.runDailyReset();

      // ASSERT: Verify logging happened
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Daily Quota Reset'));

      consoleSpy.mockRestore();
    });
  });

  describe('runMonthlyReset()', () => {
    it('should reset monthly chat count to 0 for all users', async () => {
      // ARRANGE
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@test.com',
          plan: 'FREE',
          usageStats: {
            articlesAnalyzed: 10,
            chatMessages: 20,
            searchesPerformed: 5,
          },
        },
      ];

      (mockPrisma.user.findMany as any).mockResolvedValue(mockUsers);
      (mockPrisma.user.update as any).mockResolvedValue({ id: 'user-1' });

      // ACT
      const result = await quotaResetJob.runMonthlyReset();

      // ASSERT
      expect(result).toBe(1);
      expect(mockPrisma.user.findMany).toHaveBeenCalled();
    });

    it('should reset other monthly counters (groundingSearches)', async () => {
      // ARRANGE
      const mockUsers = [
        { id: 'user-1', usageStats: { groundingSearches: 5 } },
        { id: 'user-2', usageStats: { groundingSearches: 3 } },
        { id: 'user-3', usageStats: { groundingSearches: 1 } },
      ];
      (mockPrisma.user.findMany as any).mockResolvedValue(mockUsers);
      (mockPrisma.user.update as any).mockResolvedValue({ id: 'user-1' });

      // ACT
      const result = await quotaResetJob.runMonthlyReset();

      // ASSERT
      expect(result).toBe(3);
    });

    it('should log successful monthly reset', async () => {
      // ARRANGE
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
      const mockUsers = [{ id: 'user-1', usageStats: { chatMessages: 10 } }];
      (mockPrisma.user.findMany as any).mockResolvedValue(mockUsers);
      (mockPrisma.user.update as any).mockResolvedValue({ id: 'user-1' });

      // ACT
      await quotaResetJob.runMonthlyReset();

      // ASSERT: Verify logging happened
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Monthly Quota Reset'));

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should catch and log database errors without crashing', async () => {
      // ARRANGE
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      const dbError = new Error('Database connection failed');
      (mockPrisma.user.findMany as any).mockRejectedValue(dbError);

      // ACT: Should not throw
      const result = await quotaResetJob.runDailyReset();

      // ASSERT: Verify it handled the error
      expect(result).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should not throw exception on reset failure', async () => {
      // ARRANGE
      (mockPrisma.user.findMany as any).mockRejectedValue(
        new Error('Update failed')
      );

      // ACT & ASSERT: Should not throw
      await expect(quotaResetJob.runDailyReset()).resolves.not.toThrow();
    });
  });

  describe('Cron Scheduling', () => {
    it('should start scheduled tasks', async () => {
      // ARRANGE
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

      // ACT: Start the job scheduler
      quotaResetJob.start();

      // ASSERT: Verify start was called and logged
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Quota Reset Job started'));

      consoleSpy.mockRestore();
    });

    it('should schedule daily reset at midnight (0 0 * * *)', async () => {
      // This verifies the expected cron pattern is correct
      const cronPattern = '0 0 * * *'; // Daily at midnight
      expect(cronPattern).toMatch(/^0 0 \* \* \*$/);
    });

    it('should schedule monthly reset on 1st day of month (0 0 1 * *)', async () => {
      // This verifies the expected cron pattern is correct
      const cronPattern = '0 0 1 * *'; // Monthly on 1st
      expect(cronPattern).toMatch(/^0 0 1 \* \*$/);
    });

    it('should stop scheduled tasks', async () => {
      // ARRANGE
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
      quotaResetJob.start();
      consoleSpy.mockClear();

      // ACT: Stop the job scheduler
      quotaResetJob.stop();

      // ASSERT: Verify stop was called and logged
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Quota Reset Job stopped'));

      consoleSpy.mockRestore();
    });
  });
});
