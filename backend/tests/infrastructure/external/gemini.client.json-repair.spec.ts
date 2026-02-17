import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiClient } from '../../../src/infrastructure/external/gemini.client';
import { TokenTaximeter } from '../../../src/infrastructure/monitoring/token-taximeter';

const mockGenerateContent = vi.fn();

vi.mock('@google/generative-ai', () => {
  class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return {
        generateContent: mockGenerateContent,
        embedContent: vi.fn(),
      };
    }
  }

  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

describe('GeminiClient JSON repair', () => {
  let client: GeminiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GeminiClient('test-key', new TokenTaximeter());
  });

  it('parse fails -> repair succeeds -> evita fallback de formato', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({
        response: {
          text: () => '```json\n{"summary":"cortado"\n```',
          usageMetadata: null,
        },
      })
      .mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify({
              summary: 'Resumen reparado correctamente',
              biasIndicators: [
                'Frase citada: "siempre"',
                'Frase citada: "nunca"',
                'Frase citada: "definitivo"',
              ],
              factCheck: {
                claims: ['Claim reparado'],
                verdict: 'SupportedByArticle',
                reasoning: 'Texto reparado con estructura valida',
              },
            }),
          usageMetadata: null,
        },
      });

    const result = await client.analyzeArticle({
      title: 'Titulo test',
      content: 'Contenido suficientemente largo para analisis. '.repeat(10),
      source: 'Fuente test',
      language: 'es',
      analysisMode: 'moderate',
    });

    expect(result.summary).toBe('Resumen reparado correctamente');
    expect(result.formatError).not.toBe(true);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('parse fails -> repair fails -> mantiene fallback de formato', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({
        response: {
          text: () => 'respuesta sin bloque JSON',
          usageMetadata: null,
        },
      })
      .mockResolvedValueOnce({
        response: {
          text: () => 'repair tambien invalido',
          usageMetadata: null,
        },
      });

    const result = await client.analyzeArticle({
      title: 'Titulo test',
      content: 'Contenido suficientemente largo para analisis. '.repeat(10),
      source: 'Fuente test',
      language: 'es',
      analysisMode: 'moderate',
    });

    expect(result.summary).toBe('No se pudo procesar el formato del analisis. Reintenta.');
    expect(result.formatError).toBe(true);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });
});
