import { IdeologyLabel } from '../../../domain/entities/ArticleBiasAnalysis';
import { OutletBiasProfile, OutletBiasStatus } from '../../../domain/entities/OutletBiasProfile';
import { IArticleRepository } from '../../../domain/repositories/IArticleRepository';
import { IOutletRepository } from '../../../domain/repositories/IOutletRepository';

export interface CalculateOutletBiasProfileInput {
  outletId: string;
}

const MIN_COMPLETED_ANALYSES = 5;
const DOMINANT_THRESHOLD_PERCENTAGE = 0.40; // 40% is the minimum threshold to be considered dominant

export class CalculateOutletBiasProfileUseCase {
  constructor(
    private readonly articleRepository: IArticleRepository,
    private readonly outletRepository: IOutletRepository
  ) {}

  async execute(input: CalculateOutletBiasProfileInput): Promise<OutletBiasProfile> {
    const outlet = await this.outletRepository.findById(input.outletId);
    if (!outlet) {
      throw new Error(`Medio con ID ${input.outletId} no encontrado.`);
    }

    const stats = await this.articleRepository.getOutletBiasStats(input.outletId);

    if (stats.totalCompletedAnalyses < MIN_COMPLETED_ANALYSES) {
      return {
        outletId: input.outletId,
        totalPoliticalArticles: stats.totalPoliticalArticles,
        totalCompletedAnalyses: stats.totalCompletedAnalyses,
        distribution: stats.distribution,
        dominantLabel: null,
        status: OutletBiasStatus.INSUFFICIENT_DATA,
      };
    }

    let maxLabel: IdeologyLabel | null = null;
    let maxCount = 0;
    
    // Find the label with the highest count
    Object.entries(stats.distribution).forEach(([labelStr, count]) => {
      const label = labelStr as IdeologyLabel;
      if (count > maxCount) {
        maxCount = count;
        maxLabel = label;
      } else if (count === maxCount) {
        // Tie breaks result in no dominant label if they are tied at highest
        maxLabel = null; 
      }
    });

    let dominantLabel: IdeologyLabel | null = null;

    if (maxLabel !== null && maxCount > 0) {
      const percentage = maxCount / stats.totalCompletedAnalyses;
      if (percentage >= DOMINANT_THRESHOLD_PERCENTAGE) {
        dominantLabel = maxLabel;
      }
    }

    return {
      outletId: input.outletId,
      totalPoliticalArticles: stats.totalPoliticalArticles,
      totalCompletedAnalyses: stats.totalCompletedAnalyses,
      distribution: stats.distribution,
      dominantLabel,
      status: OutletBiasStatus.ANALYZED,
    };
  }
}
