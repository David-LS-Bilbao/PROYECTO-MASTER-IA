/**
 * NewsController (Infrastructure/Presentation Layer)
 * Handles HTTP requests for news articles
 */

import { Request, Response } from 'express';
import { INewsArticleRepository } from '../../../domain/repositories/news-article.repository';
import { ToggleFavoriteUseCase } from '../../../application/use-cases/toggle-favorite.usecase';
import { NewsArticle } from '../../../domain/entities/news-article.entity';

/**
 * Transform domain article to HTTP response format
 * Parses the analysis JSON string into an object for frontend consumption
 */
function toHttpResponse(article: NewsArticle) {
  const json = article.toJSON();
  return {
    ...json,
    // Parse analysis from JSON string to object (if exists)
    analysis: json.analysis ? JSON.parse(json.analysis) : null,
  };
}

export class NewsController {
  constructor(
    private readonly repository: INewsArticleRepository,
    private readonly toggleFavoriteUseCase: ToggleFavoriteUseCase
  ) {}

  /**
   * GET /api/news
   * Get all news with pagination and optional filters
   */
  async getNews(req: Request, res: Response): Promise<void> {
    try {
      // Parse query parameters with type casting
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;
      const category = req.query.category as string | undefined;
      const onlyFavorites = req.query.favorite === 'true';

      // Fetch articles using unified findAll with params object
      const news = await this.repository.findAll({
        limit,
        offset,
        category,
        onlyFavorites,
      });

      // Get count for pagination (filtered or total)
      const total = category || onlyFavorites
        ? await this.repository.countFiltered({ category, onlyFavorites })
        : await this.repository.count();

      // Transform articles to HTTP response format (parse analysis JSON)
      const data = news.map(toHttpResponse);

      res.json({
        success: true,
        data,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + news.length < total,
        },
      });
    } catch (error) {
      console.error('Error fetching news:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * GET /api/news/:id
   * Get a single news article by ID
   */
  async getNewsById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Missing article ID',
        });
        return;
      }

      const article = await this.repository.findById(id);

      if (!article) {
        res.status(404).json({
          success: false,
          error: 'Article not found',
        });
        return;
      }

      res.json({
        success: true,
        data: toHttpResponse(article),
      });
    } catch (error) {
      console.error('Error fetching article:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * PATCH /api/news/:id/favorite
   * Toggle favorite status of an article
   */
  async toggleFavorite(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      console.log(`❤️ Toggling favorite for ID: ${id}`);

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Missing article ID',
        });
        return;
      }

      // Execute use case with { id } object
      const result = await this.toggleFavoriteUseCase.execute({ id });

      res.json({
        success: true,
        data: toHttpResponse(result.article),
        isFavorite: result.isFavorite,
      });
    } catch (error: any) {
      console.error('Error toggling favorite:', error);

      // Handle domain errors (article not found)
      if (error.message?.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  }
}
