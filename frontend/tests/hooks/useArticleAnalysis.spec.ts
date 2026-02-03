/**
 * Tests for useArticleAnalysis Hook
 * 
 * Cobertura:
 * - Análisis exitoso con coste
 * - Manejo de errores con toasts
 * - Estados de loading
 * - Reset de estado
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useArticleAnalysis } from '@/hooks/useArticleAnalysis';
import { toast } from 'sonner';
import type { AnalyzeResponse } from '@/lib/api';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useArticleAnalysis', () => {
  const mockArticleId = '550e8400-e29b-41d4-a716-446655440000';
  const mockToken = 'mock-jwt-token';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Estado inicial', () => {
    it('debe inicializar con valores por defecto', () => {
      const { result } = renderHook(() => useArticleAnalysis());

      expect(result.current.data).toBeNull();
      expect(result.current.usage).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Análisis exitoso con coste', () => {
    it('debe parsear correctamente la respuesta con usage y costEstimated', async () => {
      const mockResponse: AnalyzeResponse = {
        success: true,
        data: {
          articleId: mockArticleId,
          summary: 'Resumen del artículo de prueba',
          biasScore: 0.45,
          analysis: {
            summary: 'Resumen del artículo de prueba',
            biasScore: 0.45,
            biasRaw: -2,
            biasIndicators: ['neutral language', 'balanced sources'],
            clickbaitScore: 15,
            reliabilityScore: 85,
            sentiment: 'neutral',
            mainTopics: ['política', 'economía'],
            factCheck: {
              claims: ['Claim 1', 'Claim 2'],
              verdict: 'Verified',
              reasoning: 'All claims verified',
            },
          },
          scrapedContentLength: 5000,
        },
        usage: {
          promptTokens: 1234,
          outputTokens: 456,
          totalTokens: 1690,
          costEstimated: 0.002235,
        },
        message: 'Article analyzed successfully',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useArticleAnalysis());

      // Estado inicial: loading false
      expect(result.current.loading).toBe(false);

      // Ejecutar análisis dentro de act
      await act(async () => {
        await result.current.analyze(mockArticleId, mockToken);
      });

      // Después de completar: loading false
      expect(result.current.loading).toBe(false);

      // Verificar datos parseados correctamente
      expect(result.current.data).toEqual(mockResponse.data);
      expect(result.current.error).toBeNull();

      // Verificar usage parseado correctamente
      expect(result.current.usage).toBeDefined();
      expect(result.current.usage).toEqual({
        promptTokens: 1234,
        outputTokens: 456,
        totalTokens: 1690,
        costEstimated: 0.002235,
      });

      // Verificar que costEstimated es un número válido
      expect(typeof result.current.usage!.costEstimated).toBe('number');
      expect(result.current.usage!.costEstimated).toBeGreaterThan(0);

      // Verificar toast de éxito con coste
      expect(toast.success).toHaveBeenCalledWith(
        'Artículo analizado correctamente',
        {
          description: 'Coste: €0.0022',
        }
      );

      // Verificar fetch llamado correctamente
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/analyze/article',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockToken}`,
          },
          body: JSON.stringify({ articleId: mockArticleId }),
        }
      );
    });

    it('debe manejar respuesta exitosa sin usage (campo opcional)', async () => {
      const mockResponseWithoutUsage: AnalyzeResponse = {
        success: true,
        data: {
          articleId: mockArticleId,
          summary: 'Resumen sin coste',
          biasScore: 0.5,
          analysis: {
            summary: 'Resumen sin coste',
            biasScore: 0.5,
            biasRaw: 0,
            biasIndicators: [],
            clickbaitScore: 20,
            reliabilityScore: 80,
            sentiment: 'neutral',
            mainTopics: ['test'],
            factCheck: {
              claims: [],
              verdict: 'Unproven',
              reasoning: 'No data',
            },
          },
          scrapedContentLength: 1000,
        },
        // No incluye usage
        message: 'Article analyzed successfully',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponseWithoutUsage,
      });

      const { result } = renderHook(() => useArticleAnalysis());

      await act(async () => {
        await result.current.analyze(mockArticleId, mockToken);
      });

      // Verificar datos parseados
      expect(result.current.data).toEqual(mockResponseWithoutUsage.data);

      // Verificar que usage es null cuando no viene del backend
      expect(result.current.usage).toBeNull();

      // Toast sin descripción de coste
      expect(toast.success).toHaveBeenCalledWith(
        'Artículo analizado correctamente',
        {
          description: undefined,
        }
      );
    });
  });

  describe('Manejo de errores', () => {
    it('debe manejar error 500 del servidor', async () => {
      const mockErrorResponse = {
        success: false,
        error: 'Internal Server Error',
        message: 'Gemini API timeout',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => mockErrorResponse,
      });

      const { result } = renderHook(() => useArticleAnalysis());

      let thrownError: Error | null = null;

      await act(async () => {
        try {
          await result.current.analyze(mockArticleId, mockToken);
        } catch (err) {
          thrownError = err as Error;
        }
      });

      // Verificar error seteado
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toContain('Gemini API timeout');
      expect(thrownError).not.toBeNull();

      // Verificar datos limpios
      expect(result.current.data).toBeNull();
      expect(result.current.usage).toBeNull();

      // Verificar toast de error
      expect(toast.error).toHaveBeenCalledWith(
        'Error al analizar el artículo',
        {
          description: expect.stringContaining('Gemini API timeout'),
        }
      );
    });

    it('debe manejar error 401 (no autorizado)', async () => {
      const mockErrorResponse = {
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => mockErrorResponse,
      });

      const { result } = renderHook(() => useArticleAnalysis());

      let thrownError: Error | null = null;

      await act(async () => {
        try {
          await result.current.analyze(mockArticleId, mockToken);
        } catch (err) {
          thrownError = err as Error;
        }
      });

      // Verificar error
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toContain('Invalid or expired token');
      expect(thrownError).not.toBeNull();

      // Verificar toast
      expect(toast.error).toHaveBeenCalled();
    });

    it('debe manejar error de red (fetch fallido)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error: Failed to fetch'));

      const { result } = renderHook(() => useArticleAnalysis());

      let thrownError: Error | null = null;

      await act(async () => {
        try {
          await result.current.analyze(mockArticleId, mockToken);
        } catch (err) {
          thrownError = err as Error;
        }
      });

      // Verificar error de red
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Network error: Failed to fetch');
      expect(thrownError).not.toBeNull();

      // Verificar toast
      expect(toast.error).toHaveBeenCalledWith(
        'Error al analizar el artículo',
        {
          description: 'Network error: Failed to fetch',
        }
      );
    });

    it('debe manejar error JSON malformado', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const { result } = renderHook(() => useArticleAnalysis());

      let thrownError: Error | null = null;

      await act(async () => {
        try {
          await result.current.analyze(mockArticleId, mockToken);
        } catch (err) {
          thrownError = err as Error;
        }
      });

      // Verificar error
      expect(result.current.error).not.toBeNull();
      expect(thrownError).not.toBeNull();
    });
  });

  describe('Función reset', () => {
    it('debe limpiar todos los estados al llamar reset', async () => {
      const mockResponse: AnalyzeResponse = {
        success: true,
        data: {
          articleId: mockArticleId,
          summary: 'Test',
          biasScore: 0.5,
          analysis: {
            summary: 'Test',
            biasScore: 0.5,
            biasRaw: 0,
            biasIndicators: [],
            clickbaitScore: 10,
            reliabilityScore: 90,
            sentiment: 'neutral',
            mainTopics: [],
            factCheck: {
              claims: [],
              verdict: 'Verified',
              reasoning: '',
            },
          },
          scrapedContentLength: 100,
        },
        usage: {
          promptTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          costEstimated: 0.001,
        },
        message: 'Success',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useArticleAnalysis());

      // Ejecutar análisis
      await act(async () => {
        await result.current.analyze(mockArticleId, mockToken);
      });

      // Verificar que hay datos
      expect(result.current.data).not.toBeNull();
      expect(result.current.usage).not.toBeNull();

      // Ejecutar reset
      act(() => {
        result.current.reset();
      });

      // Verificar que todo se limpió
      expect(result.current.data).toBeNull();
      expect(result.current.usage).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('debe manejar múltiples llamadas consecutivas correctamente', async () => {
      const mockResponse1: AnalyzeResponse = {
        success: true,
        data: {
          articleId: 'article-1',
          summary: 'First',
          biasScore: 0.3,
          analysis: {
            summary: 'First',
            biasScore: 0.3,
            biasRaw: -1,
            biasIndicators: [],
            clickbaitScore: 5,
            reliabilityScore: 95,
            sentiment: 'neutral',
            mainTopics: [],
            factCheck: {
              claims: [],
              verdict: 'Verified',
              reasoning: '',
            },
          },
          scrapedContentLength: 200,
        },
        usage: {
          promptTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          costEstimated: 0.001,
        },
        message: 'Success',
      };

      const mockResponse2: AnalyzeResponse = {
        ...mockResponse1,
        data: {
          ...mockResponse1.data,
          articleId: 'article-2',
          summary: 'Second',
        },
        usage: {
          promptTokens: 200,
          outputTokens: 100,
          totalTokens: 300,
          costEstimated: 0.002,
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse2,
        });

      const { result } = renderHook(() => useArticleAnalysis());

      // Primera llamada
      await act(async () => {
        await result.current.analyze('article-1', mockToken);
      });

      expect(result.current.data?.articleId).toBe('article-1');
      expect(result.current.usage?.costEstimated).toBe(0.001);

      // Segunda llamada - debe sobrescribir la primera
      await act(async () => {
        await result.current.analyze('article-2', mockToken);
      });

      expect(result.current.data?.articleId).toBe('article-2');
      expect(result.current.usage?.costEstimated).toBe(0.002);

      // Verificar que se llamó toast 2 veces
      expect(toast.success).toHaveBeenCalledTimes(2);
    });
  });
});
