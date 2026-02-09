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

  return useInfiniteQuery<NewsResponse>({
    queryKey: ['news-infinite', category, limit],

    queryFn: async ({ pageParam = 0 }) => {
      const offset = pageParam as number;

      console.log(`[useNewsInfinite] 📄 Fetching page: offset=${offset}, limit=${limit}, category=${category}`);

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

      console.log(`[useNewsInfinite] ✅ Page loaded: ${result.data?.length || 0} articles (offset=${offset})`);

      return result;
    },

    initialPageParam: 0,

    getNextPageParam: (lastPage, allPages) => {
      // Si la última página tiene menos artículos que el límite, no hay más páginas
      if (!lastPage.pagination.hasMore) {
        console.log(`[useNewsInfinite] 🏁 No more pages (hasMore=false)`);
        return undefined;
      }

      // Calcular el siguiente offset
      const nextOffset = allPages.length * limit;
      console.log(`[useNewsInfinite] ➡️ Next page available: offset=${nextOffset}`);

      return nextOffset;
    },

    staleTime,
    enabled: !!category,
  });
}
