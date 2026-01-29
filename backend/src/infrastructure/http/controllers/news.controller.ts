/**
 * News Controller (Infrastructure/Presentation Layer)
 * Handles HTTP requests for fetching news articles
 */

import { Request, Response } from 'express';
import { INewsArticleRepository } from '../../../domain/repositories/news-article.repository';
import { DatabaseError } from '../../../domain/errors/infrastructure.error';

export class NewsController {
  constructor(private readonly articleRepository: INewsArticleRepository) {}

  /**
   * GET /api/news
   * Get all news articles with optional pagination
   */
  async getNews(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const articles = await this.articleRepository.findAll(limit, offset);
      const total = await this.articleRepository.count();

      // Map domain entities to API response format
      const newsData = articles.map((article) => {
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
          // AI Analysis fields
          summary: json.summary,
          biasScore: json.biasScore,
          analysis: json.analysis ? this.safeParseJSON(json.analysis) : null,
          analyzedAt: json.analyzedAt,
        };
      });

      res.status(200).json({
        success: true,
        data: newsData,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * GET /api/news/:id
   * Get a single news article by ID
   */
  async getNewsById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const article = await this.articleRepository.findById(id);

      if (!article) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Article with ID ${id} not found`,
        });
        return;
      }

      const json = article.toJSON();
      res.status(200).json({
        success: true,
        data: {
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
    console.error('NewsController Error:', error);

    if (error instanceof DatabaseError) {
      res.status(500).json({
        success: false,
        error: 'Database Error',
        message: 'Failed to fetch news data',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  }
}
