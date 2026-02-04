/**
 * Search Controller (Infrastructure/Presentation Layer)
 * Handles HTTP requests for semantic search
 */

import { Request, Response } from 'express';
import { SearchNewsUseCase } from '../../../application/use-cases/search-news.usecase';
import { ValidationError } from '../../../domain/errors/domain.error';
import { ExternalAPIError, DatabaseError } from '../../../domain/errors/infrastructure.error';
import { UserStatsTracker } from '../../monitoring/user-stats-tracker';

export class SearchController {
  constructor(private readonly searchNewsUseCase: SearchNewsUseCase) {}

  /**
   * GET /api/search?q=query&limit=10
   * Semantic search for news articles
   */
  async search(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      if (!query || query.trim().length < 2) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Query parameter "q" is required and must be at least 2 characters',
        });
        return;
      }

      const result = await this.searchNewsUseCase.execute({
        query: query.trim(),
        limit,
      });

      // Track user stats (if authenticated)
      if (req.user?.uid) {
        UserStatsTracker.incrementSearches(req.user.uid, 1).catch(err => 
          console.error('[SearchController] Failed to track search:', err)
        );
      }

      // Map domain entities to API response format
      const searchResults = result.results.map((article) => {
        const json = article.toJSON();
        return {
          id: json.id,
          title: json.title,
          description: json.description,
          content: json.content,
          url: json.url,
          urlToImage: json.urlToImage,
          source: json.source,
          author: json.author,
          publishedAt: json.publishedAt,
          category: json.category,
          language: json.language,
          summary: json.summary,
          biasScore: json.biasScore,
          analysis: json.analysis ? this.safeParseJSON(json.analysis) : null,
          analyzedAt: json.analyzedAt,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          query: result.query,
          results: searchResults,
          totalFound: result.totalFound,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Safely parse JSON string
   */
  private safeParseJSON(jsonString: string): unknown {
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  }

  /**
   * Centralized error handling
   */
  private handleError(error: unknown, res: Response): void {
    console.error('SearchController Error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message,
      });
      return;
    }

    if (error instanceof ExternalAPIError) {
      res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: `Search service temporarily unavailable: ${error.message}`,
      });
      return;
    }

    if (error instanceof DatabaseError) {
      res.status(500).json({
        success: false,
        error: 'Database Error',
        message: 'Failed to retrieve search results',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred during search',
    });
  }
}
