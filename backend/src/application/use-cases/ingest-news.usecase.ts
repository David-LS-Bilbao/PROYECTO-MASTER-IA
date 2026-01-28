/**
 * IngestNewsUseCase (Application Layer)
 * Core business logic for news ingestion
 *
 * Responsibilities:
 * - Fetch news from external API
 * - Transform to domain entities
 * - Filter duplicates
 * - Persist to database
 * - Record ingestion metadata
 */

import { randomUUID } from 'crypto';
import { INewsAPIClient } from '../../domain/services/news-api-client.interface';
import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
import { NewsArticle } from '../../domain/entities/news-article.entity';
import { ValidationError } from '../../domain/errors/domain.error';
import { PrismaClient } from '@prisma/client';

export interface IngestNewsRequest {
  category?: string;
  language?: string;
  query?: string;
  pageSize?: number;
}

export interface IngestNewsResponse {
  success: boolean;
  totalFetched: number;
  newArticles: number;
  duplicates: number;
  errors: number;
  source: string;
  timestamp: Date;
}

export class IngestNewsUseCase {
  constructor(
    private readonly newsAPIClient: INewsAPIClient,
    private readonly articleRepository: INewsArticleRepository,
    private readonly prisma: PrismaClient
  ) {}

  async execute(request: IngestNewsRequest): Promise<IngestNewsResponse> {
    const startTime = new Date();
    let totalFetched = 0;
    let newArticles = 0;
    let duplicates = 0;
    let errors = 0;

    try {
      // Validate input
      this.validateRequest(request);

      // Fetch from NewsAPI
      const result = await this.newsAPIClient.fetchTopHeadlines({
        category: request.category,
        language: request.language || 'es',
        query: request.query,
        pageSize: request.pageSize || 20,
        page: 1,
      });

      totalFetched = result.articles.length;

      if (totalFetched === 0) {
        return this.createResponse(
          true,
          totalFetched,
          newArticles,
          duplicates,
          errors,
          'newsapi',
          startTime
        );
      }

      // Transform to domain entities and filter duplicates
      const articlesToSave: NewsArticle[] = [];

      for (const apiArticle of result.articles) {
        try {
          // Check if article already exists
          const exists = await this.articleRepository.existsByUrl(apiArticle.url);

          if (exists) {
            duplicates++;
            continue;
          }

          // Create domain entity
          const article = NewsArticle.create({
            id: randomUUID(),
            title: apiArticle.title || 'Untitled',
            description: apiArticle.description,
            content: apiArticle.content,
            url: apiArticle.url,
            urlToImage: apiArticle.urlToImage,
            source: apiArticle.source.name,
            author: apiArticle.author,
            publishedAt: new Date(apiArticle.publishedAt),
            category: request.category || null,
            language: request.language || 'es',
            embedding: null, // Will be generated later by embedding service
            fetchedAt: new Date(),
            updatedAt: new Date(),
          });

          articlesToSave.push(article);
        } catch (error) {
          console.error(`Failed to process article ${apiArticle.url}:`, error);
          errors++;
        }
      }

      // Save articles in batch
      if (articlesToSave.length > 0) {
        await this.articleRepository.saveMany(articlesToSave);
        newArticles = articlesToSave.length;
      }

      // Record ingestion metadata
      await this.recordIngestionMetadata(
        'newsapi',
        newArticles,
        errors > 0 ? 'partial_success' : 'success',
        errors > 0 ? `${errors} articles failed to process` : null
      );

      return this.createResponse(
        true,
        totalFetched,
        newArticles,
        duplicates,
        errors,
        'newsapi',
        startTime
      );
    } catch (error) {
      // Record failed ingestion
      await this.recordIngestionMetadata(
        'newsapi',
        0,
        'error',
        (error as Error).message
      );

      throw error;
    }
  }

  private validateRequest(request: IngestNewsRequest): void {
    if (request.pageSize !== undefined && (request.pageSize < 1 || request.pageSize > 100)) {
      throw new ValidationError('pageSize must be between 1 and 100');
    }

    if (request.language && !/^[a-z]{2}$/.test(request.language)) {
      throw new ValidationError('language must be a 2-letter ISO code');
    }

    const validCategories = [
      'business',
      'entertainment',
      'general',
      'health',
      'science',
      'sports',
      'technology',
    ];

    if (request.category && !validCategories.includes(request.category)) {
      throw new ValidationError(
        `category must be one of: ${validCategories.join(', ')}`
      );
    }
  }

  private async recordIngestionMetadata(
    source: string,
    articlesCount: number,
    status: string,
    errorMessage: string | null = null
  ): Promise<void> {
    try {
      await this.prisma.ingestMetadata.create({
        data: {
          id: randomUUID(),
          source,
          lastFetch: new Date(),
          articlesCount,
          status,
          errorMessage,
        },
      });
    } catch (error) {
      console.error('Failed to record ingestion metadata:', error);
      // Don't throw - metadata recording failure shouldn't fail the entire operation
    }
  }

  private createResponse(
    success: boolean,
    totalFetched: number,
    newArticles: number,
    duplicates: number,
    errors: number,
    source: string,
    timestamp: Date
  ): IngestNewsResponse {
    return {
      success,
      totalFetched,
      newArticles,
      duplicates,
      errors,
      source,
      timestamp,
    };
  }
}
