/**
 * Prisma NewsArticle Repository Implementation (Infrastructure Layer)
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  INewsArticleRepository,
  FindAllParams,
} from '../../domain/repositories/news-article.repository';
import { NewsArticle } from '../../domain/entities/news-article.entity';
import { DatabaseError } from '../../domain/errors/infrastructure.error';
import { ArticleMapper } from './article-mapper';

export class PrismaNewsArticleRepository implements INewsArticleRepository {
  private readonly mapper = new ArticleMapper();

  constructor(private readonly prisma: PrismaClient) {}

  async save(article: NewsArticle): Promise<void> {
    try {
      await this.prisma.article.upsert(this.mapper.toUpsertData(article));
    } catch (error) {
      throw new DatabaseError(
        `Failed to save article: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async saveMany(articles: NewsArticle[]): Promise<void> {
    if (articles.length === 0) return;

    try {
      const categories = [...new Set(articles.map(a => a.category))];
      const urls = articles.map(a => a.url.substring(0, 60));

      console.log(`[Repository] Ejecutando UPSERT para ${articles.length} articulos`);
      console.log(`[Repository] Categorias: ${categories.join(', ')}`);
      console.log(`[Repository] Primeras URLs: ${urls.slice(0, 3).join(' | ')}...`);

      await this.prisma.$transaction(async (tx) => {
        for (const article of articles) {
          await tx.article.upsert(this.mapper.toUpsertData(article));
        }
      });

      console.log(`[Repository] UPSERT completado exitosamente para ${articles.length} articulos`);
    } catch (error) {
      throw new DatabaseError(
        `Failed to save articles in batch: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async findById(id: string): Promise<NewsArticle | null> {
    try {
      const article = await this.prisma.article.findUnique({
        where: { id },
      });

      if (!article) return null;

      return this.mapper.toDomain(article);
    } catch (error) {
      throw new DatabaseError(
        `Failed to find article by ID: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async findByUrl(url: string): Promise<NewsArticle | null> {
    try {
      const article = await this.prisma.article.findUnique({
        where: { url },
      });

      if (!article) return null;

      return this.mapper.toDomain(article);
    } catch (error) {
      throw new DatabaseError(
        `Failed to find article by URL: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async findBySourceAndDateRange(
    source: string,
    startDate: Date,
    endDate: Date
  ): Promise<NewsArticle[]> {
    try {
      const articles = await this.prisma.article.findMany({
        where: {
          source,
          publishedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          publishedAt: 'desc',
        },
      });

      return articles.map((article) => this.mapper.toDomain(article));
    } catch (error) {
      throw new DatabaseError(
        `Failed to find articles by source and date range: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async existsByUrl(url: string): Promise<boolean> {
    try {
      const count = await this.prisma.article.count({
        where: { url },
      });

      return count > 0;
    } catch (error) {
      throw new DatabaseError(
        `Failed to check article existence: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async count(): Promise<number> {
    try {
      return await this.prisma.article.count();
    } catch (error) {
      throw new DatabaseError(
        `Failed to count articles: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async countFiltered(params: { category?: string; onlyFavorites?: boolean; userId?: string }): Promise<number> {
    try {
      // Per-user favorites: count from junction table
      if (params.onlyFavorites && params.userId) {
        return this.countFavoritesByUser(params.userId);
      }

      const where = this.buildWhereClause({ category: params.category });
      return await this.prisma.article.count({ where });
    } catch (error) {
      throw new DatabaseError(
        `Failed to count filtered articles: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async findUnanalyzed(limit: number): Promise<NewsArticle[]> {
    try {
      const articles = await this.prisma.article.findMany({
        where: {
          analyzedAt: null,
        },
        orderBy: {
          publishedAt: 'desc',
        },
        take: limit,
      });

      return articles.map((article) => this.mapper.toDomain(article));
    } catch (error) {
      throw new DatabaseError(
        `Failed to find unanalyzed articles: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async countAnalyzed(): Promise<number> {
    try {
      return await this.prisma.article.count({
        where: {
          analyzedAt: { not: null },
        },
      });
    } catch (error) {
      throw new DatabaseError(
        `Failed to count analyzed articles: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async getBiasDistribution(): Promise<{ left: number; neutral: number; right: number }> {
    try {
      const articles = await this.prisma.article.findMany({
        where: {
          analyzedAt: { not: null },
          biasScore: { not: null },
        },
        select: {
          biasScore: true,
        },
      });

      const distribution = { left: 0, neutral: 0, right: 0 };

      articles.forEach((article) => {
        const bias = article.biasScore ?? 0.5;
        if (bias < 0.4) {
          distribution.left++;
        } else if (bias > 0.6) {
          distribution.right++;
        } else {
          distribution.neutral++;
        }
      });

      return distribution;
    } catch (error) {
      throw new DatabaseError(
        `Failed to get bias distribution: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Find all articles with pagination and optional filtering.
   * When userId is provided and onlyFavorites=true, uses the Favorite junction table.
   * When userId is provided without onlyFavorites, enriches articles with per-user isFavorite.
   *
   * Sprint 18.3: Implements Round Robin source interleaving to avoid "clumping" effect.
   */
  async findAll(params: FindAllParams): Promise<NewsArticle[]> {
    const { limit, offset, category, onlyFavorites, userId } = params;

    try {
      // Per-user favorites: query from junction table (no interleaving)
      if (onlyFavorites && userId) {
        return this.findFavoritesByUser(userId, limit, offset);
      }

      const where = this.buildWhereClause({ category });

      console.log(`[Repository.findAll] Query params:`, { limit, offset, category, onlyFavorites, userId: userId ? '***' : undefined });

      // =========================================================================
      // SPRINT 18.3: SOURCE INTERLEAVING (Round Robin) - UX Improvement
      // =========================================================================
      // PROBLEMA: Articles from the same source appear clustered together,
      // creating a "clumping" effect that reduces perceived variety.
      //
      // SOLUCIÓN: Fetch more articles than requested, group by source,
      // and interleave them using Round Robin algorithm.
      //
      // BENEFICIO: Users see a diverse mix of sources, improving UX and
      // perceived content variety while maintaining chronological relevance.
      // =========================================================================

      // 1. BUFFER: Fetch 3x more articles (minimum 60) for diversity
      const bufferSize = Math.max(limit * 3, 60);

      const articles = await this.prisma.article.findMany({
        where,
        orderBy: {
          publishedAt: 'desc',
        },
        take: bufferSize,
        skip: offset,
      });

      console.log(`[Repository.findAll] Fetched ${articles.length} articles (buffer for interleaving)`);

      if (articles.length === 0) {
        return [];
      }

      // 2. GROUP BY SOURCE: Maintain chronological order within each group
      const sourceGroups = new Map<string, typeof articles>();

      for (const article of articles) {
        const source = article.source;
        if (!sourceGroups.has(source)) {
          sourceGroups.set(source, []);
        }
        sourceGroups.get(source)!.push(article);
      }

      console.log(`[Repository.findAll] Grouped into ${sourceGroups.size} sources:`,
        Array.from(sourceGroups.entries()).map(([src, arts]) => `${src}:${arts.length}`).join(', ')
      );

      // 3. ROUND ROBIN INTERLEAVING: Mix sources evenly
      const interleavedArticles: typeof articles = [];
      const sourceIterators = Array.from(sourceGroups.values());
      let round = 0;

      while (interleavedArticles.length < limit && sourceIterators.some(group => group.length > 0)) {
        for (const group of sourceIterators) {
          if (interleavedArticles.length >= limit) break;

          if (group.length > 0) {
            const article = group.shift()!; // Take first (most recent in this source)
            interleavedArticles.push(article);
          }
        }
        round++;
      }

      console.log(`[Repository.findAll] Interleaved ${interleavedArticles.length} articles in ${round} rounds`);

      // 4. CONVERT TO DOMAIN ENTITIES
      let domainArticles = interleavedArticles.map((article) => this.mapper.toDomain(article));

      // Enrich with per-user favorite status
      if (userId && domainArticles.length > 0) {
        domainArticles = await this.enrichWithUserFavorites(domainArticles, userId);
      } else {
        // No user = all isFavorite = false
        domainArticles = domainArticles.map(a =>
          NewsArticle.reconstitute({ ...a.toJSON(), isFavorite: false })
        );
      }

      return domainArticles;
    } catch (error) {
      throw new DatabaseError(
        `Failed to find articles: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async findByIds(ids: string[]): Promise<NewsArticle[]> {
    if (ids.length === 0) return [];

    try {
      const articles = await this.prisma.article.findMany({
        where: {
          id: { in: ids },
        },
      });

      return articles.map((article) => this.mapper.toDomain(article));
    } catch (error) {
      throw new DatabaseError(
        `Failed to find articles by IDs: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * @deprecated Use toggleFavoriteForUser instead
   */
  async toggleFavorite(id: string): Promise<NewsArticle | null> {
    try {
      const article = await this.prisma.article.findUnique({
        where: { id },
      });

      if (!article) return null;

      const updated = await this.prisma.article.update({
        where: { id },
        data: {
          isFavorite: !article.isFavorite,
          updatedAt: new Date(),
        },
      });

      return this.mapper.toDomain(updated);
    } catch (error) {
      throw new DatabaseError(
        `Failed to toggle favorite: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  // =========================================================================
  // PER-USER FAVORITES (Favorite junction table)
  // =========================================================================

  async toggleFavoriteForUser(userId: string, articleId: string): Promise<boolean> {
    try {
      const existing = await this.prisma.favorite.findUnique({
        where: { userId_articleId: { userId, articleId } },
      });

      if (existing) {
        await this.prisma.favorite.delete({
          where: { userId_articleId: { userId, articleId } },
        });
        console.log(`   [Favorites] Usuario ${userId.substring(0, 8)}... QUITÓ favorito: ${articleId.substring(0, 8)}...`);
        return false;
      } else {
        await this.prisma.favorite.create({
          data: { userId, articleId },
        });
        console.log(`   [Favorites] Usuario ${userId.substring(0, 8)}... AGREGÓ favorito: ${articleId.substring(0, 8)}...`);
        return true;
      }
    } catch (error) {
      throw new DatabaseError(
        `Failed to toggle favorite for user: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async addFavoriteForUser(userId: string, articleId: string, unlocked = false): Promise<void> {
    try {
      await this.prisma.favorite.upsert({
        where: { userId_articleId: { userId, articleId } },
        update: {
          // If already exists, update unlocked status (e.g., user first liked, then analyzed)
          unlockedAnalysis: unlocked,
        },
        create: {
          userId,
          articleId,
          unlockedAnalysis: unlocked,
        },
      });
      console.log(`   [Favorites] ${unlocked ? 'Análisis desbloqueado' : 'Favorito'} para usuario ${userId.substring(0, 8)}...`);
    } catch (error) {
      throw new DatabaseError(
        `Failed to add favorite for user: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async getUserFavoriteArticleIds(userId: string, articleIds: string[]): Promise<Set<string>> {
    try {
      if (articleIds.length === 0) return new Set();

      const favorites = await this.prisma.favorite.findMany({
        where: {
          userId,
          articleId: { in: articleIds },
        },
        select: { articleId: true },
      });

      return new Set(favorites.map(f => f.articleId));
    } catch (error) {
      throw new DatabaseError(
        `Failed to get user favorite IDs: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async getUserUnlockedArticleIds(userId: string, articleIds: string[]): Promise<Set<string>> {
    try {
      if (articleIds.length === 0) return new Set();

      const favorites = await this.prisma.favorite.findMany({
        where: {
          userId,
          articleId: { in: articleIds },
          unlockedAnalysis: true, // Only articles with unlocked analysis
        },
        select: { articleId: true },
      });

      return new Set(favorites.map(f => f.articleId));
    } catch (error) {
      throw new DatabaseError(
        `Failed to get user unlocked article IDs: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async findFavoritesByUser(userId: string, limit: number, offset: number): Promise<NewsArticle[]> {
    try {
      const favorites = await this.prisma.favorite.findMany({
        where: { userId },
        include: { article: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      console.log(`[Repository] Favorites for user ${userId.substring(0, 8)}...: ${favorites.length} found`);

      return favorites.map(f => {
        const article = this.mapper.toDomain(f.article);
        // Mark as favorite since it's in the user's favorites list
        return NewsArticle.reconstitute({ ...article.toJSON(), isFavorite: true });
      });
    } catch (error) {
      throw new DatabaseError(
        `Failed to find favorites by user: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async countFavoritesByUser(userId: string): Promise<number> {
    try {
      return await this.prisma.favorite.count({
        where: { userId },
      });
    } catch (error) {
      throw new DatabaseError(
        `Failed to count favorites by user: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  /**
   * Enrich articles with per-user favorite status from junction table
   */
  private async enrichWithUserFavorites(articles: NewsArticle[], userId: string): Promise<NewsArticle[]> {
    const articleIds = articles.map(a => a.id);
    const favoriteIds = await this.getUserFavoriteArticleIds(userId, articleIds);

    return articles.map(article => {
      const isFav = favoriteIds.has(article.id);
      return NewsArticle.reconstitute({ ...article.toJSON(), isFavorite: isFav });
    });
  }

  /**
   * Build Prisma where clause from filter params.
   * NOTE: onlyFavorites removed - per-user favorites now handled by junction table queries.
   */
  private buildWhereClause(params: {
    category?: string;
  }): Prisma.ArticleWhereInput {
    const where: Prisma.ArticleWhereInput = {};

    if (params.category) {
      where.OR = [
        {
          category: {
            equals: params.category,
            mode: 'insensitive',
          },
        },
        {
          category: {
            contains: params.category,
            mode: 'insensitive',
          },
        },
      ];
    }

    return where;
  }

  // =========================================================================
  // SEARCH (Sprint 19: Waterfall Search Engine)
  // =========================================================================

  /**
   * Normalize text by removing accents/diacritics
   * This allows "andalucia" to match "Andalucía", "jose" to match "José", etc.
   *
   * SPRINT 19.3.1 - ACCENT-INSENSITIVE SEARCH
   */
  private normalizeText(text: string): string {
    return text
      .normalize('NFD') // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .toLowerCase();
  }

  /**
   * Search articles using Multi-Term Tokenized Search (Case + Accent Insensitive)
   *
   * SPRINT 19.3 - TOKENIZATION: Flexible multi-word search
   * - Splits query into individual terms (words)
   * - Returns articles that contain ALL terms (in any order, in any field)
   * - Much more flexible than exact phrase matching
   *
   * SPRINT 19.3.1 - ACCENT INSENSITIVE:
   * - "andalucia" matches "Andalucía"
   * - "jose" matches "José"
   * - Uses two-phase approach: normalized search + original fallback
   *
   * Example:
   *   Query: "inundaciones andalucia"
   *   - Finds articles containing both "inundaciones" AND "andalucia/Andalucía"
   *   - Words can be in title, summary, or content
   *   - Order doesn't matter
   */
  async searchArticles(query: string, limit: number, userId?: string): Promise<NewsArticle[]> {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const trimmedQuery = query.trim();

      // =========================================================================
      // SPRINT 19.3: TOKENIZATION - Split query into individual terms
      // =========================================================================
      const terms = trimmedQuery.split(/\s+/).filter(term => term.length > 0);

      // SPRINT 19.3.1: Normalize terms to remove accents
      const normalizedTerms = terms.map(term => this.normalizeText(term));

      console.log(`[Repository.searchArticles] 🔎 Query: "${trimmedQuery}"`);
      console.log(`[Repository.searchArticles]    📝 Tokenized into ${terms.length} terms:`, terms);
      console.log(`[Repository.searchArticles]    🔤 Normalized terms:`, normalizedTerms);
      console.log(`[Repository.searchArticles]    👤 User: ${userId ? '***' : 'anonymous'}`);

      // =========================================================================
      // SPRINT 19.3.1: ACCENT-INSENSITIVE SEARCH
      // =========================================================================
      // Build dynamic WHERE clause with DUAL search strategy:
      // - Search for BOTH original term (e.g., "Andalucía") AND normalized term (e.g., "andalucia")
      // - This handles accented text in DB matching non-accented queries and vice versa
      // =========================================================================
      const whereConditions = terms.map((term, index) => {
        const normalizedTerm = normalizedTerms[index];
        const searchFields = ['title', 'description', 'summary', 'content'] as const;

        // For each field, search both original and normalized term
        const fieldConditions = searchFields.flatMap(field => [
          { [field]: { contains: term, mode: 'insensitive' as const } },
          // Only add normalized search if it's different from original
          ...(normalizedTerm !== term.toLowerCase()
            ? [{ [field]: { contains: normalizedTerm, mode: 'insensitive' as const } }]
            : []
          ),
        ]);

        return { OR: fieldConditions };
      });

      // MULTI-TERM TOKENIZED SEARCH: All terms must match
      const articles = await this.prisma.article.findMany({
        where: {
          AND: whereConditions, // Article must contain ALL terms
        },
        orderBy: {
          publishedAt: 'desc', // Most recent first
        },
        take: limit,
      });

      console.log(`[Repository.searchArticles] ✅ Multi-term search found ${articles.length} results`);

      if (articles.length === 0) {
        console.warn(`[Repository.searchArticles] ⚠️ NO RESULTS for query: "${trimmedQuery}"`);
        console.warn(`[Repository.searchArticles]    💡 Hint: Try fewer or more general terms`);
      } else {
        console.log(`[Repository.searchArticles] 📰 First result: "${articles[0].title.substring(0, 60)}..."`);
      }

      if (articles.length === 0) {
        return [];
      }

      // Convert to domain entities
      let domainArticles = articles.map((article) => this.mapper.toDomain(article));

      // Enrich with per-user favorite status if userId provided
      if (userId && domainArticles.length > 0) {
        domainArticles = await this.enrichWithUserFavorites(domainArticles, userId);
      } else {
        domainArticles = domainArticles.map(a =>
          NewsArticle.reconstitute({ ...a.toJSON(), isFavorite: false })
        );
      }

      return domainArticles;
    } catch (error) {
      throw new DatabaseError(
        `Failed to search articles: ${(error as Error).message}`,
        error as Error
      );
    }
  }

}
