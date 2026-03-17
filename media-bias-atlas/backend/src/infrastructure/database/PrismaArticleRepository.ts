import { PrismaClient } from '@prisma/client';
import { Article, ClassificationStatus } from '../../domain/entities/Article';
import { IArticleRepository } from '../../domain/repositories/IArticleRepository';

export class PrismaArticleRepository implements IArticleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveManySkipDuplicates(articles: Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'isPolitical' | 'classificationStatus' | 'classificationReason' | 'classifiedAt'>[]): Promise<{ count: number }> {
    if (articles.length === 0) return { count: 0 };

    const result = await this.prisma.article.createMany({
      data: articles.map(a => ({
        feedId: a.feedId,
        title: a.title,
        url: a.url,
        publishedAt: a.publishedAt,
      })),
      skipDuplicates: true, // Ignora los inserts que colisionen en la constraint de `url` @unique
    });

    return { count: result.count };
  }

  async findByFeedId(feedId: string, limit: number = 50, isPolitical?: boolean): Promise<Article[]> {
    const where: any = { feedId };
    if (isPolitical !== undefined) {
      where.isPolitical = isPolitical;
    }

    const unmappedArticles = await this.prisma.article.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
    return unmappedArticles.map(this.mapToDomain);
  }

  async findById(articleId: string): Promise<Article | null> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId }
    });
    return article ? this.mapToDomain(article) : null;
  }

  async updateClassification(articleId: string, data: { isPolitical: boolean | null, classificationStatus: ClassificationStatus, classificationReason: string | null, classifiedAt: Date | null }): Promise<Article> {
    const updated = await this.prisma.article.update({
      where: { id: articleId },
      data: {
        isPolitical: data.isPolitical,
        classificationStatus: data.classificationStatus as any, // Prisma mapping
        classificationReason: data.classificationReason,
        classifiedAt: data.classifiedAt
      }
    });

    return this.mapToDomain(updated);
  }

  private mapToDomain(prismaArticle: any): Article {
    return {
      ...prismaArticle,
      classificationStatus: prismaArticle.classificationStatus as ClassificationStatus
    };
  }
}
