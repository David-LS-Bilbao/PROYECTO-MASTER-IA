import { BiasAnalysisStatus, IdeologyLabel } from '../../../domain/entities/ArticleBiasAnalysis';
import { IArticleRepository } from '../../../domain/repositories/IArticleRepository';

export interface FeedBiasSummaryBucket {
  count: number;
  percentage: number;
}

export interface FeedBiasSummaryResult {
  feedId: string;
  totalPoliticalArticles: number;
  analyzedArticles: number;
  pendingAnalysis: number;
  failedAnalysis: number;
  ideologyCounts: Record<IdeologyLabel, FeedBiasSummaryBucket>;
}

const IDEOLOGY_LABELS: IdeologyLabel[] = [
  IdeologyLabel.LEFT,
  IdeologyLabel.CENTER_LEFT,
  IdeologyLabel.CENTER,
  IdeologyLabel.CENTER_RIGHT,
  IdeologyLabel.RIGHT,
  IdeologyLabel.UNCLEAR,
];

export class GetFeedBiasSummaryUseCase {
  constructor(private readonly articleRepository: IArticleRepository) {}

  async execute(feedId: string): Promise<FeedBiasSummaryResult> {
    if (!feedId) {
      throw new Error('El ID del feed es obligatorio');
    }

    const articles = await this.articleRepository.findByFeedId(feedId);
    const politicalArticles = articles.filter(article => article.isPolitical === true);

    const ideologyCounts = IDEOLOGY_LABELS.reduce<Record<IdeologyLabel, FeedBiasSummaryBucket>>((acc, label) => {
      acc[label] = { count: 0, percentage: 0 };
      return acc;
    }, {} as Record<IdeologyLabel, FeedBiasSummaryBucket>);

    let analyzedArticles = 0;
    let pendingAnalysis = 0;
    let failedAnalysis = 0;

    for (const article of politicalArticles) {
      const analysis = article.biasAnalysis;

      if (!analysis || analysis.status === BiasAnalysisStatus.PENDING) {
        pendingAnalysis++;
        continue;
      }

      if (analysis.status === BiasAnalysisStatus.FAILED) {
        failedAnalysis++;
        continue;
      }

      analyzedArticles++;
      const label = analysis.ideologyLabel ?? IdeologyLabel.UNCLEAR;
      ideologyCounts[label].count += 1;
    }

    for (const label of IDEOLOGY_LABELS) {
      ideologyCounts[label].percentage = analyzedArticles === 0
        ? 0
        : Number(((ideologyCounts[label].count / analyzedArticles) * 100).toFixed(1));
    }

    return {
      feedId,
      totalPoliticalArticles: politicalArticles.length,
      analyzedArticles,
      pendingAnalysis,
      failedAnalysis,
      ideologyCounts,
    };
  }
}
