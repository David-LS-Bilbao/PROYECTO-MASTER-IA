/**
 * useNews - Custom Hook con React Query
 *
 * PRIVACY FIX: Ahora pasa token de autenticacion para:
 * - Favoritos: Filtrado per-user (junction table)
 * - Noticias: Enriquecimiento con estado de favorito per-user
 *
 * SPRINT 22: Actualizado para aceptar cualquier topic (string) en lugar de string
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

export interface UseNewsParams {
  category?: string; // Sprint 22: Cambiado de string a string para soportar topics dinámicos
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

  const staleTime = (category as string) === 'favorites' ? 2 * 60 * 1000 : undefined;

  return useQuery<NewsResponse>({
    queryKey: ['news', category, limit, offset],

    queryFn: async () => {
      const startTime = Date.now();

      // Get fresh token for this request
      const token = await getToken() || tokenRef.current || undefined;

      let result;
      if ((category as string) === 'favorites') {
        result = await fetchFavorites(limit, offset, token);
      } else if (category === 'general') {
        result = await fetchNews(limit, offset, token);
      } else {
        result = await fetchNewsByCategory(category, limit, offset, token);
      }

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
        if ((category as string) === 'favorites') {
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
    (category?: string, invalidateAll: boolean = false) => {
      if (invalidateAll) {
        queryClient.invalidateQueries({ queryKey: ['news'] });
      } else if (category) {
        queryClient.invalidateQueries({ queryKey: ['news', category] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['news'] });
      }
    },
    [queryClient]
  );
}

export function useNewsRefresh() {
  const queryClient = useQueryClient();

  return {
    refresh: async (category?: string) => {
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

/**
 * Global Refresh Hook - Ingesta masiva de todas las categorías
 *
 * Llama al endpoint POST /api/ingest/all para actualizar
 * todas las categorías de noticias de una sola vez.
 */
export function useGlobalRefresh() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const cronSecret = process.env.NEXT_PUBLIC_CRON_SECRET || '';

    try {
      // POST to /api/ingest/all
      const response = await fetch(`${API_BASE_URL}/api/ingest/all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': cronSecret,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Invalidar TODAS las queries de news para forzar refetch
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const [base] = query.queryKey;
          return base === 'news' || base === 'news-infinite';
        },
        refetchType: 'active',
      });

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      console.error('❌ [GlobalRefresh] Error:', error);
      throw error;
    }
  }, [queryClient]);
}
