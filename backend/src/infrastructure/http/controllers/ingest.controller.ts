/**
 * Ingest Controller (Infrastructure/Presentation Layer)
 * Handles HTTP requests for news ingestion
 */

import { Request, Response } from 'express';
import { IngestNewsUseCase } from '../../../application/use-cases/ingest-news.usecase';
import { ingestNewsSchema } from '../schemas/ingest.schema';
import { ValidationError } from '../../../domain/errors/domain.error';
import {
  ExternalAPIError,
  DatabaseError,
  InfrastructureError,
} from '../../../domain/errors/infrastructure.error';
import { ZodError } from 'zod';

export class IngestController {
  constructor(private readonly ingestNewsUseCase: IngestNewsUseCase) {}

  /**
   * POST /api/ingest/news
   * Trigger manual news ingestion
   */
  async ingestNews(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body with Zod (Shift Left Security)
      const validatedInput = ingestNewsSchema.parse(req.body);

      // Execute use case
      const result = await this.ingestNewsUseCase.execute(validatedInput);

      res.status(200).json({
        success: true,
        data: result,
        message: `Successfully ingested ${result.newArticles} new articles`,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * GET /api/ingest/status
   * Get last ingestion status
   */
  async getIngestionStatus(_req: Request, res: Response): Promise<void> {
    try {
      // This would query the IngestMetadata table
      // For now, return a simple response
      res.status(200).json({
        success: true,
        message: 'Ingestion status endpoint',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * POST /api/ingest/all
   * Trigger global ingestion for ALL categories
   */
  async ingestAllNews(_req: Request, res: Response): Promise<void> {
    try {
      console.log('🌍 [IngestController] Global ingestion triggered');

      // Execute global ingestion
      const result = await this.ingestNewsUseCase.ingestAll();

      // Calculate totals
      const totalNew = Object.values(result.results).reduce(
        (sum, r) => sum + r.newArticles,
        0
      );
      const totalDuplicates = Object.values(result.results).reduce(
        (sum, r) => sum + r.duplicates,
        0
      );

      res.status(200).json({
        success: true,
        data: {
          processed: result.processed,
          errors: result.errors,
          totalNewArticles: totalNew,
          totalDuplicates: totalDuplicates,
          categoryResults: result.results,
        },
        message: `Global ingestion completed: ${result.processed} categories processed, ${totalNew} new articles`,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Centralized error handling
   */
  private handleError(error: unknown, res: Response): void {
    console.error('Controller Error:', error);

    // Zod validation errors
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }

    // Domain validation errors
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message,
      });
      return;
    }

    // External API errors
    if (error instanceof ExternalAPIError) {
      res.status(error.statusCode || 502).json({
        success: false,
        error: 'External API Error',
        message: error.message,
        service: error.service,
      });
      return;
    }

    // Database errors
    if (error instanceof DatabaseError) {
      res.status(500).json({
        success: false,
        error: 'Database Error',
        message: 'Failed to persist data',
      });
      return;
    }

    // Infrastructure errors
    if (error instanceof InfrastructureError) {
      res.status(500).json({
        success: false,
        error: 'Infrastructure Error',
        message: error.message,
      });
      return;
    }

    // Unknown errors
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  }
}
