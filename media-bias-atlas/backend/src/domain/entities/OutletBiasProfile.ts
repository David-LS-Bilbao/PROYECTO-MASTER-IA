import { IdeologyLabel } from './ArticleBiasAnalysis';

export enum OutletBiasStatus {
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  ANALYZED = 'ANALYZED'
}

export type OutletBiasDistribution = Record<IdeologyLabel, number>;

export interface OutletBiasStats {
  totalPoliticalArticles: number;
  totalCompletedAnalyses: number;
  distribution: OutletBiasDistribution;
}

export interface OutletBiasProfile {
  outletId: string;
  totalPoliticalArticles: number;
  totalCompletedAnalyses: number;
  distribution: OutletBiasDistribution;
  dominantLabel: IdeologyLabel | null;
  status: OutletBiasStatus;
}
