/**
 * INewsAPIClient Interface (Domain Layer)
 * Pure contract for external news API integration
 */

export interface NewsAPIArticle {
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  urlToImage: string | null;
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  publishedAt: string;
}

export interface FetchNewsParams {
  query?: string;
  category?: string;
  language?: string;
  pageSize?: number;
  page?: number;
}

export interface FetchNewsResult {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

export interface INewsAPIClient {
  /**
   * Fetch top headlines from NewsAPI
   * @throws InfrastructureError if API call fails
   */
  fetchTopHeadlines(params: FetchNewsParams): Promise<FetchNewsResult>;

  /**
   * Fetch everything from NewsAPI
   * @throws InfrastructureError if API call fails
   */
  fetchEverything(params: FetchNewsParams): Promise<FetchNewsResult>;
}
