import { ArticleBiasAnalysis } from './ArticleBiasAnalysis';

export enum ClassificationStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  url: string;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  isPolitical: boolean | null;
  classificationStatus: ClassificationStatus;
  classificationReason: string | null;
  classifiedAt: Date | null;
  biasAnalysis?: ArticleBiasAnalysis | null;
}
