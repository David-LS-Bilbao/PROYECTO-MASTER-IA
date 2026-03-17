import {
  ArticleBiasAnalysis as PrismaArticleBiasAnalysisModel,
  BiasAnalysisStatus as PrismaBiasAnalysisStatus,
  IdeologyLabel as PrismaIdeologyLabel,
  PrismaClient,
} from '@prisma/client';
import { ArticleBiasAnalysis, BiasAnalysisStatus, IdeologyLabel } from '../../domain/entities/ArticleBiasAnalysis';
import {
  IArticleBiasAnalysisRepository,
  UpsertArticleBiasAnalysisInput,
} from '../../domain/repositories/IArticleBiasAnalysisRepository';

export class PrismaArticleBiasAnalysisRepository implements IArticleBiasAnalysisRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByArticleId(articleId: string): Promise<ArticleBiasAnalysis | null> {
    const analysis = await this.prisma.articleBiasAnalysis.findUnique({
      where: { articleId }
    });

    return analysis ? this.mapToDomain(analysis) : null;
  }

  async upsertByArticleId(data: UpsertArticleBiasAnalysisInput): Promise<ArticleBiasAnalysis> {
    const payload = {
      status: data.status as PrismaBiasAnalysisStatus,
      provider: data.provider ?? null,
      model: data.model ?? null,
      ideologyLabel: (data.ideologyLabel ?? null) as PrismaIdeologyLabel | null,
      confidence: data.confidence ?? null,
      summary: data.summary ?? null,
      reasoningShort: data.reasoningShort ?? null,
      rawJson: data.rawJson ?? null,
      errorMessage: data.errorMessage ?? null,
      analyzedAt: data.analyzedAt ?? null,
    };

    const analysis = await this.prisma.articleBiasAnalysis.upsert({
      where: { articleId: data.articleId },
      update: payload,
      create: {
        articleId: data.articleId,
        ...payload,
      }
    });

    return this.mapToDomain(analysis);
  }

  private mapToDomain(prismaAnalysis: PrismaArticleBiasAnalysisModel): ArticleBiasAnalysis {
    return {
      ...prismaAnalysis,
      status: prismaAnalysis.status as BiasAnalysisStatus,
      ideologyLabel: prismaAnalysis.ideologyLabel as IdeologyLabel | null,
    };
  }
}
