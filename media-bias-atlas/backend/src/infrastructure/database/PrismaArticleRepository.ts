import { PrismaClient } from '@prisma/client';
import { Article, ClassificationStatus } from '../../domain/entities/Article';
import { OutletBiasStats } from '../../domain/entities/OutletBiasProfile';
import { ArticleBiasAnalysis, BiasAnalysisStatus, IdeologyLabel } from '../../domain/entities/ArticleBiasAnalysis';
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

  async findByFeedId(feedId: string, limit?: number, isPolitical?: boolean): Promise<Article[]> {
    const where: any = { feedId };
    if (isPolitical !== undefined) {
      where.isPolitical = isPolitical;
    }

    const unmappedArticles = await this.prisma.article.findMany({
      where,
      include: {
        biasAnalysis: true,
      },
      orderBy: { publishedAt: 'desc' },
      ...(typeof limit === 'number' ? { take: limit } : {}),
    });
    return unmappedArticles.map(article => this.mapToDomain(article));
  }

  async findById(articleId: string): Promise<Article | null> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: {
        biasAnalysis: true,
      }
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

  async getOutletBiasStats(outletId: string): Promise<OutletBiasStats> {
    const totalPoliticalArticles = await this.prisma.article.count({
      where: {
        isPolitical: true,
        feed: {
          outletId
        }
      }
    });

    const completedAnalysesWithLabels = await this.prisma.articleBiasAnalysis.findMany({
      where: {
        status: 'COMPLETED',
        article: {
          isPolitical: true,
          feed: {
            outletId
          }
        }
      },
      select: {
        ideologyLabel: true
      }
    });

    let totalCompletedAnalyses = 0;
    const distribution: Record<IdeologyLabel, number> = {
      [IdeologyLabel.LEFT]: 0,
      [IdeologyLabel.CENTER_LEFT]: 0,
      [IdeologyLabel.CENTER]: 0,
      [IdeologyLabel.CENTER_RIGHT]: 0,
      [IdeologyLabel.RIGHT]: 0,
      [IdeologyLabel.UNCLEAR]: 0
    };

    for (const analysis of completedAnalysesWithLabels) {
      if (analysis.ideologyLabel) {
        totalCompletedAnalyses++;
        distribution[analysis.ideologyLabel as IdeologyLabel]++;
      }
    }

    return {
      totalPoliticalArticles,
      totalCompletedAnalyses,
      distribution
    };
  }

  private mapToDomain(prismaArticle: any): Article {
    return {
      ...prismaArticle,
      classificationStatus: prismaArticle.classificationStatus as ClassificationStatus,
      biasAnalysis: prismaArticle.biasAnalysis ? this.mapBiasAnalysisToDomain(prismaArticle.biasAnalysis) : null,
    };
  }

  private mapBiasAnalysisToDomain(prismaAnalysis: any): ArticleBiasAnalysis {
    return {
      ...prismaAnalysis,
      status: prismaAnalysis.status as BiasAnalysisStatus,
      ideologyLabel: prismaAnalysis.ideologyLabel as IdeologyLabel | null,
    };
  }
}
