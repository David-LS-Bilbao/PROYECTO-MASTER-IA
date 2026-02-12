/**
 * useNewsInfinite - Infinite Scroll Hook con React Query
 *
 * SPRINT 20: Infinite Scroll para eliminar paginación estática
 * - Usa useInfiniteQuery para cargar páginas bajo demanda
 * - Compatible con autenticación per-user (favoritos)
 * - Integración con react-intersection-observer
 *
 * SPRINT 22: Actualizado para aceptar cualquier topic (string) en lugar de CategoryId
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  fetchNews,
  fetchNewsByCategory,
  fetchFavorites,
  type NewsResponse,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export interface UseNewsInfiniteParams {
  category?: string; // Sprint 22: Cambiado de CategoryId a string para soportar topics dinámicos
  limit?: number;
}

export function useNewsInfinite(params: UseNewsInfiniteParams = {}) {
  const { category = 'general', limit = 20 } = params;
  const { getToken, user, loading: authLoading } = useAuth();
  const requiresAuth = category === 'local' || category === 'favorites';

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

  return useInfiniteQuery<NewsResponse>({
    queryKey: ['news-infinite', category, limit, user?.uid ?? 'anon'],

    queryFn: async ({ pageParam = 0 }) => {
      const offset = pageParam as number;

      // Get fresh token for this request
      const token = await getToken() || tokenRef.current || undefined;
      if (requiresAuth && !token) {
        throw new Error('Authentication token not ready yet');
      }

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

    initialPageParam: 0,

    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.pagination.hasMore) {
        return undefined;
      }
      return allPages.length * limit;
    },

    staleTime,
    enabled: !!category && (!requiresAuth || (!authLoading && !!user)),
  });
}
