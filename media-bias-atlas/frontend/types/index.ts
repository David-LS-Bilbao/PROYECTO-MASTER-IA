export interface Country {
  code: string;
  name: string;
}

export type ClassificationStatus = 'PENDING' | 'COMPLETED' | 'FAILED';
export type BiasAnalysisStatus = 'PENDING' | 'COMPLETED' | 'FAILED';
export type IdeologyLabel = 'LEFT' | 'CENTER_LEFT' | 'CENTER' | 'CENTER_RIGHT' | 'RIGHT' | 'UNCLEAR';

export interface Outlet {
  id: string;
  name: string;
  websiteUrl: string | null;
  countryId: string;
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
