/**
 * GeminiClient parseAnalysisResponse Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiClient } from '../../../src/infrastructure/external/gemini.client';
import { TokenTaximeter } from '../../../src/infrastructure/monitoring/token-taximeter';
import { ExternalAPIError } from '../../../src/domain/errors/infrastructure.error';

vi.mock('@google/generative-ai', () => {
  class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return {
        generateContent: vi.fn(),
        embedContent: vi.fn(),
      };
    }
  }
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

describe('GeminiClient parseAnalysisResponse', () => {
  let client: GeminiClient;

  beforeEach(() => {
    client = new GeminiClient('test-key', new TokenTaximeter());
  });

  it('normaliza campos y adjunta usage', () => {
    const parse = (client as any).parseAnalysisResponse.bind(client);
    const text = JSON.stringify({
      summary: 'Resumen',
      internal_reasoning: 'Reasoning',
      category: 'economia',
      biasScore: 12,
      analysis: { biasType: 'political', explanation: 'exp' },
      biasIndicators: ['neutral'],
      reliabilityScore: 110,
      clickbaitScore: -5,
      sentiment: 'Positive',
      suggestedTopics: ['t1', 't2'],
      factCheck: {
        claims: ['c1'],
        verdict: 'Verified',
        reasoning: 'ok',
      },
    });

    const result = parse(`\n\`\`\`json\n${text}\n\`\`\`\n`, {
      promptTokens: 1,
      completionTokens: 2,
      totalTokens: 3,
      costEstimated: 0.01,
    });

    expect(result.summary).toBe('Resumen');
    expect(result.biasRaw).toBe(10);
    expect(result.biasScore).toBe(1);
    expect(result.reliabilityScore).toBe(100);
    expect(result.clickbaitScore).toBe(0);
    expect(result.sentiment).toBe('positive');
    expect(result.mainTopics).toEqual(['t1', 't2']);
    expect(result.factCheck.verdict).toBe('Verified');
    expect(result.usage?.totalTokens).toBe(3);
  });

  it('usa defaults cuando faltan campos y verdict invalido', () => {
    const parse = (client as any).parseAnalysisResponse.bind(client);
    const text = JSON.stringify({
      summary: 'Resumen',
      mainTopics: ['m1'],
      sentiment: 'invalid',
      factCheck: { verdict: 'WRONG' },
    });

    const result = parse(text);

    expect(result.biasIndicators).toEqual([]);
    expect(result.reliabilityScore).toBe(50);
    expect(result.clickbaitScore).toBe(0);
    expect(result.sentiment).toBe('neutral');
    expect(result.mainTopics).toEqual(['m1']);
    expect(result.factCheck.verdict).toBe('Unproven');
    expect(result.factCheck.reasoning).toContain('Sin');
  });

  it('lanza error si summary es invalido', () => {
    const parse = (client as any).parseAnalysisResponse.bind(client);
    const text = JSON.stringify({ summary: 123 });

    expect(() => parse(text)).toThrow(ExternalAPIError);
  });
});
