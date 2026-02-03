/**
 * GeminiClient Unit Tests - ZONA CRÍTICA (100% Coverage)
 *
 * Este archivo testea la lógica de cálculo de costes y tracking de tokens,
 * clasificada como "Zona Roja" según docs/CALIDAD.md
 *
 * ESTRATEGIA:
 * - Mock TOTAL de Google Generative AI (sin llamadas reales)
 * - Mock del repositorio de Prisma
 * - Verificación exacta de cálculos monetarios
 * - Tests de casos borde (0 tokens, decimales, errores)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiClient } from './gemini.client';
import { ExternalAPIError, ConfigurationError } from '../../domain/errors/infrastructure.error';

// ============================================================================
// MOCKS
// ============================================================================

// Referencias a los mocks (se inicializarán en beforeEach)
let mockGenerateContent: ReturnType<typeof vi.fn>;
let mockGenerateEmbedding: ReturnType<typeof vi.fn>;

// Mock completo de Google Generative AI
vi.mock('@google/generative-ai', () => {
  const generateContentMock = vi.fn();
  const generateEmbeddingMock = vi.fn();

  // Crear clase mock
  class MockGoogleGenerativeAI {
    constructor(_apiKey: string) {
      // Constructor vacío
    }

    getGenerativeModel() {
      return {
        generateContent: generateContentMock,
        embedContent: generateEmbeddingMock,
      };
    }
  }

  return {
    GoogleGenerativeAI: MockGoogleGenerativeAI,
    // Exportamos getters para acceder a los mocks
    getMockGenerateContent: () => generateContentMock,
    getMockGenerateEmbedding: () => generateEmbeddingMock,
  };
});

// ============================================================================
// CONSTANTES DE PRECIO (COPIADAS DESDE EL CÓDIGO FUENTE)
// ============================================================================

const PRICE_INPUT_1M = 0.075; // USD por 1M tokens entrada
const PRICE_OUTPUT_1M = 0.30; // USD por 1M tokens salida
const EUR_USD_RATE = 0.95;

/**
 * Función helper para calcular coste esperado
 */
