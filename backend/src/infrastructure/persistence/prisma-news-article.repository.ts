/**
 * Prisma NewsArticle Repository Implementation (Infrastructure Layer)
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  INewsArticleRepository,
  FindAllParams,
} from '../../domain/repositories/news-article.repository';
import { NewsArticle, NewsArticleProps } from '../../domain/entities/news-article.entity';
import { DatabaseError } from '../../domain/errors/infrastructure.error';

export class PrismaNewsArticleRepository implements INewsArticleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(article: NewsArticle): Promise<void> {
    try {
      const data = article.toJSON();

      await this.prisma.article.upsert({
        where: { url: data.url },
        update: {
          title: data.title,
          description: data.description,
          content: data.content,
          urlToImage: data.urlToImage,
          author: data.author,
          category: data.category,
          embedding: data.embedding,
          summary: data.summary,
          biasScore: data.biasScore,
          analysis: data.analysis,
          analyzedAt: data.analyzedAt,
          internalReasoning: data.internalReasoning,
          isFavorite: data.isFavorite,
          updatedAt: new Date(),
        },
        create: {
          id: data.id,
          title: data.title,
          description: data.description,
          content: data.content,
          url: data.url,
          urlToImage: data.urlToImage,
          source: data.source,
          author: data.author,
          publishedAt: data.publishedAt,
          category: data.category,
          language: data.language,
          embedding: data.embedding,
          summary: data.summary,
          biasScore: data.biasScore,
          analysis: data.analysis,
          analyzedAt: data.analyzedAt,
          internalReasoning: data.internalReasoning,
          isFavorite: data.isFavorite,
          fetchedAt: data.fetchedAt,
          updatedAt: new Date(),
        },
      });
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
      // Log what we're saving for debugging
      const categories = [...new Set(articles.map(a => a.category))];
      console.log(`[Repository] Saving ${articles.length} articles with categories: ${categories.join(', ')}`);

      await this.prisma.$transaction(async (tx) => {
        for (const article of articles) {
          const data = article.toJSON();

          await tx.article.upsert({
            where: { url: data.url },
            update: {
              title: data.title,
              description: data.description,
              content: data.content,
              urlToImage: data.urlToImage,
              author: data.author,
              category: data.category,
              embedding: data.embedding,
              summary: data.summary,
              biasScore: data.biasScore,
              analysis: data.analysis,
              analyzedAt: data.analyzedAt,
              internalReasoning: data.internalReasoning,
              isFavorite: data.isFavorite,
              updatedAt: new Date(),
            },
            create: {
              id: data.id,
              title: data.title,
              description: data.description,
              content: data.content,
              url: data.url,
              urlToImage: data.urlToImage,
              source: data.source,
              author: data.author,
              publishedAt: data.publishedAt,
              category: data.category,
              language: data.language,
              embedding: data.embedding,
              summary: data.summary,
              biasScore: data.biasScore,
              analysis: data.analysis,
              analyzedAt: data.analyzedAt,
              internalReasoning: data.internalReasoning,
              isFavorite: data.isFavorite,
              fetchedAt: data.fetchedAt,
              updatedAt: new Date(),
            },
          });
        }
      });
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

      return this.toDomain(article);
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

      return this.toDomain(article);
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

      return articles.map((article) => this.toDomain(article));
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

  async countFiltered(params: { category?: string; onlyFavorites?: boolean }): Promise<number> {
    try {
      const where = this.buildWhereClause(params);
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

      return articles.map((article) => this.toDomain(article));
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

      // biasScore normalizado: 0-1 donde 0.5 es neutral
      // Left: 0.0 - 0.4, Neutral: 0.4 - 0.6, Right: 0.6 - 1.0
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
   * Find all articles with pagination and optional filtering
   */
  async findAll(params: FindAllParams): Promise<NewsArticle[]> {
    const { limit, offset, category, onlyFavorites } = params;

    try {
      const where = this.buildWhereClause({ category, onlyFavorites });

      // Debug log
      console.log(`[Repository.findAll] Query params:`, { limit, offset, category, onlyFavorites });
      console.log(`[Repository.findAll] Where clause:`, JSON.stringify(where));

      const articles = await this.prisma.article.findMany({
        where,
        orderBy: {
          publishedAt: 'desc',
        },
        take: limit,
        skip: offset,
      });

      console.log(`[Repository.findAll] Found ${articles.length} articles`);

      return articles.map((article) => this.toDomain(article));
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

      return articles.map((article) => this.toDomain(article));
    } catch (error) {
      throw new DatabaseError(
        `Failed to find articles by IDs: ${(error as Error).message}`,
        error as Error
      );
    }
  }

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

      return this.toDomain(updated);
    } catch (error) {
      throw new DatabaseError(
        `Failed to toggle favorite: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Build Prisma where clause from filter params
   * Uses case-insensitive matching and contains for flexible category matching
   */
  private buildWhereClause(params: {
    category?: string;
    onlyFavorites?: boolean;
  }): Prisma.ArticleWhereInput {
    const where: Prisma.ArticleWhereInput = {};

    if (params.onlyFavorites) {
      where.isFavorite = true;
    }

    if (params.category) {
      // Use case-insensitive exact match OR contains for partial matches
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
   * Map Prisma model to Domain entity
   */
  private toDomain(prismaArticle: any): NewsArticle {
    const props: NewsArticleProps = {
      id: prismaArticle.id,
      title: prismaArticle.title,
      description: prismaArticle.description,
      content: prismaArticle.content,
      url: prismaArticle.url,
      urlToImage: prismaArticle.urlToImage,
      source: prismaArticle.source,
      author: prismaArticle.author,
      publishedAt: prismaArticle.publishedAt,
      category: prismaArticle.category,
      language: prismaArticle.language,
      embedding: prismaArticle.embedding,
      summary: prismaArticle.summary,
      biasScore: prismaArticle.biasScore,
      analysis: prismaArticle.analysis,
      analyzedAt: prismaArticle.analyzedAt,
      internalReasoning: prismaArticle.internalReasoning,
      isFavorite: prismaArticle.isFavorite ?? false,
      fetchedAt: prismaArticle.fetchedAt,
      updatedAt: prismaArticle.updatedAt,
    };

    return NewsArticle.reconstitute(props);
  }
}
