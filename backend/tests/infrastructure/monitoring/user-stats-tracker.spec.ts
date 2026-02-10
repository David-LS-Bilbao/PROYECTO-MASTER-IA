/**
 * UserStatsTracker Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserStatsTracker } from '../../../src/infrastructure/monitoring/user-stats-tracker';

const { mockFindUnique, mockUpdate, mockGetPrismaClient } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockGetPrismaClient: vi.fn(),
}));

vi.mock('../../../src/infrastructure/persistence/prisma.client', () => ({
  getPrismaClient: mockGetPrismaClient,
}));

describe('UserStatsTracker', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    mockGetPrismaClient.mockReturnValue({
      user: {
        findUnique: mockFindUnique,
        update: mockUpdate,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('incrementArticlesAnalyzed suma conteo', async () => {
    mockFindUnique.mockResolvedValueOnce({
      usageStats: { articlesAnalyzed: 2, searchesPerformed: 0, chatMessages: 0 },
    });

    await UserStatsTracker.incrementArticlesAnalyzed('u1', 3);

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        usageStats: expect.objectContaining({ articlesAnalyzed: 5 }),
      },
    }));
  });

  it('incrementArticlesAnalyzed retorna si usuario no existe', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await UserStatsTracker.incrementArticlesAnalyzed('u2');

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('incrementSearches usa defaults cuando no hay stats', async () => {
    mockFindUnique.mockResolvedValueOnce({ usageStats: null });

    await UserStatsTracker.incrementSearches('u3', 2);

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        usageStats: expect.objectContaining({ searchesPerformed: 2 }),
      },
    }));
  });

  it('incrementChatMessages maneja errores sin lanzar', async () => {
    mockFindUnique.mockRejectedValueOnce(new Error('db error'));

    await expect(UserStatsTracker.incrementChatMessages('u4')).resolves.toBeUndefined();
  });

  it('resetMonthlyStats actualiza a cero', async () => {
    mockUpdate.mockResolvedValueOnce({});

    await UserStatsTracker.resetMonthlyStats('u5');

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        usageStats: {
          articlesAnalyzed: 0,
          searchesPerformed: 0,
          chatMessages: 0,
        },
      },
    }));
  });
});
