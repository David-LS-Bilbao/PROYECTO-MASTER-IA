import { Article, ArticleBiasAnalysis, BiasAnalysisStatus } from '@/types';

export interface FeedArticleFilters {
  political?: string;
  analysis?: string;
  ideology?: string;
}

export function resolveBiasAnalysisStatus(analysis?: ArticleBiasAnalysis | null): BiasAnalysisStatus {
  return analysis?.status ?? 'PENDING';
}

export function filterFeedArticles(articles: Article[], filters: FeedArticleFilters): Article[] {
  return articles.filter((article) => {
    if (filters.political === 'true' && article.isPolitical !== true) {
      return false;
    }

    if (filters.political === 'false' && article.isPolitical !== false) {
      return false;
    }

    const biasStatus = resolveBiasAnalysisStatus(article.biasAnalysis);

    if (filters.analysis === 'completed' && biasStatus !== 'COMPLETED') {
      return false;
    }

    if (filters.analysis === 'failed' && biasStatus !== 'FAILED') {
      return false;
    }

    if (filters.analysis === 'pending' && biasStatus !== 'PENDING') {
      return false;
    }

    if (filters.ideology) {
      if (biasStatus !== 'COMPLETED') {
        return false;
      }

      const articleIdeology = article.biasAnalysis?.ideologyLabel ?? 'UNCLEAR';
      if (articleIdeology !== filters.ideology) {
        return false;
      }
    }

    return true;
  });
}
