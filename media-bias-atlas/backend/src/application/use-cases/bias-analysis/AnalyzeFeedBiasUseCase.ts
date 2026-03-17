import { BiasAnalysisStatus } from '../../../domain/entities/ArticleBiasAnalysis';
import { IArticleRepository } from '../../../domain/repositories/IArticleRepository';
import { AnalyzeArticleBiasUseCase } from './AnalyzeArticleBiasUseCase';

export interface AnalyzeFeedBiasResult {
  feedId: string;
  totalArticles: number;
  eligiblePolitical: number;
  skippedNonPolitical: number;
  alreadyCompleted: number;
  analyzedNow: number;
  failed: number;
}

export class AnalyzeFeedBiasUseCase {
  constructor(
    private readonly articleRepository: IArticleRepository,
    private readonly analyzeArticleBiasUseCase: AnalyzeArticleBiasUseCase
  ) {}

  async execute(feedId: string): Promise<AnalyzeFeedBiasResult> {
    if (!feedId) {
      throw new Error('El ID del feed es obligatorio');
    }

    const articles = await this.articleRepository.findByFeedId(feedId, 500);
    const metrics: AnalyzeFeedBiasResult = {
      feedId,
      totalArticles: articles.length,
      eligiblePolitical: 0,
      skippedNonPolitical: 0,
      alreadyCompleted: 0,
      analyzedNow: 0,
      failed: 0,
    };

    for (const article of articles) {
      if (article.isPolitical !== true) {
        metrics.skippedNonPolitical++;
        continue;
      }

      metrics.eligiblePolitical++;

      try {
        const result = await this.analyzeArticleBiasUseCase.execute(article.id);

        if (result.reusedExisting && result.analysis.status === BiasAnalysisStatus.COMPLETED) {
          metrics.alreadyCompleted++;
          continue;
        }

        if (result.analysis.status === BiasAnalysisStatus.COMPLETED) {
          metrics.analyzedNow++;
        } else {
          metrics.failed++;
        }
      } catch (_error) {
        metrics.failed++;
      }
    }

    return metrics;
  }
}
