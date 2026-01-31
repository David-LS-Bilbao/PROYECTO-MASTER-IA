/**
 * API Client for Verity News Backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface ArticleAnalysis {
  summary: string;
  // biasScore normalizado 0-1 para UI (0 = neutral, 1 = extremo)
  biasScore: number;
  // biasRaw: -10 (Extrema Izquierda) a +10 (Extrema Derecha)
  biasRaw: number;
  biasIndicators: string[];
  // clickbaitScore: 0 (Serio) a 100 (Clickbait extremo)
  clickbaitScore: number;
  // reliabilityScore: 0 (Bulo/Falso) a 100 (Altamente Contrastado)
  reliabilityScore: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  mainTopics: string[];
  factCheck: {
    claims: string[];
    verdict: 'Verified' | 'Mixed' | 'Unproven' | 'False';
    reasoning: string;
  };
  // Legacy field
  factualClaims?: string[];
}

export interface NewsArticle {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  urlToImage: string | null;
  source: string;
  author: string | null;
  publishedAt: string;
  category: string | null;
  language: string;
  summary: string | null;
  biasScore: number | null;
  analysis: ArticleAnalysis | null;
  analyzedAt: string | null;
  isFavorite: boolean;
}

export interface NewsResponse {
  success: boolean;
  data: NewsArticle[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface BiasDistribution {
  left: number;
  neutral: number;
  right: number;
}

export interface DashboardStats {
  totalArticles: number;
  analyzedCount: number;
  coverage: number;
  biasDistribution: BiasDistribution;
}

export interface AnalyzeResponse {
  success: boolean;
  data: {
    articleId: string;
    summary: string;
    biasScore: number;
    analysis: ArticleAnalysis;
    scrapedContentLength: number;
  };
  message: string;
}

/**
 * Fetch all news articles from the backend
 */
export async function fetchNews(limit = 50, offset = 0): Promise<NewsResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/news?limit=${limit}&offset=${offset}`,
    {
      cache: 'no-store', // Disable cache for development
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch news: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch a single news article by ID
 */
export async function fetchNewsById(id: string): Promise<{ success: boolean; data: NewsArticle }> {
  const res = await fetch(`${API_BASE_URL}/api/news/${id}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch article: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Analyze a single article with AI
 */
export async function analyzeArticle(articleId: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE_URL}/api/analyze/article`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ articleId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to analyze article: ${res.status}`);
  }

  return res.json();
}

/**
 * Get analysis statistics
 */
export async function fetchAnalysisStats(): Promise<{
  success: boolean;
  data: {
    total: number;
    analyzed: number;
    pending: number;
    percentAnalyzed: number;
    biasDistribution?: BiasDistribution;
  };
}> {
  const res = await fetch(`${API_BASE_URL}/api/analyze/stats`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch stats: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch normalized dashboard stats
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await fetchAnalysisStats();
  const stats = response.data;

  return {
    totalArticles: stats.total,
    analyzedCount: stats.analyzed,
    coverage: stats.percentAnalyzed,
    biasDistribution: stats.biasDistribution || {
      left: 0,
      neutral: 0,
      right: 0,
    },
  };
}

/**
 * Chat message type for article conversations
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Chat response from backend
 */
export interface ChatResponse {
  success: boolean;
  data: {
    articleId: string;
    articleTitle: string;
    response: string;
  };
  message: string;
}

/**
 * Send a chat message about an article
 */
export async function chatWithArticle(
  articleId: string,
  messages: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE_URL}/api/chat/article`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ articleId, messages }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Chat failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Search response from semantic search endpoint
 */
export interface SearchResponse {
  success: boolean;
  data: {
    query: string;
    results: NewsArticle[];
    totalFound: number;
  };
  message: string;
}

/**
 * Semantic search for news articles using ChromaDB
 */
export async function searchNews(
  query: string,
  limit = 10
): Promise<SearchResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    {
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Search failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Toggle favorite response
 */
export interface ToggleFavoriteResponse {
  success: boolean;
  data: {
    id: string;
    isFavorite: boolean;
    message: string;
  };
}

/**
 * Toggle favorite status of an article
 */
export async function toggleFavorite(articleId: string): Promise<ToggleFavoriteResponse> {
  const res = await fetch(`${API_BASE_URL}/api/news/${articleId}/favorite`, {
    method: 'PATCH',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Toggle favorite failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch favorite articles
 */
export async function fetchFavorites(limit = 50, offset = 0): Promise<NewsResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/news?favorite=true&limit=${limit}&offset=${offset}`,
    {
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch favorites: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Ingest response from backend
 */
export interface IngestResponse {
  success: boolean;
  data: {
    query: string;
    savedCount: number;
    duplicateCount: number;
    errorCount: number;
  };
  message: string;
}

/**
 * Trigger RSS ingestion for a specific category
 */
export async function ingestByCategory(category: string, pageSize = 20): Promise<IngestResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ingest/news`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ category, pageSize }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Ingest failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch news by category
 */
export async function fetchNewsByCategory(
  category: string,
  limit = 50,
  offset = 0
): Promise<NewsResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/news?category=${encodeURIComponent(category)}&limit=${limit}&offset=${offset}`,
    {
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch news by category: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
