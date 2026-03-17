export enum BiasAnalysisStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum IdeologyLabel {
  LEFT = 'LEFT',
  CENTER_LEFT = 'CENTER_LEFT',
  CENTER = 'CENTER',
  CENTER_RIGHT = 'CENTER_RIGHT',
  RIGHT = 'RIGHT',
  UNCLEAR = 'UNCLEAR'
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
  analyzedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
