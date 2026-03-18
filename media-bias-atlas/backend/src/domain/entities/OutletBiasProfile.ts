import { IdeologyLabel } from './ArticleBiasAnalysis';

export enum OutletBiasStatus {
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  ANALYZED = 'ANALYZED'
}

export type OutletBiasDistribution = Record<IdeologyLabel, number>;
export const MIN_OUTLET_BIAS_SAMPLE_REQUIRED = 5;
const DOMINANT_THRESHOLD_PERCENTAGE = 0.40;

export interface OutletBiasStats {
  totalPoliticalArticles: number;
  totalCompletedAnalyses: number;
  distribution: OutletBiasDistribution;
}

export interface OutletBiasSummary {
  status: OutletBiasStatus;
  dominantLabel: IdeologyLabel | null;
  totalPoliticalArticles: number;
  totalCompletedAnalyses: number;
}

export interface OutletBiasProfile {
  outletId: string;
  totalPoliticalArticles: number;
  totalCompletedAnalyses: number;
  distribution: OutletBiasDistribution;
  dominantLabel: IdeologyLabel | null;
  status: OutletBiasStatus;
}

export function buildOutletBiasSummary(stats: OutletBiasStats): OutletBiasSummary {
  if (stats.totalCompletedAnalyses < MIN_OUTLET_BIAS_SAMPLE_REQUIRED) {
    return {
      status: OutletBiasStatus.INSUFFICIENT_DATA,
      dominantLabel: null,
      totalPoliticalArticles: stats.totalPoliticalArticles,
      totalCompletedAnalyses: stats.totalCompletedAnalyses,
    };
  }

  return {
    status: OutletBiasStatus.ANALYZED,
    dominantLabel: resolveDominantLabel(stats),
    totalPoliticalArticles: stats.totalPoliticalArticles,
    totalCompletedAnalyses: stats.totalCompletedAnalyses,
  };
}

export function buildOutletBiasProfile(outletId: string, stats: OutletBiasStats): OutletBiasProfile {
  const summary = buildOutletBiasSummary(stats);

  return {
    outletId,
    totalPoliticalArticles: stats.totalPoliticalArticles,
    totalCompletedAnalyses: stats.totalCompletedAnalyses,
    distribution: stats.distribution,
    dominantLabel: summary.dominantLabel,
    status: summary.status,
  };
}

function resolveDominantLabel(stats: OutletBiasStats): IdeologyLabel | null {
  let maxLabel: IdeologyLabel | null = null;
  let maxCount = 0;

  Object.entries(stats.distribution).forEach(([labelStr, count]) => {
    const label = labelStr as IdeologyLabel;

    if (count > maxCount) {
      maxCount = count;
      maxLabel = label;
      return;
    }

    if (count === maxCount) {
      maxLabel = null;
    }
  });

  if (maxLabel === null || maxCount === 0) {
    return null;
  }

  const percentage = maxCount / stats.totalCompletedAnalyses;
  return percentage >= DOMINANT_THRESHOLD_PERCENTAGE ? maxLabel : null;
}
