/**
 * Ingestion Tracker Repository - TDD Tests (Sprint 35)
 * Tracks last global auto-ingestion timestamp
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IngestionTrackerRepository } from '../../../src/infrastructure/persistence/ingestion-tracker.repository';

describe('🟢 GREEN: IngestionTrackerRepository (Sprint 35)', () => {
  let prisma: any;
  let repository: IngestionTrackerRepository;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock PrismaClient
    prisma = {
      ingestMetadata: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
    };

    repository = new IngestionTrackerRepository(prisma);
  });

  it('🟢 GREEN: getLastIngestionTime() returns null when no record exists', async () => {
    prisma.ingestMetadata.findFirst.mockResolvedValue(null);

    const lastTime = await repository.getLastIngestionTime();

    expect(lastTime).toBeNull();
    expect(prisma.ingestMetadata.findFirst).toHaveBeenCalledWith({
      where: { source: 'AUTO_TRIGGER' },
      orderBy: { lastFetch: 'desc' },
    });
  });

  it('🟢 GREEN: updateLastIngestionTime() creates new record when none exists', async () => {
    prisma.ingestMetadata.findFirst.mockResolvedValue(null);
    prisma.ingestMetadata.create.mockResolvedValue({
      id: 'test-id',
      source: 'AUTO_TRIGGER',
      lastFetch: new Date(),
      status: 'success',
      articlesCount: 0,
    });

    await repository.updateLastIngestionTime();

    expect(prisma.ingestMetadata.findFirst).toHaveBeenCalled();
    expect(prisma.ingestMetadata.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'AUTO_TRIGGER',
        status: 'success',
        articlesCount: 0,
      }),
    });
  });

  it('🟢 GREEN: getLastIngestionTime() returns timestamp from record', async () => {
    const mockDate = new Date('2026-02-17T12:00:00Z');
    prisma.ingestMetadata.findFirst.mockResolvedValue({
      id: 'test-id',
      source: 'AUTO_TRIGGER',
      lastFetch: mockDate,
      status: 'success',
      articlesCount: 0,
    });

    const lastTime = await repository.getLastIngestionTime();

    expect(lastTime).toEqual(mockDate);
  });

  it('🟢 GREEN: updateLastIngestionTime() updates existing record', async () => {
    const existingRecord = {
      id: 'existing-id',
      source: 'AUTO_TRIGGER',
      lastFetch: new Date('2026-02-17T11:00:00Z'),
      status: 'success',
      articlesCount: 0,
    };

    prisma.ingestMetadata.findFirst.mockResolvedValue(existingRecord);
    prisma.ingestMetadata.update.mockResolvedValue({
      ...existingRecord,
      lastFetch: new Date(),
    });

    await repository.updateLastIngestionTime();

    expect(prisma.ingestMetadata.update).toHaveBeenCalledWith({
      where: { id: 'existing-id' },
      data: expect.objectContaining({
        status: 'success',
        articlesCount: 0,
      }),
    });
    expect(prisma.ingestMetadata.create).not.toHaveBeenCalled();
  });

  it('🟢 GREEN: shouldTriggerIngestion() returns true when never executed', async () => {
    prisma.ingestMetadata.findFirst.mockResolvedValue(null);

    const shouldTrigger = await repository.shouldTriggerIngestion(60);

    expect(shouldTrigger).toBe(true);
  });

  it('🟢 GREEN: shouldTriggerIngestion() returns true when threshold exceeded', async () => {
    // Last fetch was 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    prisma.ingestMetadata.findFirst.mockResolvedValue({
      id: 'test-id',
      source: 'AUTO_TRIGGER',
      lastFetch: twoHoursAgo,
      status: 'success',
      articlesCount: 0,
    });

    const shouldTrigger = await repository.shouldTriggerIngestion(60); // 60 min threshold

    expect(shouldTrigger).toBe(true);
  });

  it('🟢 GREEN: shouldTriggerIngestion() returns false when threshold not exceeded', async () => {
    // Last fetch was 30 minutes ago
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    prisma.ingestMetadata.findFirst.mockResolvedValue({
      id: 'test-id',
      source: 'AUTO_TRIGGER',
      lastFetch: thirtyMinutesAgo,
      status: 'success',
      articlesCount: 0,
    });

    const shouldTrigger = await repository.shouldTriggerIngestion(60); // 60 min threshold

    expect(shouldTrigger).toBe(false);
  });
});
