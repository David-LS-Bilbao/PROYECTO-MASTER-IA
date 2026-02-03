/**
 * Custom Hook: useArticleAnalysis
 * Manages article analysis state and API calls
 */

import { useState, useCallback } from 'react';
import { analyzeArticle, type AnalyzeResponse, type TokenUsage } from '@/lib/api';
import { toast } from 'sonner';

interface UseArticleAnalysisReturn {
  data: AnalyzeResponse['data'] | null;
  usage: TokenUsage | null;
  loading: boolean;
  error: Error | null;
  analyze: (articleId: string, token: string) => Promise<void>;
  reset: () => void;
}

export function useArticleAnalysis(): UseArticleAnalysisReturn {
  const [data, setData] = useState<AnalyzeResponse['data'] | null>(null);
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const analyze = useCallback(async (articleId: string, token: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    setUsage(null);

    try {
      const response = await analyzeArticle(articleId, token);

      // Parse and store analysis data
      setData(response.data);

      // Parse and store token usage (if available)
      if (response.usage) {
        setUsage(response.usage);
      }

      // Success toast
      toast.success('Artículo analizado correctamente', {
        description: response.usage 
          ? `Coste: €${response.usage.costEstimated.toFixed(4)}` 
          : undefined,
      });
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Error desconocido al analizar');
      setError(errorObj);

      // Error toast
      toast.error('Error al analizar el artículo', {
        description: errorObj.message,
      });

      throw errorObj; // Re-throw para que el consumidor pueda manejarlo si quiere
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setUsage(null);
    setLoading(false);
    setError(null);
  }, []);

  return {
    data,
    usage,
    loading,
    error,
    analyze,
    reset,
  };
}
