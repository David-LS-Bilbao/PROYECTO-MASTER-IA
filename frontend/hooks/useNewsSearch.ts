/**
 * useNewsSearch Hook
 *
 * Hook for searching news articles with debounced queries.
 * Implements the 3-level waterfall search strategy:
 * - LEVEL 1: Quick DB search
 * - LEVEL 2: Reactive ingestion + retry
 * - LEVEL 3: Google News suggestion fallback
 *
 * Sprint 19 - Waterfall Search Engine
 */

import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';
import { useAuth } from './useAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface SearchResult {
  success: boolean;
  data: any[]; // NewsArticle[]
  level?: number; // 1, 2, or undefined for LEVEL 3
  isFresh?: boolean; // true if LEVEL 2 ingested new articles
  suggestion?: {
    message: string;
    actionText: string;
    externalLink: string;
  };
}

/**
 * Search news articles with debouncing
 *
 * @param query - Search query string
 * @param debounceDelay - Debounce delay in ms (default: 500ms)
 * @returns React Query result with search data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useNewsSearch(searchQuery);
 *
 * if (data?.suggestion) {
 *   // Show Google News fallback
 * } else if (data?.data.length > 0) {
 *   // Show results
 * }
 * ```
 */
export function useNewsSearch(query: string, debounceDelay: number = 500) {
  const debouncedQuery = useDebounce(query, debounceDelay);
  const { getToken } = useAuth();

  return useQuery<SearchResult>({
    queryKey: ['news-search', debouncedQuery],
    queryFn: async () => {
      // Empty query - return empty results without API call
      if (!debouncedQuery || debouncedQuery.trim().length === 0) {
        return { success: true, data: [], level: 0 };
      }

      // Get authentication token (optional - for per-user enrichment)
      const token = await getToken();

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_URL}/api/news/search?q=${encodeURIComponent(debouncedQuery)}&limit=20`,
        {
          method: 'GET',
          headers,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Search failed' }));
        throw new Error(errorData.error || 'Search failed');
      }

      return response.json();
    },
    enabled: !!debouncedQuery && debouncedQuery.trim().length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - cache search results
    retry: 1, // Only retry once on failure
    refetchOnWindowFocus: false, // Don't refetch when user returns to tab
  });
}
