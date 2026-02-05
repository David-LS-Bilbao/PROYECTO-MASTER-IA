/**
 * useNews - Custom Hook con React Query
 *
 * FRONTEND MODERNO (Sprint 13 - Fase C + Sprint 16 UX Polish):
 * - Caché automático de noticias por categoría
 * - Reintentos automáticos ante errores
 * - Prefetching para UX optimizada
 * - Estados de loading/error gestionados
 * - Estrategia de "Freshness" diferenciada por tipo de contenido
 *
 * CAMBIOS SPRINT 16:
 * - staleTime diferenciado: Favoritos (2 min) vs Noticias (30s global)
 * - refetchInterval opcional para mantener noticias actualizadas en background
 * - Logging mejorado para debugging de freshness
 */

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useCallback } from 'react';
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
  /**
   * Habilitar refetch automático en background (en ms)
   * Útil para la vista principal de noticias (no para modales/detalles)
   * Ejemplo: 60000 = refetch cada 1 minuto si el componente está visible
   */
  refetchInterval?: number;
}

/**
 * Hook para fetching de noticias con React Query
 *
 * Características:
 * - Query key dinámico por categoría/filtros
 * - Caché compartida entre componentes
 * - Prefetching automático de siguiente página
 * - placeholderData para evitar parpadeos al paginar
 * - staleTime adaptativo según tipo de contenido
 *
 * ESTRATEGIA DE FRESHNESS (Sprint 16):
 * - Favoritos: staleTime = 2 min (solo cambian por acción del usuario)
 * - Noticias: staleTime = 30s (heredado de QueryProvider, contenido dinámico)
 * - refetchOnMount = 'always' (heredado): Siempre verificar al cambiar categoría
 * - refetchOnWindowFocus = true (heredado): Verificar al volver a la pestaña
 *
 * @param params - Filtros de búsqueda (category, limit, offset, refetchInterval)
 * @returns { news, isLoading, isError, error, refetch, isFetching }
 */
export function useNews(params: UseNewsParams = {}) {
  const { category = 'general', limit = 50, offset = 0, refetchInterval } = params;

  // Determinar staleTime según tipo de contenido
  // Favoritos: Menos agresivo (2 min) - Solo cambian con acciones del usuario
  // Noticias: Más agresivo (30s, heredado del QueryProvider global)
  const staleTime = category === 'favorites' ? 2 * 60 * 1000 : undefined; // 2 min para favoritos, undefined = usar global

  return useQuery<NewsResponse>({
    // Query Key: Única por categoría y filtros
    // Cambia automáticamente cuando params cambia → refetch automático
    queryKey: ['news', category, limit, offset],

    // Query Function: Fetcher apropiado según categoría
    queryFn: async () => {
      const startTime = Date.now();

      let result;
      if (category === 'favorites') {
        console.log('⭐ [useNews] Fetching FAVORITES...');
        result = await fetchFavorites(limit, offset);
      } else if (category === 'general') {
        console.log('📡 [useNews] Fetching GENERAL...');
        result = await fetchNews(limit, offset);
      } else {
        console.log(`📂 [useNews] Fetching ${category.toUpperCase()}...`);
        result = await fetchNewsByCategory(category, limit, offset);
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [useNews] "${category}" completado: ${result.data?.length || 0} artículos en ${duration}ms`);

      return result;
    },

    // Placeholder Data: Mantener datos previos durante refetch
    // Evita parpadeos al cambiar de página o filtro
    placeholderData: keepPreviousData,

    // Enabled: Solo ejecutar si hay categoría válida
    enabled: !!category,

    // STALE TIME: Diferenciado por tipo de contenido
    staleTime,

    // REFETCH INTERVAL: Opcional, solo para vistas principales
    // Si está habilitado, refetcheará automáticamente cada X ms mientras el componente está montado y visible
    refetchInterval,
    refetchIntervalInBackground: false, // Solo refetch si la pestaña está activa

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
 * Útil después de mutaciones (favoritos, análisis, ingesta)
 *
 * SPRINT 16 FIX (Duplicados):
 * - Memoizada con useCallback para evitar re-renders innecesarios
 * - Evita que useEffect se dispare por cambios de identidad de la función
 * - IMPORTANTE: Después de ingesta, invalidar TODAS las categorías (no solo la actual)
 *   porque un artículo puede aparecer en múltiples feeds RSS y actualizarse
 *
 * @returns Función para invalidar queries de noticias
 */
export function useInvalidateNews() {
  const queryClient = useQueryClient();

  return useCallback(
    (category?: CategoryId, invalidateAll: boolean = false) => {
      if (invalidateAll) {
        console.log('🔄 [Cache] Invalidando TODAS las categorías');
        queryClient.invalidateQueries({ queryKey: ['news'] });
      } else if (category) {
        console.log(`🔄 [Cache] Invalidando: ${category}`);
        queryClient.invalidateQueries({ queryKey: ['news', category] });
      } else {
        console.log('🔄 [Cache] Invalidando todas las news (fallback)');
        queryClient.invalidateQueries({ queryKey: ['news'] });
      }
    },
    [queryClient]
  );
}

/**
 * Hook para forzar refetch manual de la categoría actual
 * Útil para botón de "Actualizar" o "Pull to Refresh"
 *
 * SPRINT 16 UX POLISH:
 * - Permite al usuario forzar una actualización manual
 * - Marca los datos como stale y refetchea inmediatamente
 * - Devuelve el estado de loading para feedback visual
 *
 * @example
 * ```tsx
 * const { refresh, isRefreshing } = useNewsRefresh();
 *
 * <Button onClick={() => refresh('technology')} disabled={isRefreshing}>
 *   {isRefreshing ? 'Actualizando...' : 'Actualizar'}
 * </Button>
 * ```
 *
 * @returns { refresh, isRefreshing }
 */
export function useNewsRefresh() {
  const queryClient = useQueryClient();

  return {
    /**
     * Forzar refetch de una categoría específica
     * @param category - Categoría a refrescar (si no se especifica, refresca todas)
     */
    refresh: async (category?: CategoryId) => {
      if (category) {
        // Refetch específico de una categoría
        await queryClient.refetchQueries({
          queryKey: ['news', category],
          type: 'active', // Solo queries activas (montadas)
        });
      } else {
        // Refetch de todas las noticias activas
        await queryClient.refetchQueries({
          queryKey: ['news'],
          type: 'active',
        });
      }
    },

    /**
     * Verifica si hay algún refetch en progreso
     */
    isRefreshing: queryClient.isFetching({ queryKey: ['news'] }) > 0,
  };
}
