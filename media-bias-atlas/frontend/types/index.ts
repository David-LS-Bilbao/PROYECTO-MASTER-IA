export interface Country {
  code: string;
  name: string;
}

export type ClassificationStatus = 'PENDING' | 'COMPLETED' | 'FAILED';
export type BiasAnalysisStatus = 'PENDING' | 'COMPLETED' | 'FAILED';
export type IdeologyLabel = 'LEFT' | 'CENTER_LEFT' | 'CENTER' | 'CENTER_RIGHT' | 'RIGHT' | 'UNCLEAR';
export type OutletBiasStatus = 'INSUFFICIENT_DATA' | 'ANALYZED';

export interface OutletBiasSummary {
  status: OutletBiasStatus;
  dominantLabel: IdeologyLabel | null;
  totalPoliticalArticles: number;
  totalCompletedAnalyses: number;
}

export interface Outlet {
  id: string;
  name: string;
  websiteUrl: string | null;
  countryId: string;
  biasSummary?: OutletBiasSummary | null;
}

export interface RssFeed {
  id: string;
  outletId: string;
  url: string;
  category: string | null;
  isActive: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleBiasAnalysis {
  id: string;
  articleId: string;
  status: BiasAnalysisStatus;
  provider: string | null;
  model: string | null;
  ideologyLabel: IdeologyLabel | null;
  confidence: number | null;
  summary: string | null;
  reasoningShort: string | null;
  rawJson: string | null;
  errorMessage: string | null;
  analyzedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  url: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  isPolitical?: boolean | null;
  classificationStatus?: ClassificationStatus;
  classificationReason?: string | null;
  classifiedAt?: string | null;
  biasAnalysis?: ArticleBiasAnalysis | null;
}

export interface FeedBiasSummaryBucket {
  count: number;
  percentage: number;
}

export interface FeedBiasSummary {
  feedId: string;
  totalPoliticalArticles: number;
  analyzedArticles: number;
  pendingAnalysis: number;
  failedAnalysis: number;
  ideologyCounts: Record<IdeologyLabel, FeedBiasSummaryBucket>;
}

export interface OutletBiasProfile {
  outletId: string;
  status: OutletBiasStatus;
  totalPoliticalArticles: number;
  totalCompletedAnalyses: number;
  minimumSampleRequired: number;
  dominantLabel: IdeologyLabel | null;
  distribution: Record<IdeologyLabel, number>;
}
