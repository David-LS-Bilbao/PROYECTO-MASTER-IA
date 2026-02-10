/**
 * CleanupNewsJob Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CleanupNewsJob } from '../../../src/infrastructure/jobs/cleanup-news.job';

// ============================================================================
// MOCKS (hoisted)
// ============================================================================

const { mockSchedule, mockTask } = vi.hoisted(() => ({
  mockTask: {
    stop: vi.fn(),
    destroy: vi.fn(),
  },
  mockSchedule: vi.fn(),
}));

vi.mock('node-cron', () => ({
  default: { schedule: mockSchedule },
  schedule: mockSchedule,
}));

// ============================================================================
// TESTS
// ============================================================================

describe('CleanupNewsJob', () => {
  let prisma: any;
  let job: CleanupNewsJob;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSchedule.mockReturnValue(mockTask as any);

    prisma = {
      article: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      favorite: {
        findMany: vi.fn(),
      },
    };

    job = new CleanupNewsJob(prisma as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runCleanup retorna 0 si no hay articulos antiguos', async () => {
    prisma.article.findMany.mockResolvedValueOnce([]);

    const result = await job.runCleanup();

    expect(result).toEqual({ deletedCount: 0, preservedCount: 0 });
    expect(prisma.article.deleteMany).not.toHaveBeenCalled();
  });

  it('runCleanup borra solo no favoritos', async () => {
    prisma.article.findMany.mockResolvedValueOnce([
      { id: 'a1', title: 'A1', publishedAt: new Date() },
      { id: 'a2', title: 'A2', publishedAt: new Date() },
    ]);
    prisma.favorite.findMany.mockResolvedValueOnce([{ articleId: 'a1' }]);
    prisma.article.deleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await job.runCleanup();

    expect(prisma.article.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['a2'] } },
    });
    expect(result).toEqual({ deletedCount: 1, preservedCount: 1 });
  });

  it('runCleanup no borra si todos son favoritos', async () => {
    prisma.article.findMany.mockResolvedValueOnce([
      { id: 'a1', title: 'A1', publishedAt: new Date() },
      { id: 'a2', title: 'A2', publishedAt: new Date() },
    ]);
    prisma.favorite.findMany.mockResolvedValueOnce([
      { articleId: 'a1' },
      { articleId: 'a2' },
    ]);

    const result = await job.runCleanup();

    expect(prisma.article.deleteMany).not.toHaveBeenCalled();
    expect(result).toEqual({ deletedCount: 0, preservedCount: 2 });
  });

  it('runCleanup maneja errores y retorna 0', async () => {
    prisma.article.findMany.mockRejectedValueOnce(new Error('DB error'));

    const result = await job.runCleanup();

    expect(result).toEqual({ deletedCount: 0, preservedCount: 0 });
  });

  it('start agenda el cron job', () => {
    job.start();

    expect(mockSchedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function));
  });

  it('stop detiene y destruye la tarea', () => {
    job.start();
    job.stop();

    expect(mockTask.stop).toHaveBeenCalled();
    expect(mockTask.destroy).toHaveBeenCalled();
  });
});
