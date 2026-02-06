/**
 * useNews - Custom Hook con React Query
 *
 * PRIVACY FIX: Ahora pasa token de autenticacion para:
 * - Favoritos: Filtrado per-user (junction table)
 * - Noticias: Enriquecimiento con estado de favorito per-user
 */

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useCallback, useRef, useEffect } from 'react';
import {
  fetchNews,
  fetchNewsByCategory,
  fetchFavorites,
  type NewsResponse,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { CategoryId } from '@/components/category-pills';

export interface UseNewsParams {
  category?: CategoryId;
  limit?: number;
  offset?: number;
  refetchInterval?: number;
}

export function useNews(params: UseNewsParams = {}) {
  const { category = 'general', limit = 50, offset = 0, refetchInterval } = params;
  const { getToken, user } = useAuth();

  // Cache the token to avoid re-fetching on every render
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (user) {
      getToken().then(t => { tokenRef.current = t; });
    } else {
      tokenRef.current = null;
    }
  }, [user, getToken]);

  const staleTime = category === 'favorites' ? 2 * 60 * 1000 : undefined;

  return useQuery<NewsResponse>({
    queryKey: ['news', category, limit, offset],

    queryFn: async () => {
      const startTime = Date.now();

      // Get fresh token for this request
      const token = await getToken() || tokenRef.current || undefined;

      let result;
      if (category === 'favorites') {
        console.log('[useNews] Fetching FAVORITES...');
        result = await fetchFavorites(limit, offset, token);
      } else if (category === 'general') {
        console.log('[useNews] Fetching GENERAL...');
        result = await fetchNews(limit, offset, token);
      } else {
        console.log(`[useNews] Fetching ${category.toUpperCase()}...`);
        result = await fetchNewsByCategory(category, limit, offset, token);
      }

      const duration = Date.now() - startTime;
      console.log(`[useNews] "${category}" completado: ${result.data?.length || 0} articulos en ${duration}ms`);

      return result;
    },

    placeholderData: keepPreviousData,
    enabled: !!category,
    staleTime,
    refetchInterval,
    refetchIntervalInBackground: false,
  });
}

export function usePrefetchNews() {
  const queryClient = useQueryClient();

  return (params: UseNewsParams) => {
    const { category = 'general', limit = 50, offset = 0 } = params;

    queryClient.prefetchQuery({
      queryKey: ['news', category, limit, offset],
      queryFn: async () => {
        if (category === 'favorites') {
          return fetchFavorites(limit, offset);
        } else if (category === 'general') {
          return fetchNews(limit, offset);
        } else {
          return fetchNewsByCategory(category, limit, offset);
        }
      },
    });
  };
}

export function useInvalidateNews() {
  const queryClient = useQueryClient();

  return useCallback(
    (category?: CategoryId, invalidateAll: boolean = false) => {
      if (invalidateAll) {
        console.log('[Cache] Invalidando TODAS las categorias');
        queryClient.invalidateQueries({ queryKey: ['news'] });
      } else if (category) {
        console.log(`[Cache] Invalidando: ${category}`);
        queryClient.invalidateQueries({ queryKey: ['news', category] });
      } else {
        console.log('[Cache] Invalidando todas las news (fallback)');
        queryClient.invalidateQueries({ queryKey: ['news'] });
      }
    },
    [queryClient]
  );
}

export function useNewsRefresh() {
  const queryClient = useQueryClient();

  return {
    refresh: async (category?: CategoryId) => {
      if (category) {
        await queryClient.refetchQueries({
          queryKey: ['news', category],
          type: 'active',
        });
      } else {
        await queryClient.refetchQueries({
          queryKey: ['news'],
          type: 'active',
        });
      }
    },

    isRefreshing: queryClient.isFetching({ queryKey: ['news'] }) > 0,
  };
}
