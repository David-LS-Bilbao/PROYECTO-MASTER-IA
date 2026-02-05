/**
 * IngestNewsUseCase (Application Layer)
 * Core business logic for news ingestion
 *
 * Responsibilities:
 * - Fetch news from external API
 * - Transform to domain entities
 * - Assign category correctly
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

// OPTIMIZATION: Limit items per ingestion to avoid flooding the database
// Increased from 5 to 30 to allow better coverage for dynamic categories like sports
const MAX_ITEMS_PER_SOURCE = 30;

// Valid categories (Spanish)
const VALID_CATEGORIES = [
  'general',
  'internacional',
  'deportes',
  'economia',
  'politica',
  'ciencia',
  'tecnologia',
  'cultura',
] as const;

// English to Spanish category mapping for backwards compatibility
const CATEGORY_MAPPING: Record<string, string> = {
  business: 'economia',
  entertainment: 'cultura',
  health: 'ciencia',
  science: 'ciencia',
  sports: 'deportes',
  technology: 'tecnologia',
  general: 'general',
};

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

      // Normalize category (map English to Spanish if needed)
      const normalizedCategory = this.normalizeCategory(request.category || request.query);

      // Fetch from NewsAPI
      const result = await this.newsAPIClient.fetchTopHeadlines({
        category: request.category,
        language: request.language || 'es',
        query: request.query,
        pageSize: request.pageSize || 20,
        page: 1,
      });

      // OPTIMIZATION: Limit to MAX_ITEMS_PER_SOURCE to reduce database load
      const limitedArticles = result.articles.slice(0, MAX_ITEMS_PER_SOURCE);
      totalFetched = limitedArticles.length;

      console.log(`📥 Ingesta: Recibidos ${result.articles.length} artículos, procesando ${totalFetched} (límite: ${MAX_ITEMS_PER_SOURCE})`);

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

      // OPTIMIZATION: Batch check for existing URLs to track what's new vs updated
      const incomingUrls = limitedArticles.map(a => a.url);
      const existingUrls = await this.getExistingUrls(incomingUrls);
      
      console.log(`🔍 Pre-ingesta: ${existingUrls.size} URLs ya existen, ${totalFetched - existingUrls.size} son nuevas`);
      console.log(`📝 Estrategia: Usar UPSERT para TODAS las URLs (actualiza metadata si existe, crea si es nueva)`);

      // Transform to domain entities - NO FILTRAR duplicados, dejar que upsert maneje todo
      const articlesToSave: NewsArticle[] = [];
      let updatedArticles = 0;

      for (const apiArticle of limitedArticles) {
        try {
          // Trackear si es update o insert (solo para logging/stats)
          const isExisting = existingUrls.has(apiArticle.url);
          if (isExisting) {
            updatedArticles++;
            console.log(`♻️  URL existente (se actualizará): ${apiArticle.url.substring(0, 60)}...`);
          }

          // Create domain entity with normalized category
          // IMPORTANT: Only raw data is saved here, NO AI analysis
          // El mapper decidirá si hacer INSERT (nueva) o UPDATE (existente)
          const article = NewsArticle.create({
            id: randomUUID(), // Si es update, el upsert ignorará este ID
            title: apiArticle.title || 'Untitled',
            description: apiArticle.description,
            content: apiArticle.content,
            url: apiArticle.url,
            urlToImage: apiArticle.urlToImage,
            source: apiArticle.source.name,
            author: apiArticle.author,
            publishedAt: new Date(apiArticle.publishedAt),
            category: normalizedCategory, // Se actualizará si la noticia existe con otra categoría
            language: request.language || 'es',
            embedding: null,
            summary: null,
            biasScore: null,
            analysis: null,
            analyzedAt: null,
            internalReasoning: null,
            isFavorite: false,
            fetchedAt: new Date(),
            updatedAt: new Date(),
          });

          articlesToSave.push(article);
        } catch (error) {
          console.error(`Failed to process article ${apiArticle.url}:`, error);
          errors++;
        }
      }

      // Save/Update articles in batch with UPSERT
      if (articlesToSave.length > 0) {
        await this.articleRepository.saveMany(articlesToSave);
        newArticles = articlesToSave.length - updatedArticles; // Solo contar las NUEVAS
        duplicates = updatedArticles; // Las "duplicadas" ahora son "actualizadas"
        
        console.log(`✅ Ingesta completada:`);
        console.log(`   📝 Nuevas: ${newArticles} | ♻️  Actualizadas: ${updatedArticles} | ❌ Errores: ${errors}`);
        console.log(`   📂 Categoría aplicada: "${normalizedCategory}"`);
      } else {
        console.log(`⚠️ Ingesta completada: No se procesaron artículos.`);
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

  /**
   * OPTIMIZATION: Batch check for existing URLs
   * Fetches all matching URLs in a single query instead of N queries
   */
  private async getExistingUrls(urls: string[]): Promise<Set<string>> {
    const existingArticles = await this.prisma.article.findMany({
      where: {
        url: {
          in: urls
        }
      },
      select: {
        url: true
      }
    });

    return new Set(existingArticles.map(a => a.url));
  }

  /**
   * Normalize category to Spanish (maps English categories for backwards compatibility)
   */
  private normalizeCategory(category: string | undefined): string | null {
    if (!category) return null;

    const lower = category.toLowerCase();

    // If it's already a valid Spanish category, return it
    if (VALID_CATEGORIES.includes(lower as any)) {
      return lower;
    }

    // Try to map from English
    if (CATEGORY_MAPPING[lower]) {
      return CATEGORY_MAPPING[lower];
    }

    // Return original if can't map (will be stored as-is)
    return category;
  }

  private validateRequest(request: IngestNewsRequest): void {
    if (request.pageSize !== undefined && (request.pageSize < 1 || request.pageSize > 100)) {
      throw new ValidationError('pageSize must be between 1 and 100');
    }

    if (request.language && !/^[a-z]{2}$/.test(request.language)) {
      throw new ValidationError('language must be a 2-letter ISO code');
    }

    // Accept both Spanish and English categories (will be normalized later)
    const allValidCategories = [
      ...VALID_CATEGORIES,
      'business',
      'entertainment',
      'health',
      'science',
      'sports',
      'technology',
    ];

    if (request.category && !allValidCategories.includes(request.category.toLowerCase() as any)) {
      throw new ValidationError(
        `category must be one of: ${VALID_CATEGORIES.join(', ')}`
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
