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

    // =========================================================================
    // SPRINT 17: UX OPTIMIZATION - Minimum Loading Time (2 segundos)
    // =========================================================================
    // PROBLEMA: Si el análisis viene de caché (BD), la respuesta es instantánea
    // (<100ms), lo cual puede parecer un error o respuesta "falsa" al usuario.
    //
    // SOLUCIÓN: Fake delay de 2 segundos mínimos para mantener percepción de
    // valor del análisis IA, incluso cuando viene de caché global.
    //
    // BENEFICIO: Usuario percibe que se está "procesando con IA" aunque
    // internamente estemos sirviendo desde caché (optimización de costes).
    // =========================================================================
    const startTime = Date.now();
    const MIN_LOADING_TIME = 2000; // 2 segundos

    try {
      // Lanzar petición real al backend (puede ser caché o nueva análisis)
      const response = await analyzeArticle(articleId, token);

      // Calcular tiempo transcurrido
      const elapsedTime = Date.now() - startTime;
      const remainingTime = MIN_LOADING_TIME - elapsedTime;

      // Si la respuesta fue muy rápida (caché), añadir delay artificial
      if (remainingTime > 0) {
        console.log(`⏱️ [UX] Respuesta rápida (${elapsedTime}ms) - Añadiendo ${remainingTime}ms de delay para UX`);
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      } else {
        console.log(`⏱️ [UX] Análisis real completado en ${elapsedTime}ms (sin delay artificial)`);
      }

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
