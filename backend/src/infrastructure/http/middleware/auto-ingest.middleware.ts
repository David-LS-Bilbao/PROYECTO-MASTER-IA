/**
 * Auto-Ingest Middleware (Sprint 35)
 *
 * Automatically triggers background ingestion when user enters the app
 * if the last ingestion was more than X minutes ago.
 *
 * DESIGN:
 * - Non-blocking: Calls next() immediately (fire-and-forget pattern)
 * - Background execution: Ingestion runs asynchronously after response sent
 * - Error handling: Failures are logged but don't crash the server
 * - Threshold: Default 60 minutes (configurable)
 *
 * SECURITY:
 * - Rate limiting handled by IngestionTrackerRepository (global threshold)
 * - Prevents API cost explosion from concurrent users
 * - Only ONE global ingestion per threshold window
 */

import { Request, Response, NextFunction } from 'express';
import { IngestionTrackerRepository } from '../../persistence/ingestion-tracker.repository';
import { IngestNewsUseCase } from '../../../application/use-cases/ingest-news.usecase';

/**
 * Factory function to create auto-ingest middleware with dependencies
 */
export function createAutoIngestMiddleware(
  ingestionTracker: IngestionTrackerRepository,
  ingestUseCase: IngestNewsUseCase,
  thresholdMinutes: number = 60
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // CRITICAL: Call next() FIRST to avoid blocking the request
    // Background task runs asynchronously after response is sent
    next();

    try {
      // Check if ingestion should be triggered (non-blocking)
      const shouldTrigger = await ingestionTracker.shouldTriggerIngestion(thresholdMinutes);

      if (!shouldTrigger) {
        // Threshold not exceeded - skip ingestion
        return;
      }

      // Fire-and-forget: Trigger ingestion in background
      console.log('[Auto-Ingest] 🔄 Triggering background ingestion...');
      console.log(`   Threshold: ${thresholdMinutes} minutes`);
      console.log(`   User IP: ${req.ip}`);

      // Execute ingestion asynchronously (don't await - fire-and-forget)
      ingestUseCase
        .ingestAll()
        .then(async (result) => {
          console.log('[Auto-Ingest] ✅ Background ingestion completed');
          console.log(`   Processed: ${result.processed} categories`);
          console.log(`   Errors: ${result.errors}`);

          // Update timestamp AFTER successful ingestion
          await ingestionTracker.updateLastIngestionTime();
        })
        .catch((error) => {
          // Log error but don't crash the server
          console.error('[Auto-Ingest] ❌ Background ingestion failed:', error);
          console.error('   Error will be retried on next user request');
        });
    } catch (error) {
      // Error checking threshold - log and continue
      console.error('[Auto-Ingest] ⚠️ Failed to check ingestion threshold:', error);
    }
  };
}
