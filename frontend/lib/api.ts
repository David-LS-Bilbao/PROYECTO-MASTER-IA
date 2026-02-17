/**
 * API Client for Verity News Backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/** Timeout por defecto para llamadas a la API (45s - permite cold start de Render free tier) */
const DEFAULT_FETCH_TIMEOUT = 45_000;

/**
 * Wrapper de fetch con timeout via AbortController.
 * Evita que las llamadas a la API cuelguen indefinidamente cuando el backend
 * está dormido (Render free tier cold start ~30-60s).
 */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeout?: number }
): Promise<Response> {
  const { timeout = DEFAULT_FETCH_TIMEOUT, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(input, {
      ...fetchInit,
      signal: controller.signal,
    });
    return response;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(
        `El servidor no responde (timeout ${Math.round(timeout / 1000)}s). ` +
        'Puede estar despertando. Inténtalo de nuevo en unos segundos.'
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export type AnalysisMode = 'low_cost' | 'moderate' | 'standard';
export type AnalyzeDepthMode = 'standard' | 'deep';

function extractApiError(errorData: any, fallback: string): {
  message: string;
  code?: string;
  details?: any;
} {
  if (!errorData || typeof errorData !== 'object') {
    return { message: fallback };
  }

  const code =
    typeof errorData.error?.code === 'string'
      ? errorData.error.code
      : undefined;
  const details =
    errorData.error && typeof errorData.error === 'object'
      ? errorData.error.details
      : undefined;

  if (typeof errorData.message === 'string' && errorData.message.trim().length > 0) {
    return { message: errorData.message, code, details };
  }

  if (typeof errorData.error === 'string' && errorData.error.trim().length > 0) {
    return { message: errorData.error, code, details };
  }

  if (errorData.error && typeof errorData.error === 'object') {
    const nestedMessage = errorData.error.message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim().length > 0) {
      return { message: nestedMessage, code, details };
    }

    const originalMessage = errorData.error?.details?.originalMessage;
    if (typeof originalMessage === 'string' && originalMessage.trim().length > 0) {
      return { message: originalMessage, code, details };
    }
  }

  return { message: fallback, code, details };
}

export interface ArticleAnalysis {
  formatError?: boolean;
  summary: string;
  qualityNotice?: string;
  analysisModeUsed?: AnalysisMode | 'deep';
  // biasScore normalizado 0-1 para UI (0 = neutral, 1 = extremo)
  biasScore: number;
  // biasRaw: -10 (Extrema Izquierda) a +10 (Extrema Derecha)
  biasRaw: number;
  // biasScoreNormalized explicito para UI (vNext)
  biasScoreNormalized?: number;
  biasIndicators: string[];
  biasComment?: string;
  articleLeaning?: 'progresista' | 'conservadora' | 'extremista' | 'neutral' | 'indeterminada';
  leaningConfidence?: 'baja' | 'media' | 'alta';
  // Legacy alias maintained for backward compatibility with cached payloads
  biasLeaning?: 'progresista' | 'conservadora' | 'neutral' | 'indeterminada' | 'otra';
  // clickbaitScore: 0 (Serio) a 100 (Clickbait extremo)
  clickbaitScore: number;
  // reliabilityScore: fiabilidad basada en evidencia interna del texto (NO veracidad externa)
  reliabilityScore: number;
  traceabilityScore?: number;
  factualityStatus?: 'no_determinable' | 'plausible_but_unverified';
  evidence_needed?: string[];
  reliabilityComment?: string;
  should_escalate?: boolean;
  sentiment: 'positive' | 'negative' | 'neutral';
  mainTopics: string[];
  factCheck: {
    claims: string[];
    verdict:
      | 'SupportedByArticle'
      | 'NotSupportedByArticle'
      | 'InsufficientEvidenceInArticle';
    reasoning: string;
  };
  deep?: {
    sections?: {
      known?: string[];
      unknown?: string[];
      quotes?: string[];
      risks?: string[];
    };
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
  meta?: {
    location?: string;
    message?: string;
    localMeta?: {
      requested: string;        // Input original del usuario ("Mostoles, Madrid")
      resolved: {
        city?: string;           // Ciudad extraída ("Mostoles")
        province?: string;       // Provincia extraída ("Madrid")
        region?: string;         // Comunidad autónoma (opcional)
      };
      scopeUsed: 'city' | 'province' | 'region' | 'general';  // Scope de fallback usado
      ttlMinutes: number;        // TTL del caché (ej: 15)
      fetchedAt: string;         // ISO timestamp de última ingesta
    };
    refresh?: {
      forced: boolean;
      attempted: boolean;
      status: 'skipped_ttl' | 'completed' | 'timeout' | 'error';
      timeoutMs: number;
      durationMs: number;
      pending: boolean;
      queryUsed?: string;
      ingest: null | {
        totalFetched: number;
        newArticles: number;
        duplicates: number;
        errors: number;
        source: string;
        timestamp: string;
      };
    };
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

  const res = await fetchWithTimeout(
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

  const res = await fetchWithTimeout(`${API_BASE_URL}/api/news/${id}`, {
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
  const payload: Record<string, unknown> = { articleId };

  const res = await fetchWithTimeout(`${API_BASE_URL}/api/analyze/article`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const parsedError = extractApiError(errorData, `Failed to analyze article: ${res.status}`);
    throw new APIError(parsedError.message, parsedError.code, parsedError.details);
  }

  return res.json();
}

/**
 * Analyze a single article with AI using an explicit cost mode.
 * Requires authentication token.
 */
export async function analyzeArticleWithMode(
  articleId: string,
  token: string,
  analysisMode: AnalysisMode,
  mode: AnalyzeDepthMode = 'standard'
): Promise<AnalyzeResponse> {
  const payload: Record<string, unknown> = { articleId, analysisMode, mode };

  const res = await fetchWithTimeout(`${API_BASE_URL}/api/analyze/article`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const parsedError = extractApiError(errorData, `Failed to analyze article: ${res.status}`);
    throw new APIError(parsedError.message, parsedError.code, parsedError.details);
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
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/analyze/stats`, {
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
 * Sprint 30: Custom error class to preserve backend errorCode (e.g., CHAT_FEATURE_LOCKED)
 */
export class APIError extends Error {
  constructor(
    message: string,
    public errorCode?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Chat response from backend
 */
export interface ChatResponse {
  success: boolean;
  data: {
    articleId?: string; // Optional when low_context (Sprint 29)
    articleTitle?: string; // Optional when low_context (Sprint 29)
    response: string;
  };
  meta?: {
    low_context?: boolean; // Sprint 29: Graceful Degradation flag
  };
  message: string;
}

/**
 * Send a chat message about an article
 * Sprint 30: Requires authentication and Premium plan (7-day trial for new users)
 */
export async function chatWithArticle(
  articleId: string,
  messages: ChatMessage[],
  token: string
): Promise<ChatResponse> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/chat/article`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ articleId, messages }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    // Sprint 30: Preserve errorCode for frontend handling (e.g., CHAT_FEATURE_LOCKED)
    throw new APIError(
      errorData.message || `Chat failed: ${res.status}`,
      errorData.errorCode,
      errorData.details
    );
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
 * Sprint 30: Requires authentication and Premium plan (7-day trial for new users)
 */
export async function chatGeneral(
  messages: ChatMessage[],
  token: string
): Promise<ChatGeneralResponse> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/chat/general`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    // Sprint 30: Preserve errorCode for frontend handling (e.g., CHAT_FEATURE_LOCKED)
    throw new APIError(
      errorData.message || `Chat failed: ${res.status}`,
      errorData.errorCode,
      errorData.details
    );
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
  const res = await fetchWithTimeout(
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
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/news/${articleId}/favorite`, {
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

  const res = await fetchWithTimeout(
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
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/ingest/news`, {
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
  token?: string,
  refresh = false
): Promise<NewsResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const query = new URLSearchParams({
    category,
    limit: String(limit),
    offset: String(offset),
  });
  if (refresh) {
    query.set('refresh', 'true');
  }

  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/news?${query.toString()}`,
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
 * Force refresh local news (bypasses local ingestion TTL on backend).
 */
export async function refreshLocalNews(
  token: string,
  limit = 20,
  offset = 0
): Promise<NewsResponse> {
  return fetchNewsByCategory('local', limit, offset, token, true);
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
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/sources/discover`, {
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
 * Discover local RSS sources for a region using AI
 * FEATURE: SMART LOCAL SOURCES DISCOVERY (Sprint 32)
 */
export interface DiscoveredLocalSource {
  name: string;
  url: string;
  rssUrl: string;
  region: string;
  verified: boolean;
}

export interface DiscoverLocalSourcesResponse {
  success: boolean;
  data?: {
    sources: DiscoveredLocalSource[];
    fromCache: boolean;
    location: string;
  };
  error?: string;
  message?: string;
}

/**
 * Discover local/regional newspapers using AI with cache
 * FEATURE: RSS AUTO-DISCOVERY LOCAL (Sprint 32)
 *
 * @param location Ubicación (ciudad, provincia o región)
 * @param limit Número máximo de fuentes a descubrir (default: 10)
 * @returns Array de fuentes descubiertas
 */
export async function discoverLocalSources(
  location: string,
  limit: number = 10
): Promise<DiscoveredLocalSource[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/sources/discover-local`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ location, limit }),
  });

  const data: DiscoverLocalSourcesResponse = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || 'No se pudieron descubrir fuentes locales');
  }

  return data.data?.sources || [];
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
  entitlements: UserEntitlements;
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

export interface UserEntitlements {
  deepAnalysis: boolean;
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
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/user/me`, {
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
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/user/me`, {
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
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/user/token-usage`, {
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
