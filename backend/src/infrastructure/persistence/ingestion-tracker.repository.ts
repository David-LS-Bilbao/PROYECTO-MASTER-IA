/**
 * Ingestion Tracker Repository (Sprint 35)
 *
 * Tracks last global auto-ingestion timestamp to prevent excessive API calls.
 *
 * STRATEGY:
 * - Uses existing IngestMetadata table with source='AUTO_TRIGGER'
 * - Single record (upsert pattern) to avoid duplicates
 * - Timestamp persists across server restarts
 */

import { PrismaClient } from '@prisma/client';

export class IngestionTrackerRepository {
  private readonly AUTO_TRIGGER_SOURCE = 'AUTO_TRIGGER';

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get last auto-ingestion timestamp
   * Returns null if never executed
   */
  async getLastIngestionTime(): Promise<Date | null> {
    const record = await this.prisma.ingestMetadata.findFirst({
      where: { source: this.AUTO_TRIGGER_SOURCE },
      orderBy: { lastFetch: 'desc' },
    });

    return record?.lastFetch ?? null;
  }

  /**
   * Update last auto-ingestion timestamp to NOW
   * Uses upsert to avoid duplicate records
   */
  async updateLastIngestionTime(): Promise<void> {
    // Find existing record
    const existing = await this.prisma.ingestMetadata.findFirst({
      where: { source: this.AUTO_TRIGGER_SOURCE },
    });

    if (existing) {
      // Update existing record
      await this.prisma.ingestMetadata.update({
        where: { id: existing.id },
        data: {
          lastFetch: new Date(),
          status: 'success',
          articlesCount: 0, // Not tracking count for auto-trigger
        },
      });
    } else {
      // Create new record
      await this.prisma.ingestMetadata.create({
        data: {
          source: this.AUTO_TRIGGER_SOURCE,
          lastFetch: new Date(),
          status: 'success',
          articlesCount: 0,
        },
      });
    }
  }

  /**
   * Check if auto-ingestion should be triggered
   * Returns true if last ingestion > thresholdMinutes ago (or never executed)
   */
  async shouldTriggerIngestion(thresholdMinutes: number = 60): Promise<boolean> {
    const lastTime = await this.getLastIngestionTime();

    if (!lastTime) {
      // Never executed - should trigger
      return true;
    }

    const minutesSinceLastFetch = (Date.now() - lastTime.getTime()) / (1000 * 60);
    return minutesSinceLastFetch >= thresholdMinutes;
  }
}
