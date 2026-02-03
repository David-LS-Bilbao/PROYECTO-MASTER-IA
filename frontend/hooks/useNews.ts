/**
 * useNews - Custom Hook con React Query
 * 
 * FRONTEND MODERNO (Sprint 13 - Fase C):
 * - Caché automático de noticias por categoría
 * - Reintentos automáticos ante errores
 * - Prefetching para UX optimizada
 * - Estados de loading/error gestionados
 */

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  fetchNews,
  fetchNewsByCategory,
  fetchFavorites,
  type NewsResponse,
} from '@/lib/api';
import type { CategoryId } from '@/components/category-pills';

/**
 * Parámetros para filtrado de noticias
 */
export interface UseNewsParams {
  category?: CategoryId;
  limit?: number;
  offset?: number;
}

/**
 * Hook para fetching de noticias con React Query
 * 
 * Características:
 * - Query key dinámico por categoría/filtros
 * - Caché compartida entre componentes
 * - Prefetching automático de siguiente página
 * - placeholderData para evitar parpadeos al paginar
 * 
 * @param params - Filtros de búsqueda (category, limit, offset)
 * @returns { news, isLoading, isError, error, refetch }
 */
export function useNews(params: UseNewsParams = {}) {
  const { category = 'general', limit = 50, offset = 0 } = params;

  console.log('📰 [useNews] Hook montado/actualizado. Category:', category);

  return useQuery<NewsResponse>({
    // Query Key: Única por categoría y filtros
    // Cambia automáticamente cuando params cambia → refetch automático
    queryKey: ['news', category, limit, offset],

    // Query Function: Fetcher apropiado según categoría
    queryFn: async () => {
      console.log('🌐 [useNews] ========== EJECUTANDO queryFn ==========');
      console.log('🌐 [useNews] Category:', category, '| Limit:', limit, '| Offset:', offset);
      const startTime = Date.now();
      
      let result;
      if (category === 'favorites') {
        console.log('⭐ [useNews] Fetching FAVORITES...');
        result = await fetchFavorites(limit, offset);
      } else if (category === 'general') {
        console.log('📡 [useNews] Fetching GENERAL...');
        result = await fetchNews(limit, offset);
      } else {
        console.log(`📂 [useNews] Fetching CATEGORY: ${category}...`);
        result = await fetchNewsByCategory(category, limit, offset);
      }
      
      const duration = Date.now() - startTime;
      console.log(`✅ [useNews] Fetch completado en ${duration}ms. Artículos:`, result.data?.length || 0);
      console.log('✅ [useNews] ========== FIN queryFn ==========');
      
      return result;
    },

    // Placeholder Data: Mantener datos previos durante refetch
    // Evita parpadeos al cambiar de página o filtro
    placeholderData: keepPreviousData,

    // Enabled: Solo ejecutar si hay categoría válida
    enabled: !!category,

    // Error Handling: Personalizable por componente
    // retry: 3 (configuración global del QueryClient)
    // retryDelay: exponential backoff (configuración global)
  });
}

/**
 * Hook para prefetching de noticias
 * Útil para precarga de siguiente página mientras el usuario navega
 * 
 * @param params - Parámetros de la query a prefetchear
 */
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

/**
 * Hook para invalidación manual de caché de noticias
 * Útil después de mutaciones (favoritos, análisis)
 */
export function useInvalidateNews() {
  const queryClient = useQueryClient();

  return (category?: CategoryId) => {
    if (category) {
      // Invalidar solo una categoría específica
      queryClient.invalidateQueries({ queryKey: ['news', category] });
    } else {
      // Invalidar todas las noticias
      queryClient.invalidateQueries({ queryKey: ['news'] });
    }
  };
}
