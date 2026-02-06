/**
 * useArticle - Hook de React Query para fetching de articulo por ID
 *
 * PRIVACY: Pasa token de autenticacion para enriquecer con estado de favorito per-user.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchNewsById, type NewsArticle } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export interface UseArticleParams {
  id: string | null | undefined;
}

export function useArticle({ id }: UseArticleParams) {
  const { getToken, user } = useAuth();

  return useQuery<NewsArticle>({
    queryKey: ['article', id],

    queryFn: async () => {
      console.log(`[useArticle] 🔵 Fetching article: ${id?.substring(0, 8)}...`);
      if (!id) {
        throw new Error('Article ID is required');
      }

      // Get auth token for per-user favorite enrichment
      const token = user ? await getToken() || undefined : undefined;
      console.log(`[useArticle]    Token: ${token ? 'YES' : 'NO'}, User: ${user?.email || 'anonymous'}`);

      const response = await fetchNewsById(id, token);
      console.log(`[useArticle]    ✅ Article fetched:`, {
        id: response.data.id.substring(0, 8),
        title: response.data.title.substring(0, 40),
        analyzedAt: response.data.analyzedAt ? 'YES' : 'NO',
        isFavorite: response.data.isFavorite,
        biasScore: response.data.biasScore,
        summary: response.data.summary ? `${response.data.summary.substring(0, 30)}...` : 'NO',
      });

      return response.data;
    },

    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useInvalidateArticle() {
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.invalidateQueries({ queryKey: ['article', id] });
  };
}
