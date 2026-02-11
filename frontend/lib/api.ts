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
  /**
   * PRIVACY: Indicates if analysis exists globally in DB (for instant retrieval).
   * If hasAnalysis=true but analysis/summary/biasScore are null, it means:
   * - Another user analyzed this article (cached in DB)
   * - Current user hasn't favorited it yet (analysis masked for privacy)
   * - Clicking "Analyze" will serve the cached analysis instantly and auto-favorite
   */
  hasAnalysis?: boolean;
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

export interface TokenUsage {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  costEstimated: number; // En Euros
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
  usage?: TokenUsage; // Optional: Cost tracking from backend
  message: string;
}

/**
 * Fetch all news articles from the backend.
 * If token is provided, articles are enriched with per-user favorite status.
 */
export async function fetchNews(limit = 50, offset = 0, token?: string): Promise<NewsResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(
    `${API_BASE_URL}/api/news?limit=${limit}&offset=${offset}`,
    {
      cache: 'no-store',
      headers,
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch news: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch a single news article by ID.
 * If token is provided, enriches with per-user favorite status.
 */
export async function fetchNewsById(id: string, token?: string): Promise<{ success: boolean; data: NewsArticle }> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/api/news/${id}`, {
    cache: 'no-store',
    headers,
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch article: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Analyze a single article with AI
 * Requires authentication token
 */
export async function analyzeArticle(articleId: string, token: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE_URL}/api/analyze/article`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ articleId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Failed to analyze article: ${res.status}`);
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
    biasDistribution: BiasDistribution;
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
    biasDistribution: stats.biasDistribution,
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
 * Chat general response from backend (Sprint 19.6)
 * Sprint 27.4: Chat General usa conocimiento completo de Gemini (NO RAG)
 */
export interface ChatGeneralResponse {
  success: boolean;
  data: {
    response: string;
    // Chat General NO usa RAG, no incluye sourcesCount
  };
  message: string;
}

/**
 * Send a general chat message (Sprint 19.6)
 */
export async function chatGeneral(
  messages: ChatMessage[]
): Promise<ChatGeneralResponse> {
  const res = await fetch(`${API_BASE_URL}/api/chat/general`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
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
 * Toggle favorite status of an article (requires auth token for per-user isolation)
 */
export async function toggleFavorite(articleId: string, token: string): Promise<ToggleFavoriteResponse> {
  const res = await fetch(`${API_BASE_URL}/api/news/${articleId}/favorite`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Toggle favorite failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch favorite articles for the authenticated user
 */
export async function fetchFavorites(limit = 50, offset = 0, token?: string): Promise<NewsResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(
    `${API_BASE_URL}/api/news?favorite=true&limit=${limit}&offset=${offset}`,
    {
      cache: 'no-store',
      headers,
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
 * Fetch news by category.
 * If token is provided, articles are enriched with per-user favorite status.
 */
export async function fetchNewsByCategory(
  category: string,
  limit = 50,
  offset = 0,
  token?: string
): Promise<NewsResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(
    `${API_BASE_URL}/api/news?category=${encodeURIComponent(category)}&limit=${limit}&offset=${offset}`,
    {
      cache: 'no-store',
      headers,
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch news by category: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * RSS Auto-Discovery Response
 */
export interface DiscoverRssResponse {
  success: boolean;
  data?: {
    query: string;
    rssUrl: string;
  };
  error?: string;
}

/**
 * Discover RSS URL for a media name using AI
 * FEATURE: RSS AUTO-DISCOVERY (Sprint 9)
 * 
 * @param name Nombre del medio (e.g., "El País", "BBC News")
 * @returns La URL del RSS encontrada o lanza un error
 */
export async function discoverRssSource(name: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/sources/discover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: name }),
  });

  const data: DiscoverRssResponse = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || 'No se pudo encontrar el RSS');
  }

  return data.data!.rssUrl;
}

/**
 * User Profile Management
 * FEATURE: USER PROFILES (Sprint 10)
 */

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  plan: 'FREE' | 'PREMIUM';
  location: string | null; // Sprint 20: Geolocalización (ej: "Madrid, España")
  preferences: {
    categories?: string[];
    theme?: string;
    notifications?: boolean;
  };
  usageStats: {
    articlesAnalyzed: number;
    searchesPerformed: number;
    chatMessages: number;
  };
  counts: {
    favorites: number;
    searchHistory: number;
    chats: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileResponse {
  success: boolean;
  data: UserProfile;
}

interface UpdateUserProfileData {
  name?: string;
  location?: string | null;
  preferences?: UserProfile['preferences'];
}

/**
 * Get current user's complete profile
 * Requires authentication token
 */
export async function getUserProfile(token: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/api/user/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('📡 getUserProfile - Error response:', errorText);
    throw new Error(`Failed to fetch user profile: ${res.status} ${res.statusText}`);
  }

  const response: UserProfileResponse = await res.json();
  return response.data;
}

/**
 * Update user profile (name and preferences)
 * Requires authentication token
 */
export async function updateUserProfile(
  token: string,
  data: UpdateUserProfileData
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/api/user/me`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Failed to update user profile: ${res.status} ${res.statusText}`);
  }

  const response: UserProfileResponse = await res.json();
  return response.data;
}

/**
 * Token Usage Statistics Interface
 */
export interface TokenUsageStats {
  analysis: {
    count: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
  ragChat: {
    count: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
  groundingChat: {
    count: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
  total: {
    operations: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
  sessionStart: string;
  uptime: string;
}

export interface TokenUsageResponse {
  success: boolean;
  data: {
    session: TokenUsageStats;
    note: string;
  };
}

/**
 * Get Gemini API token usage statistics for the current session
 * Requires authentication token
 */
export async function getTokenUsage(token: string): Promise<TokenUsageStats> {
  const res = await fetch(`${API_BASE_URL}/api/user/token-usage`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch token usage: ${res.status} ${res.statusText}`);
  }

  const response: TokenUsageResponse = await res.json();
  return response.data.session;
}
