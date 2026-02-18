/**
 * Auto-Ingest Middleware - TDD Tests (Sprint 35)
 * Triggers background ingestion when threshold exceeded
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createAutoIngestMiddleware } from '../../../../src/infrastructure/http/middleware/auto-ingest.middleware';

describe('🟢 GREEN: Auto-Ingest Middleware (Sprint 35)', () => {
  let mockIngestionTracker: any;
  let mockIngestUseCase: any;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock dependencies
    mockIngestionTracker = {
      shouldTriggerIngestion: vi.fn(),
      updateLastIngestionTime: vi.fn(),
    };

    mockIngestUseCase = {
      ingestAll: vi.fn().mockResolvedValue({
        processed: 8,
        errors: 0,
        results: {},
      }),
    };

    // Mock Express objects
    req = {};
    res = {};
    next = vi.fn();
  });

  it('🟢 GREEN: calls next() immediately without blocking request', async () => {
    mockIngestionTracker.shouldTriggerIngestion.mockResolvedValue(true);

    const middleware = createAutoIngestMiddleware(mockIngestionTracker, mockIngestUseCase);

    // Execute middleware
    await middleware(req as Request, res as Response, next);

    // Should call next() immediately (non-blocking)
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('🔴 RED: triggers ingestion in background when threshold exceeded', async () => {
    mockIngestionTracker.shouldTriggerIngestion.mockResolvedValue(true);

    const middleware = createAutoIngestMiddleware(mockIngestionTracker, mockIngestUseCase);

    await middleware(req as Request, res as Response, next);

    // Wait for background task to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should trigger ingestion
    expect(mockIngestUseCase.ingestAll).toHaveBeenCalledTimes(1);
    expect(mockIngestionTracker.updateLastIngestionTime).toHaveBeenCalledTimes(1);
  });

  it('🔴 RED: skips ingestion when threshold not exceeded', async () => {
    mockIngestionTracker.shouldTriggerIngestion.mockResolvedValue(false);

    const middleware = createAutoIngestMiddleware(mockIngestionTracker, mockIngestUseCase);

    await middleware(req as Request, res as Response, next);

    // Wait to ensure no background task runs
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should NOT trigger ingestion
    expect(mockIngestUseCase.ingestAll).not.toHaveBeenCalled();
    expect(mockIngestionTracker.updateLastIngestionTime).not.toHaveBeenCalled();
  });

  it('🔴 RED: handles ingestion errors gracefully without crashing', async () => {
    mockIngestionTracker.shouldTriggerIngestion.mockResolvedValue(true);
    mockIngestUseCase.ingestAll.mockRejectedValue(new Error('API Error'));

    const middleware = createAutoIngestMiddleware(mockIngestionTracker, mockIngestUseCase);

    // Should not throw error
    await expect(middleware(req as Request, res as Response, next)).resolves.not.toThrow();

    // Should still call next() even if background task fails
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('🔴 RED: uses default threshold of 60 minutes', async () => {
    mockIngestionTracker.shouldTriggerIngestion.mockResolvedValue(false);

    const middleware = createAutoIngestMiddleware(mockIngestionTracker, mockIngestUseCase);

    await middleware(req as Request, res as Response, next);

    // Should check with 60 minute threshold by default
    expect(mockIngestionTracker.shouldTriggerIngestion).toHaveBeenCalledWith(60);
  });

  it('🔴 RED: accepts custom threshold', async () => {
    mockIngestionTracker.shouldTriggerIngestion.mockResolvedValue(false);

    const middleware = createAutoIngestMiddleware(
      mockIngestionTracker,
      mockIngestUseCase,
      120 // Custom 2-hour threshold
    );

    await middleware(req as Request, res as Response, next);

    // Should check with custom threshold
    expect(mockIngestionTracker.shouldTriggerIngestion).toHaveBeenCalledWith(120);
  });
});