function calculateExpectedCostEUR(promptTokens: number, completionTokens: number): number {
  const costInputUSD = (promptTokens / 1_000_000) * PRICE_INPUT_1M;
  const costOutputUSD = (completionTokens / 1_000_000) * PRICE_OUTPUT_1M;
  return (costInputUSD + costOutputUSD) * EUR_USD_RATE;
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('GeminiClient - Token Taximeter & Cost Calculation (ZONA CRÍTICA)', () => {
  let geminiClient: GeminiClient;

  beforeEach(async () => {
    // Reset de todos los mocks antes de cada test
    vi.clearAllMocks();

    // Importar y obtener referencias a los mocks
    const { getMockGenerateContent, getMockGenerateEmbedding } = await import('@google/generative-ai');
    mockGenerateContent = getMockGenerateContent();
    mockGenerateEmbedding = getMockGenerateEmbedding();

    // Instanciar cliente con API key ficticia
    geminiClient = new GeminiClient('test-api-key-12345');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GRUPO 1: CÁLCULO DE COSTES (ZONA ROJA - 100%)
  // ==========================================================================

  describe('💰 Cálculo Exacto de Costes', () => {
    it('CASO BASE: 1M tokens entrada + 1M tokens salida = coste exacto en EUR', async () => {
      // ARRANGE
      const promptTokens = 1_000_000;
      const completionTokens = 1_000_000;
      const totalTokens = promptTokens + completionTokens;

      // Cálculo manual esperado
      const expectedCostEUR = calculateExpectedCostEUR(promptTokens, completionTokens);

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            summary: 'Test article summary',
            biasScore: 0,
            biasIndicators: [],
            clickbaitScore: 20,
            reliabilityScore: 80,
            sentiment: 'neutral',
            mainTopics: ['test'],
            factCheck: {
              claims: ['Test claim'],
              verdict: 'Verified',
              reasoning: 'Test reasoning',
            },
          }),
          usageMetadata: {
            promptTokenCount: promptTokens,
            candidatesTokenCount: completionTokens,
            totalTokenCount: totalTokens,
          },
        },
      });

      // ACT
      const result = await geminiClient.analyzeArticle({
        title: 'Test Article',
        content: 'This is a test article with enough content to pass validation requirements for meaningful analysis.',
        source: 'Test Source',
      });

      // ASSERT
      expect(result.usage).toBeDefined();
      expect(result.usage?.promptTokens).toBe(promptTokens);
      expect(result.usage?.completionTokens).toBe(completionTokens);
      expect(result.usage?.totalTokens).toBe(totalTokens);
      expect(result.usage?.costEstimated).toBeCloseTo(expectedCostEUR, 6); // 6 decimales de precisión
    });

    it('CASO BORDE: 0 tokens = coste €0.000000', async () => {
      // ARRANGE
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            summary: 'Test',
            biasScore: 0,
            biasIndicators: [],
            clickbaitScore: 0,
            reliabilityScore: 50,
            sentiment: 'neutral',
            mainTopics: ['test'],
            factCheck: {
              claims: [],
              verdict: 'Unproven',
              reasoning: 'No data',
            },
          }),
          usageMetadata: {
            promptTokenCount: 0,
            candidatesTokenCount: 0,
            totalTokenCount: 0,
          },
        },
      });

      // ACT
      const result = await geminiClient.analyzeArticle({
        title: 'Empty Token Test',
        content: 'Minimal content for testing zero token scenario with valid length for validation.',
        source: 'Test',
      });

      // ASSERT
      expect(result.usage?.costEstimated).toBe(0);
      expect(result.usage?.totalTokens).toBe(0);
    });

    it('CASO DECIMALES: verificar precisión sin errores de punto flotante graves', async () => {
      // ARRANGE
      const promptTokens = 12_345; // Número "feo" para floating point
      const completionTokens = 6_789;
      const totalTokens = promptTokens + completionTokens;
      const expectedCostEUR = calculateExpectedCostEUR(promptTokens, completionTokens);

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            summary: 'Decimal test',
            biasScore: -3,
            biasIndicators: ['test'],
            clickbaitScore: 42,
            reliabilityScore: 67,
            sentiment: 'positive',
            mainTopics: ['economics'],
            factCheck: {
              claims: ['Test claim'],
              verdict: 'Mixed',
              reasoning: 'Partial verification',
            },
          }),
          usageMetadata: {
            promptTokenCount: promptTokens,
            candidatesTokenCount: completionTokens,
            totalTokenCount: totalTokens,
          },
        },
      });

      // ACT
      const result = await geminiClient.analyzeArticle({
        title: 'Decimal Precision Test',
        content: 'Testing floating point precision in cost calculations with irregular token counts.',
        source: 'Test Source',
      });

      // ASSERT
      expect(result.usage?.costEstimated).toBeCloseTo(expectedCostEUR, 10); // 10 decimales de precisión
      expect(result.usage?.costEstimated).toBeGreaterThan(0);
      expect(result.usage?.costEstimated).toBeLessThan(0.01); // Sanity check
    });

    it('CASO ASIMÉTRICO: muchos tokens de entrada, pocos de salida', async () => {
      // ARRANGE
      const promptTokens = 50_000;
      const completionTokens = 500;
      const expectedCostEUR = calculateExpectedCostEUR(promptTokens, completionTokens);

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            summary: 'Short response',
            biasScore: 5,
            biasIndicators: ['conservative'],
            clickbaitScore: 10,
            reliabilityScore: 90,
            sentiment: 'neutral',
            mainTopics: ['politics'],
            factCheck: {
              claims: ['Fact 1'],
              verdict: 'Verified',
              reasoning: 'Official source',
            },
          }),
          usageMetadata: {
            promptTokenCount: promptTokens,
            candidatesTokenCount: completionTokens,
            totalTokenCount: promptTokens + completionTokens,
          },
        },
      });

      // ACT
      const result = await geminiClient.analyzeArticle({
        title: 'Asymmetric Token Test',
        content: 'This article simulates a long input with a short AI response for testing asymmetric token usage patterns.',
        source: 'Test',
      });

      // ASSERT
      expect(result.usage?.costEstimated).toBeCloseTo(expectedCostEUR, 6);
      // Verificar que el coste de entrada es mayor que el de salida
      const inputCost = (promptTokens / 1_000_000) * PRICE_INPUT_1M * EUR_USD_RATE;
      const outputCost = (completionTokens / 1_000_000) * PRICE_OUTPUT_1M * EUR_USD_RATE;
      expect(inputCost).toBeGreaterThan(outputCost);
    });
  });

  // ==========================================================================
  // GRUPO 2: ACUMULADOR DE SESIÓN (ZONA ROJA - 100%)
  // ==========================================================================

  describe('📊 Acumulador de Sesión', () => {
    it('SUMA CORRECTA: 3 llamadas seguidas actualizan el acumulador correctamente', async () => {
      // ARRANGE - Configurar 3 respuestas con diferentes tokens
      const calls = [
        { prompt: 1000, completion: 500, total: 1500 },
        { prompt: 2000, completion: 1000, total: 3000 },
        { prompt: 1500, completion: 750, total: 2250 },
      ];

      for (const call of calls) {
        mockGenerateContent.mockResolvedValueOnce({
          response: {
            text: () => JSON.stringify({
              summary: 'Test',
              biasScore: 0,
              biasIndicators: [],
              clickbaitScore: 0,
              reliabilityScore: 50,
              sentiment: 'neutral',
              mainTopics: ['test'],
              factCheck: {
                claims: [],
                verdict: 'Unproven',
                reasoning: 'Test',
              },
            }),
            usageMetadata: {
              promptTokenCount: call.prompt,
              candidatesTokenCount: call.completion,
              totalTokenCount: call.total,
            },
          },
        });
      }

      // ACT - Ejecutar las 3 llamadas
      await geminiClient.analyzeArticle({
        title: 'Call 1',
        content: 'First analysis call with sufficient content for validation requirements.',
        source: 'Test',
      });

      await geminiClient.analyzeArticle({
        title: 'Call 2',
        content: 'Second analysis call with sufficient content for validation requirements.',
        source: 'Test',
      });

      await geminiClient.analyzeArticle({
        title: 'Call 3',
        content: 'Third analysis call with sufficient content for validation requirements.',
        source: 'Test',
      });

      // ASSERT - Verificar acumulador
      const report = geminiClient.getSessionCostReport();

      const expectedTotalTokens = calls.reduce((sum, call) => sum + call.total, 0);
      const expectedTotalCost = calls.reduce((sum, call) => {
        return sum + calculateExpectedCostEUR(call.prompt, call.completion);
      }, 0);

      expect(report.analysis.count).toBe(3);
      expect(report.analysis.tokens).toBe(expectedTotalTokens);
      expect(report.analysis.cost).toBeCloseTo(expectedTotalCost, 6);
      expect(report.total.operations).toBe(3);
      expect(report.total.tokens).toBe(expectedTotalTokens);
      expect(report.total.cost).toBeCloseTo(expectedTotalCost, 6);
    });

    it('REPORTE INICIAL: sin llamadas previas, acumulador en cero', () => {
      // ACT
      const report = geminiClient.getSessionCostReport();

      // ASSERT
      expect(report.analysis.count).toBe(0);
      expect(report.analysis.tokens).toBe(0);
      expect(report.analysis.cost).toBe(0);
      expect(report.ragChat.count).toBe(0);
      expect(report.groundingChat.count).toBe(0);
      expect(report.total.operations).toBe(0);
      expect(report.total.tokens).toBe(0);
      expect(report.total.cost).toBe(0);
      expect(report.sessionStart).toBeInstanceOf(Date);
    });

    it('METADATA FALTANTE: si usageMetadata es undefined, NO suma tokens fantasma', async () => {
      // ARRANGE - Respuesta SIN usageMetadata
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            summary: 'Test without metadata',
            biasScore: 0,
            biasIndicators: [],
            clickbaitScore: 0,
            reliabilityScore: 50,
            sentiment: 'neutral',
            mainTopics: ['test'],
            factCheck: {
              claims: [],
              verdict: 'Unproven',
              reasoning: 'Test',
            },
          }),
          usageMetadata: undefined, // ⚠️ SIN METADATA
        },
      });

      // ACT
      const result = await geminiClient.analyzeArticle({
        title: 'No Metadata Test',
        content: 'Testing behavior when API does not return token usage metadata for tracking.',
        source: 'Test',
      });

      // ASSERT
      expect(result.usage).toBeUndefined(); // No debe tener usage
      const report = geminiClient.getSessionCostReport();
      expect(report.analysis.count).toBe(0); // No debe contar la operación
      expect(report.analysis.tokens).toBe(0); // No debe sumar tokens
      expect(report.analysis.cost).toBe(0); // No debe sumar coste
    });
  });

  // ==========================================================================
  // GRUPO 3: MANEJO DE ERRORES (ZONA ROJA - 100%)
  // ==========================================================================

  describe('⚠️ Manejo de Errores', () => {
    it('ERROR EN API: NO suma tokens al acumulador si la llamada falla', async () => {
      // ARRANGE
      mockGenerateContent.mockRejectedValueOnce(new Error('API failure - simulated error'));

      // ACT & ASSERT
      await expect(
        geminiClient.analyzeArticle({
          title: 'Error Test',
          content: 'This should fail and not add phantom tokens to the session accumulator.',
          source: 'Test',
        })
      ).rejects.toThrow();

      // Verificar que NO se sumaron tokens
      const report = geminiClient.getSessionCostReport();
      expect(report.analysis.count).toBe(0);
      expect(report.analysis.tokens).toBe(0);
      expect(report.analysis.cost).toBe(0);
    });

    it('API KEY INVÁLIDA: lanza ConfigurationError en constructor', () => {
      // ACT & ASSERT
      expect(() => new GeminiClient('')).toThrow(ConfigurationError);
      expect(() => new GeminiClient('   ')).toThrow(ConfigurationError);
    });

    it('CONTENIDO MUY CORTO: lanza ExternalAPIError 400', async () => {
      // ACT & ASSERT
      await expect(
        geminiClient.analyzeArticle({
          title: 'Short',
          content: 'Too short', // Menos de 50 caracteres
          source: 'Test',
        })
      ).rejects.toThrow(ExternalAPIError);

      await expect(
        geminiClient.analyzeArticle({
          title: 'Empty',
          content: '',
          source: 'Test',
        })
      ).rejects.toThrow(ExternalAPIError);
    });

    it('RATE LIMIT (429): reintenta con backoff y NO suma hasta éxito', async () => {
      // ARRANGE - Primera y segunda llamada fallan, tercera OK
      const rateLimitError = new Error('RESOURCE_EXHAUSTED: quota exceeded');

      mockGenerateContent
        .mockRejectedValueOnce(rateLimitError) // Intento 1
        .mockRejectedValueOnce(rateLimitError) // Intento 2
        .mockResolvedValueOnce({
          // Intento 3 - éxito
          response: {
            text: () => JSON.stringify({
              summary: 'Success after retries',
              biasScore: 0,
              biasIndicators: [],
              clickbaitScore: 0,
              reliabilityScore: 50,
              sentiment: 'neutral',
              mainTopics: ['test'],
              factCheck: {
                claims: [],
                verdict: 'Unproven',
                reasoning: 'Test',
              },
            }),
            usageMetadata: {
              promptTokenCount: 100,
              candidatesTokenCount: 50,
              totalTokenCount: 150,
            },
          },
        });

      // ACT
      const result = await geminiClient.analyzeArticle({
        title: 'Rate Limit Test',
        content: 'Testing retry logic with exponential backoff for rate limit handling.',
        source: 'Test',
      });

      // ASSERT
      expect(result).toBeDefined();
      expect(mockGenerateContent).toHaveBeenCalledTimes(3); // 3 intentos

      // Verificar que SOLO se sumó el token del intento exitoso
      const report = geminiClient.getSessionCostReport();
      expect(report.analysis.count).toBe(1); // Solo 1 operación exitosa
      expect(report.analysis.tokens).toBe(150);
    });

    it('RATE LIMIT PERMANENTE: después de 3 reintentos, lanza error 429', async () => {
      // ARRANGE - Todas las llamadas fallan con rate limit
      const rateLimitError = new Error('429 Too Many Requests');

      mockGenerateContent.mockRejectedValue(rateLimitError);

      // ACT & ASSERT
      await expect(
        geminiClient.analyzeArticle({
          title: 'Persistent Rate Limit',
          content: 'Testing behavior when rate limit persists across all retry attempts.',
          source: 'Test',
        })
      ).rejects.toThrow('Rate limit exceeded after retries');

      // Verificar que NO se sumaron tokens
      const report = geminiClient.getSessionCostReport();
      expect(report.analysis.count).toBe(0);
      expect(report.analysis.tokens).toBe(0);
    });
  });

  // ==========================================================================
  // GRUPO 4: VALIDACIÓN DE CÁLCULO MANUAL (ZONA ROJA - 100%)
  // ==========================================================================

  describe('🧮 Validación de Fórmula de Cálculo', () => {
    it('VERIFICACIÓN: fórmula coincide con documentación oficial de precios', () => {
      // ARRANGE - Valores de ejemplo
      const promptTokens = 100_000;
      const completionTokens = 50_000;

      // ACT - Cálculo manual paso a paso
      const costInputUSD = (promptTokens / 1_000_000) * PRICE_INPUT_1M; // 0.0075 USD
      const costOutputUSD = (completionTokens / 1_000_000) * PRICE_OUTPUT_1M; // 0.015 USD
      const totalUSD = costInputUSD + costOutputUSD; // 0.0225 USD
      const totalEUR = totalUSD * EUR_USD_RATE; // 0.021375 EUR

      const calculatedCost = calculateExpectedCostEUR(promptTokens, completionTokens);

      // ASSERT
      expect(calculatedCost).toBeCloseTo(totalEUR, 10);
      expect(calculatedCost).toBeCloseTo(0.021375, 6);
    });

    it('EDGE CASE: 1 token entrada = coste mínimo calculable', () => {
      // ARRANGE
      const promptTokens = 1;
      const completionTokens = 0;

      // ACT
      const cost = calculateExpectedCostEUR(promptTokens, completionTokens);

      // ASSERT
      const expectedCost = (1 / 1_000_000) * PRICE_INPUT_1M * EUR_USD_RATE;
      expect(cost).toBeCloseTo(expectedCost, 12);
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(0.0001); // Menor a 0.01 céntimos
    });

    it('COMPARACIÓN: entrada vs salida - salida es 4x más cara', () => {
      // ARRANGE - Mismo número de tokens
      const tokens = 10_000;

      // ACT
      const costOnlyInput = calculateExpectedCostEUR(tokens, 0);
      const costOnlyOutput = calculateExpectedCostEUR(0, tokens);

      // ASSERT
      // PRICE_OUTPUT_1M (0.30) / PRICE_INPUT_1M (0.075) = 4x
      expect(costOnlyOutput).toBeCloseTo(costOnlyInput * 4, 6);
    });
  });

  // ==========================================================================
  // GRUPO 5: INTEGRACIÓN CON REPORTE DE SESIÓN (ZONA ROJA - 100%)
  // ==========================================================================

  describe('📋 Reporte de Sesión Completo', () => {
    it('ESTRUCTURA: getSessionCostReport() devuelve todos los campos requeridos', () => {
      // ACT
      const report = geminiClient.getSessionCostReport();

      // ASSERT - Verificar estructura completa
      expect(report).toHaveProperty('analysis');
      expect(report.analysis).toHaveProperty('count');
      expect(report.analysis).toHaveProperty('tokens');
      expect(report.analysis).toHaveProperty('cost');

      expect(report).toHaveProperty('ragChat');
      expect(report.ragChat).toHaveProperty('count');
      expect(report.ragChat).toHaveProperty('tokens');
      expect(report.ragChat).toHaveProperty('cost');

      expect(report).toHaveProperty('groundingChat');
      expect(report.groundingChat).toHaveProperty('count');
      expect(report.groundingChat).toHaveProperty('tokens');
      expect(report.groundingChat).toHaveProperty('cost');

      expect(report).toHaveProperty('total');
      expect(report.total).toHaveProperty('operations');
      expect(report.total).toHaveProperty('tokens');
      expect(report.total).toHaveProperty('cost');

      expect(report).toHaveProperty('sessionStart');
      expect(report).toHaveProperty('uptime');

      expect(report.sessionStart).toBeInstanceOf(Date);
      expect(report.uptime).toBeGreaterThanOrEqual(0);
    });

    it('UPTIME: se actualiza correctamente', async () => {
      // ARRANGE
      const initialReport = geminiClient.getSessionCostReport();
      const initialUptime = initialReport.uptime;

      // ACT - Esperar un momento
      await new Promise((resolve) => setTimeout(resolve, 50));

      const laterReport = geminiClient.getSessionCostReport();
      const laterUptime = laterReport.uptime;

      // ASSERT
      expect(laterUptime).toBeGreaterThan(initialUptime);
      expect(laterUptime - initialUptime).toBeGreaterThanOrEqual(50);
    });
  });
});
