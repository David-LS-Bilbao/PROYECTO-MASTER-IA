import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../persistence/prisma.client', () => ({
  getPrismaClient: () => ({
    user: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  }),
}));

import { UserStatsTracker } from './user-stats-tracker';

describe('UserStatsTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('incrementArticlesAnalyzed increments counter', async () => {
    mockFindUnique.mockResolvedValueOnce({ usageStats: { articlesAnalyzed: 2, searchesPerformed: 1, chatMessages: 0 } });
    await UserStatsTracker.incrementArticlesAnalyzed('user-1', 3);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        usageStats: {
          articlesAnalyzed: 5,
          searchesPerformed: 1,
          chatMessages: 0,
        },
      },
    });
  });

  it('incrementSearches increments counter', async () => {
    mockFindUnique.mockResolvedValueOnce({ usageStats: { articlesAnalyzed: 0, searchesPerformed: 4, chatMessages: 1 } });
    await UserStatsTracker.incrementSearches('user-1', 2);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        usageStats: {
          articlesAnalyzed: 0,
          searchesPerformed: 6,
          chatMessages: 1,
        },
      },
    });
  });

  it('incrementChatMessages increments counter', async () => {
    mockFindUnique.mockResolvedValueOnce({ usageStats: { articlesAnalyzed: 1, searchesPerformed: 1, chatMessages: 5 } });
    await UserStatsTracker.incrementChatMessages('user-1', 1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        usageStats: {
          articlesAnalyzed: 1,
          searchesPerformed: 1,
          chatMessages: 6,
        },
      },
    });
  });

  it('resetMonthlyStats sets all counters to zero', async () => {
    await UserStatsTracker.resetMonthlyStats('user-1');
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        usageStats: {
          articlesAnalyzed: 0,
          searchesPerformed: 0,
          chatMessages: 0,
        },
      },
    });
  });

  it('returns early if user is not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    await UserStatsTracker.incrementArticlesAnalyzed('user-1', 1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
