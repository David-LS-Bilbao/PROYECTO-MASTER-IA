/**
 * GeminiClient Retry Logic Tests - ZONA CRÍTICA (Resiliencia)
 *
 * OBJETIVO: Validar que el patrón Retry with Exponential Backoff funciona correctamente
 *
 * TEST CASES:
 * - Happy Path: API responde bien a la primera
 * - Resilience: API falla con 429/5xx pero tiene éxito en reintentos
 * - Exhaustion: API falla más veces que el límite de reintentos
 * - Non-Retryable: Errores 401/404 no deben reintentarse
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiClient } from '../../../src/infrastructure/external/gemini.client';
import { TokenTaximeter } from '../../../src/infrastructure/monitoring/token-taximeter';
import { ExternalAPIError } from '../../../src/domain/errors/infrastructure.error';

// ============================================================================
// MOCK DE @google/generative-ai
// ============================================================================

// Mock del SDK de Google
const mockGenerateContent = vi.fn();
const mockEmbedContent = vi.fn();
const mockCountTokens = vi.fn();

vi.mock('@google/generative-ai', () => {
  // Mock de la clase GoogleGenerativeAI como constructor
  class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return {
        generateContent: mockGenerateContent,
        countTokens: mockCountTokens,
        embedContent: mockEmbedContent,
      };
    }
  }

  return {
    GoogleGenerativeAI: MockGoogleGenerativeAI,
  };
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe('GeminiClient - Retry Logic & Resilience', () => {
  let geminiClient: GeminiClient;
  let tokenTaximeter: TokenTaximeter;

  beforeEach(() => {
    // BLOQUEANTE #2: Crear instancia fresca de TokenTaximeter
    tokenTaximeter = new TokenTaximeter();

    // BLOQUEANTE #2: Inyectar TokenTaximeter en el constructor (DI Pattern)
    geminiClient = new GeminiClient('test-api-key-123', tokenTaximeter);

    // Limpiar mocks antes de cada test
    vi.clearAllMocks();

    // Mock de timers para acelerar los tests (no esperar delays reales)
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ==========================================================================
  // TEST CASE 1: HAPPY PATH - API responde bien a la primera
  // ==========================================================================

  describe('Happy Path - API responde bien a la primera', () => {
    it('should analyze article successfully on first attempt', async () => {
      // ARRANGE: Mock de respuesta exitosa
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            summary: 'Test summary',
            biasScore: 0,
            biasIndicators: ['neutral language'],
            clickbaitScore: 20,
            reliabilityScore: 90,
            sentiment: 'neutral',
            mainTopics: ['technology', 'AI'],
            factCheck: {
              claims: ['AI is advancing rapidly'],
              verdict: 'SupportedByArticle',
              reasoning: 'Supported by multiple sources',
            },
          }),
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 50,
            totalTokenCount: 150,
          },
        },
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      // ACT: Llamar al método
      const result = await geminiClient.analyzeArticle({
        title: 'Test Article',
        content: 'This is a test article with enough content to analyze properly and pass validation.',
        source: 'Test Source',
        language: 'es',
      });

      // ASSERT: Verificar resultado
      expect(result).toBeDefined();
      expect(result.summary).toBe('Test summary');
      expect(result.biasScore).toBe(0); // Normalizado
      expect(result.clickbaitScore).toBe(20);
      expect(result.reliabilityScore).toBeGreaterThanOrEqual(0);
      expect(result.reliabilityScore).toBeLessThanOrEqual(100);

      // Verificar que se llamó solo UNA vez (sin reintentos)
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should generate embedding successfully on first attempt', async () => {
      // ARRANGE: Mock de respuesta de embedding
      const mockEmbeddingResponse = {
        embedding: {
          values: new Array(768).fill(0).map(() => Math.random()),
        },
      };

      mockEmbedContent.mockResolvedValueOnce(mockEmbeddingResponse);

      // ACT
      const result = await geminiClient.generateEmbedding('Test text to embed');

      // ASSERT
      expect(result).toHaveLength(768);
      expect(mockEmbedContent).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // TEST CASE 2: RESILIENCE - API falla pero tiene éxito en 2º intento
  // ==========================================================================

  describe('Resilience - API falla con 429/5xx pero tiene éxito en reintentos', () => {
    it('should retry on 429 Rate Limit and succeed on 2nd attempt', async () => {
      // ARRANGE: Primera llamada falla con rate limit, segunda tiene éxito
      const rateLimitError = new Error('RESOURCE_EXHAUSTED: quota exceeded');
      const successResponse = {
        response: {
          text: () => JSON.stringify({
            summary: 'Test summary after retry',
            biasScore: 0,
            biasIndicators: [],
            clickbaitScore: 30,
            reliabilityScore: 85,
            sentiment: 'neutral',
            mainTopics: ['test'],
            factCheck: {
              claims: ['test claim'],
              verdict: 'SupportedByArticle',
              reasoning: 'test reasoning',
            },
          }),
          usageMetadata: null,
        },
      };

      mockGenerateContent
        .mockRejectedValueOnce(rateLimitError) // 1er intento: FALLA
        .mockResolvedValueOnce(successResponse); // 2do intento: ÉXITO

      // ACT: Ejecutar análisis (debería esperar 1s antes del 2do intento)
      const promise = geminiClient.analyzeArticle({
        title: 'Test Article',
        content: 'Content for retry test with enough characters to pass validation.',
        source: 'Test Source',
        language: 'es',
      });

      // Avanzar los timers fake (1s = delay del primer reintento)
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      // ASSERT: Verificar que reintentó y tuvo éxito
      expect(result).toBeDefined();
      expect(result.summary).toBe('Test summary after retry');
      expect(mockGenerateContent).toHaveBeenCalledTimes(2); // 1 fallo + 1 éxito
    });

    it('should retry on 503 Server Error and succeed on 3rd attempt', async () => {
      // ARRANGE: 2 fallos (503) + 1 éxito
      const serverError = new Error('503 Service Unavailable');
      const successResponse = {
        response: {
          text: () => JSON.stringify({
            summary: 'Success after 2 retries',
            biasScore: 5,
            biasIndicators: ['slight bias'],
            clickbaitScore: 40,
            reliabilityScore: 80,
            sentiment: 'positive',
            mainTopics: ['resilience'],
            factCheck: {
              claims: ['retry works'],
              verdict: 'SupportedByArticle',
              reasoning: 'tested successfully',
            },
          }),
          usageMetadata: null,
        },
      };

      mockGenerateContent
        .mockRejectedValueOnce(serverError) // 1er intento: FALLA
        .mockRejectedValueOnce(serverError) // 2do intento: FALLA
        .mockResolvedValueOnce(successResponse); // 3er intento: ÉXITO

      // ACT
      const promise = geminiClient.analyzeArticle({
        title: 'Test Article',
        content: 'Content for server error retry test with enough content.',
        source: 'Test Source',
        language: 'es',
      });

      // Avanzar timers: 1s (1er retry) + 2s (2do retry)
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      // ASSERT
      expect(result).toBeDefined();
      expect(result.summary).toBe('Success after 2 retries');
      expect(mockGenerateContent).toHaveBeenCalledTimes(3); // 2 fallos + 1 éxito
    });

    it('should retry on network timeout and succeed eventually', async () => {
      // ARRANGE
      const timeoutError = new Error('ETIMEDOUT: request timeout');
      const successResponse = {
        embedding: {
          values: new Array(768).fill(0).map(() => 0.5),
        },
      };

      mockEmbedContent
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce(successResponse);

      // ACT
      const promise = geminiClient.generateEmbedding('Text to embed after timeout');

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      // ASSERT
      expect(result).toHaveLength(768);
      expect(mockEmbedContent).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // TEST CASE 3: EXHAUSTION - API falla más veces que los reintentos
  // ==========================================================================

  describe('Exhaustion - API falla más veces que el límite de reintentos', () => {
    it('should throw ExternalAPIError after exhausting all retries (3 attempts)', async () => {
      // ARRANGE: Fallar TODAS las veces (4 intentos = 1 inicial + 3 reintentos)
      const rateLimitError = new Error('RESOURCE_EXHAUSTED: quota exceeded');

      mockGenerateContent.mockRejectedValue(rateLimitError);

      // ACT & ASSERT
      const promise = geminiClient.analyzeArticle({
        title: 'Test Article',
        content: 'Content for exhaustion test with enough characters.',
        source: 'Test Source',
        language: 'es',
      });

      // Capturar rechazo para evitar unhandled rejection durante timers
      promise.catch(() => {});

      // Avanzar todos los delays (1s + 2s + 4s = 7s total)
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      await expect(promise).rejects.toThrow(ExternalAPIError);
      await expect(promise).rejects.toThrow(/Rate limit exceeded after retries/);

      // Verificar que se llamó exactamente 3 veces (máximo de reintentos)
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('should throw ExternalAPIError with rate limit message after exhaustion', async () => {
      // ARRANGE
      const rateLimitError = new Error('Too Many Requests - 429');

      mockEmbedContent.mockRejectedValue(rateLimitError);

      // ACT
      const promise = geminiClient.generateEmbedding('Test embedding exhaustion');

      // Capturar rechazo para evitar unhandled rejection durante timers
      promise.catch(() => {});

      await vi.advanceTimersByTimeAsync(7000); // Fast-forward todos los delays

      // ASSERT
      await expect(promise).rejects.toThrow(ExternalAPIError);
      await expect(promise).rejects.toThrow(/Rate limit exceeded after retries/);
      expect(mockEmbedContent).toHaveBeenCalledTimes(3);
    });
  });

  // ==========================================================================
  // TEST CASE 4: NON-RETRYABLE - Errores 401/404 no se reintentan
  // ==========================================================================

  describe('Non-Retryable Errors - 401/404 fallan inmediatamente', () => {
    it('should NOT retry on 401 Unauthorized (Invalid API Key)', async () => {
      // ARRANGE: Error de autenticación
      const authError = new Error('API key not valid. Please pass a valid API key.');

      mockGenerateContent.mockRejectedValue(authError); // mockRejectedValue (sin Once) para ambas llamadas

      // ACT & ASSERT
      await expect(
        geminiClient.analyzeArticle({
          title: 'Test Article',
          content: 'A'.repeat(100), // Contenido >= 50 chars para pasar validación
          source: 'Test Source',
          language: 'es',
        })
      ).rejects.toThrow(ExternalAPIError);

      await expect(
        geminiClient.analyzeArticle({
          title: 'Test Article',
          content: 'A'.repeat(100),
          source: 'Test Source',
          language: 'es',
        })
      ).rejects.toThrow(/Unauthorized|Invalid API key/);

      // CRÍTICO: Solo debe llamarse 2 veces (2 asserts, sin reintentos)
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 404 Not Found error', async () => {
      // ARRANGE
      const notFoundError = new Error('404: Model not found');

      mockGenerateContent.mockRejectedValue(notFoundError); // mockRejectedValue (sin Once) para ambas llamadas

      // ACT & ASSERT
      await expect(
        geminiClient.analyzeArticle({
          title: 'Test Article',
          content: 'B'.repeat(100), // Contenido >= 50 chars para pasar validación
          source: 'Test Source',
          language: 'es',
        })
      ).rejects.toThrow(ExternalAPIError);

      await expect(
        geminiClient.analyzeArticle({
          title: 'Test Article',
          content: 'B'.repeat(100),
          source: 'Test Source',
          language: 'es',
        })
      ).rejects.toThrow(/Model not found/);

      // Verificar que NO reintentó (solo 2 llamadas, una por cada expect)
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on Invalid Argument errors', async () => {
      // ARRANGE
      const invalidArgError = new Error('Invalid argument: content is required');

      mockEmbedContent.mockRejectedValueOnce(invalidArgError);

      // ACT & ASSERT
      await expect(
        geminiClient.generateEmbedding('Invalid test')
      ).rejects.toThrow(ExternalAPIError);

      // Sin reintentos
      expect(mockEmbedContent).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // EDGE CASES ADICIONALES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should validate content length before making API call', async () => {
      // ACT & ASSERT: Contenido muy corto (< 50 chars)
      await expect(
        geminiClient.analyzeArticle({
          title: 'Short',
          content: 'Too short', // Menos de 50 caracteres
          source: 'Test',
          language: 'es',
        })
      ).rejects.toThrow(ExternalAPIError);

      // No debería llamar a la API
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('should validate empty text for embedding generation', async () => {
      // ACT & ASSERT
      await expect(
        geminiClient.generateEmbedding('')
      ).rejects.toThrow(ExternalAPIError);

      await expect(
        geminiClient.generateEmbedding('   ')
      ).rejects.toThrow(/Text is required/);

      // No debería llamar a la API
      expect(mockEmbedContent).not.toHaveBeenCalled();
    });

    it('should handle malformed JSON response gracefully', async () => {
      // ARRANGE: Respuesta que no es JSON válido
      const malformedResponse = {
        response: {
          text: () => 'This is not JSON',
          usageMetadata: null,
        },
      };

      mockGenerateContent.mockResolvedValue(malformedResponse); // mockResolvedValue (sin Once) para ambas llamadas

      // ACT & ASSERT
      await expect(
        geminiClient.analyzeArticle({
          title: 'Test',
          content: 'C'.repeat(100), // Contenido >= 50 chars
          source: 'Test',
          language: 'es',
        })
      ).rejects.toThrow(ExternalAPIError);

      await expect(
        geminiClient.analyzeArticle({
          title: 'Test',
          content: 'C'.repeat(100),
          source: 'Test',
          language: 'es',
        })
      ).rejects.toThrow(/no JSON found|API error/);

      // Verificar que NO reintentó (error de parseo no es retryable - solo 2 llamadas)
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });
  });
});
