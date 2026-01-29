/**
 * Analyze Controller (Infrastructure/Presentation Layer)
 * Handles HTTP requests for article analysis
 */

import { Request, Response } from 'express';
import { AnalyzeArticleUseCase } from '../../../application/use-cases/analyze-article.usecase';
import { analyzeArticleSchema, analyzeBatchSchema } from '../schemas/analyze.schema';
import { ValidationError, EntityNotFoundError } from '../../../domain/errors/domain.error';
import {
  ExternalAPIError,
  DatabaseError,
  InfrastructureError,
} from '../../../domain/errors/infrastructure.error';
import { ZodError } from 'zod';

export class AnalyzeController {
  constructor(private readonly analyzeArticleUseCase: AnalyzeArticleUseCase) {}

  /**
   * POST /api/analyze/article
   * Analyze a single article by ID
   */
  async analyzeArticle(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body with Zod (Shift Left Security)
      const validatedInput = analyzeArticleSchema.parse(req.body);

      // Execute use case
      const result = await this.analyzeArticleUseCase.execute(validatedInput);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Article analyzed successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * POST /api/analyze/batch
   * Analyze multiple unanalyzed articles
   */
  async analyzeBatch(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body with Zod
      const validatedInput = analyzeBatchSchema.parse(req.body);

      // Execute use case
      const result = await this.analyzeArticleUseCase.executeBatch(validatedInput);

      res.status(200).json({
        success: true,
        data: result,
        message: `Processed ${result.processed} articles: ${result.successful} successful, ${result.failed} failed`,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * GET /api/analyze/stats
   * Get analysis statistics
   */
  async getStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.analyzeArticleUseCase.getStats();

      res.status(200).json({
        success: true,
        data: stats,
        message: `${stats.percentAnalyzed}% of articles analyzed`,
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

    // Entity not found errors
    if (error instanceof EntityNotFoundError) {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message,
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
