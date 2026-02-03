/**
 * useArticle - Hook de React Query para fetching de artículo por ID
 * 
 * FRONTEND MODERNO (Sprint 13 - Fase C):
 * - Caché automático de artículos individuales
 * - staleTime: 5 minutos (contenido rara vez cambia)
 * - Retry automático ante errores transitorios
 * - Estado de loading/error gestionado
 */

import { useQuery } from '@tanstack/react-query';
import { fetchNewsById, type NewsArticle } from '@/lib/api';

/**
 * Parámetros para fetching de artículo
 */
export interface UseArticleParams {
  id: string | null | undefined;
}

/**
 * Hook para fetching de artículo individual con React Query
 * 
 * Características:
 * - Query key: ['article', id] → caché por artículo
 * - staleTime: 5 minutos (artículos publicados no cambian)
 * - enabled: !!id (solo fetch si hay ID válido)
 * - Retry: 3 intentos con exponential backoff
 * 
 * @param params - ID del artículo a cargar
 * @returns { article, isLoading, isError, error, refetch }
 */
export function useArticle({ id }: UseArticleParams) {
  return useQuery<NewsArticle>({
    // Query Key: Único por artículo
    queryKey: ['article', id],

    // Query Function: Fetch artículo por ID
    queryFn: async () => {
      if (!id) {
        throw new Error('Article ID is required');
      }

      const response = await fetchNewsById(id);
      return response.data;
    },

    // Enabled: Solo ejecutar si hay ID válido
    enabled: !!id,

    // staleTime: 5 minutos (contenido de noticia rara vez cambia)
    staleTime: 5 * 60 * 1000,

    // gcTime: 10 minutos (mantener en caché incluso si no se usa)
    gcTime: 10 * 60 * 1000,

    // retry: 3 intentos (config global de QueryClient)
    // retry: 3, (ya configurado en QueryProvider)
  });
}

/**
 * Hook helper: Invalidar caché de artículo
 * 
 * Útil después de analizar o actualizar un artículo
 * para refrescar los datos desde el servidor.
 */
export function useInvalidateArticle() {
  const { useQueryClient } = require('@tanstack/react-query');
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.invalidateQueries({ queryKey: ['article', id] });
  };
}
