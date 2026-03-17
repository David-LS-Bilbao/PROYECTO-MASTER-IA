import { Article, ClassificationStatus } from '../entities/Article';

export interface IArticleRepository {
  saveManySkipDuplicates(articles: Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'isPolitical' | 'classificationStatus' | 'classificationReason' | 'classifiedAt'>[]): Promise<{ count: number }>;
  findByFeedId(feedId: string, limit?: number, isPolitical?: boolean): Promise<Article[]>;
  updateClassification(articleId: string, data: { isPolitical: boolean | null, classificationStatus: ClassificationStatus, classificationReason: string | null, classifiedAt: Date | null }): Promise<Article>;
  findById(articleId: string): Promise<Article | null>;
}
