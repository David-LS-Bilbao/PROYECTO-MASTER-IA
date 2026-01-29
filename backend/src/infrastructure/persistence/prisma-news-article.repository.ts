/**
 * Prisma NewsArticle Repository Implementation (Infrastructure Layer)
 */

import { PrismaClient } from '@prisma/client';
import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
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
    try {
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
      fetchedAt: prismaArticle.fetchedAt,
      updatedAt: prismaArticle.updatedAt,
    };

    return NewsArticle.reconstitute(props);
  }
}
