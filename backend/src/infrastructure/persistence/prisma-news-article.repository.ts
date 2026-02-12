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

  /**
   * Interleave articles by source using round-robin and then apply pagination.
   * This keeps source variety while preserving chronological order per source.
   */
  private interleaveBySource<T extends { source: string }>(
    articles: T[],
    limit: number,
    offset: number
  ): T[] {
    if (articles.length === 0 || limit <= 0) {
      return [];
    }

    const targetSize = offset + limit;
    const sourceGroups = new Map<string, T[]>();

    for (const article of articles) {
      if (!sourceGroups.has(article.source)) {
        sourceGroups.set(article.source, []);
      }
      sourceGroups.get(article.source)!.push(article);
    }

    const interleaved: T[] = [];
    const sourceIterators = Array.from(sourceGroups.values());

    while (interleaved.length < targetSize && sourceIterators.some(group => group.length > 0)) {
      for (const group of sourceIterators) {
        if (interleaved.length >= targetSize) break;
        if (group.length > 0) {
          interleaved.push(group.shift()!);
        }
      }
    }

    return interleaved.slice(offset, targetSize);
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
   * Generate common Spanish accent variants for a normalized term
   * Example: "andalucia" → ["andalucia", "andalucía", "andalucìa", ...]
   *
   * SPRINT 19.3.1 - ACCENT VARIANTS for robust search
   */
  private generateAccentVariants(normalizedTerm: string): string[] {
    const variants = [normalizedTerm]; // Always include the normalized version

    // Common Spanish vowel substitutions: a→á, e→é, i→í, o→ó, u→ú, u→ü
    const accentMap: Record<string, string[]> = {
      'a': ['á', 'à', 'ä'],
      'e': ['é', 'è', 'ë'],
      'i': ['í', 'ì', 'ï'],
      'o': ['ó', 'ò', 'ö'],
      'u': ['ú', 'ù', 'ü'],
      'n': ['ñ'],
    };

    // For each vowel in the term, generate a variant with accent
    for (let i = 0; i < normalizedTerm.length; i++) {
      const char = normalizedTerm[i];
      const accents = accentMap[char];

      if (accents) {
        // Generate variants with this character accented
        for (const accentedChar of accents) {
          const variant = normalizedTerm.substring(0, i) + accentedChar + normalizedTerm.substring(i + 1);
          variants.push(variant);
        }
      }
    }

    return variants;
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
      // SPRINT 19.3.1: SIMPLIFIED ACCENT-INSENSITIVE SEARCH
      // =========================================================================
      // Strategy: For each term, search BOTH the original AND common accent variants
      // This is simpler and more reliable than using PostgreSQL unaccent()
      // =========================================================================

      const whereConditions = terms.map((term) => {
        const normalizedTerm = this.normalizeText(term);
        const searchFields = ['title', 'description', 'summary', 'content'] as const;

        // Generate common accent variants for Spanish
        const variants = this.generateAccentVariants(normalizedTerm);

        // For each field, search all variants (original + normalized + variants)
        const fieldConditions = searchFields.flatMap(field =>
          variants.map(variant => ({
            [field]: { contains: variant, mode: 'insensitive' as const }
          }))
        );

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

  // =========================================================================
  // SPRINT 28: LOCAL NEWS SEARCH (Category-filtered + City text search)
  // =========================================================================

  /**
   * Search articles in the 'local' category that mention a specific city.
   *
   * BUG FIX: Previously used searchArticles(city) which searched ALL categories,
   * returning international/national articles that happened to mention the city.
   * Now properly filters to category='local' first, then searches by city name.
   */
  async searchLocalArticles(city: string, limit: number, offset: number, userId?: string): Promise<NewsArticle[]> {
    try {
      if (!city || city.trim().length === 0) {
        return [];
      }

      const trimmedCity = city.trim();
      const normalizedCity = this.normalizeText(trimmedCity);
      const cityVariants = this.generateAccentVariants(normalizedCity);

      console.log(`[Repository.searchLocalArticles] 📍 City: "${trimmedCity}"`);
      console.log(`[Repository.searchLocalArticles]    🔤 Variants: ${cityVariants.slice(0, 5).join(', ')}...`);

      // Build city text search conditions across title, description, summary, content
      const searchFields = ['title', 'description', 'summary', 'content'] as const;
      const cityConditions = searchFields.flatMap(field =>
        cityVariants.map(variant => ({
          [field]: { contains: variant, mode: 'insensitive' as const }
        }))
      );

      const localCategoryFilter: Prisma.ArticleWhereInput = {
        category: {
          equals: 'local',
          mode: 'insensitive',
        },
      };
      const localCityFilter: Prisma.ArticleWhereInput = {
        AND: [
          localCategoryFilter,
          { OR: cityConditions },
        ],
      };
      const bufferSize = Math.max((offset + limit) * 3, 60);

      // Query: category='local' AND (city mentioned in any text field)
      const localCandidates = await this.prisma.article.findMany({
        where: localCityFilter,
        orderBy: {
          publishedAt: 'desc',
        },
        take: bufferSize,
      });

      console.log(`[Repository.searchLocalArticles] ✅ Found ${localCandidates.length} candidate local articles for "${trimmedCity}"`);

      if (localCandidates.length === 0) {
        // Fallback: return all local articles (without city filter) so user sees something
        console.log(`[Repository.searchLocalArticles] 🔄 Fallback: returning all local articles`);
        const fallbackCandidates = await this.prisma.article.findMany({
          where: localCategoryFilter,
          orderBy: {
            publishedAt: 'desc',
          },
          take: bufferSize,
        });

        if (fallbackCandidates.length === 0) return [];

        const fallbackArticles = this.interleaveBySource(fallbackCandidates, limit, offset);

        let domainArticles = fallbackArticles.map(a => this.mapper.toDomain(a));
        if (userId && domainArticles.length > 0) {
          domainArticles = await this.enrichWithUserFavorites(domainArticles, userId);
        } else {
          domainArticles = domainArticles.map(a =>
            NewsArticle.reconstitute({ ...a.toJSON(), isFavorite: false })
          );
        }
        return domainArticles;
      }

      const articles = this.interleaveBySource(localCandidates, limit, offset);

      // Convert to domain entities
      let domainArticles = articles.map(a => this.mapper.toDomain(a));

      // Enrich with per-user favorite status
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
        `Failed to search local articles: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async countLocalArticles(city: string): Promise<number> {
    try {
      if (!city || city.trim().length === 0) {
        return 0;
      }

      const trimmedCity = city.trim();
      const normalizedCity = this.normalizeText(trimmedCity);
      const cityVariants = this.generateAccentVariants(normalizedCity);
      const searchFields = ['title', 'description', 'summary', 'content'] as const;
      const cityConditions = searchFields.flatMap(field =>
        cityVariants.map(variant => ({
          [field]: { contains: variant, mode: 'insensitive' as const }
        }))
      );

      const filteredCount = await this.prisma.article.count({
        where: {
          AND: [
            {
              category: {
                equals: 'local',
                mode: 'insensitive',
              },
            },
            { OR: cityConditions },
          ],
        },
      });

      if (filteredCount > 0) {
        return filteredCount;
      }

      // Fallback count aligned with searchLocalArticles fallback behavior
      return await this.prisma.article.count({
        where: {
          category: {
            equals: 'local',
            mode: 'insensitive',
          },
        },
      });
    } catch (error) {
      throw new DatabaseError(
        `Failed to count local articles: ${(error as Error).message}`,
        error as Error
      );
    }
  }

}
