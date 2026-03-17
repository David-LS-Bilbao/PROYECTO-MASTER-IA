import { ArticleBiasAnalysis, BiasAnalysisStatus, IdeologyLabel } from '../entities/ArticleBiasAnalysis';

export interface UpsertArticleBiasAnalysisInput {
  articleId: string;
  status: BiasAnalysisStatus;
  provider?: string | null;
  model?: string | null;
  ideologyLabel?: IdeologyLabel | null;
  confidence?: number | null;
  summary?: string | null;
  reasoningShort?: string | null;
  rawJson?: string | null;
  errorMessage?: string | null;
  analyzedAt?: Date | null;
}

export interface IArticleBiasAnalysisRepository {
  findByArticleId(articleId: string): Promise<ArticleBiasAnalysis | null>;
  upsertByArticleId(data: UpsertArticleBiasAnalysisInput): Promise<ArticleBiasAnalysis>;
}
