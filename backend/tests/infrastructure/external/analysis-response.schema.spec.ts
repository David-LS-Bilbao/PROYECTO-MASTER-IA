import { describe, expect, it } from 'vitest';
import { analysisResponseSchema } from '../../../src/infrastructure/external/schemas/analysis-response.schema';

describe('analysisResponseSchema (Zod)', () => {
  it('valida el payload vNext con nuevo enum de factCheck.verdict', () => {
    const parsed = analysisResponseSchema.parse({
      summary: 'Resumen del articulo con contexto.',
      biasRaw: -3,
      reliabilityScore: 58,
      traceabilityScore: 54,
      factualityStatus: 'no_determinable',
      evidence_needed: ['Fuente primaria', 'Documento oficial'],
      should_escalate: false,
      analysis: {
        biasType: 'lenguaje',
        explanation: 'Uso moderado de adjetivos valorativos.',
      },
      factCheck: {
        verdict: 'SupportedByArticle',
      },
      mainTopics: ['politica'],
    });

    expect(parsed.summary).toContain('Resumen');
    expect(parsed.biasRaw).toBe(-3);
    expect(parsed.reliabilityScore).toBe(58);
    expect(parsed.traceabilityScore).toBe(54);
    expect(parsed.factualityStatus).toBe('no_determinable');
    expect(parsed.evidence_needed).toHaveLength(2);
    expect(parsed.should_escalate).toBe(false);
    expect(parsed.factCheck?.verdict).toBe('SupportedByArticle');
  });

  it('normaliza verdict legacy al enum vNext', () => {
    const parsed = analysisResponseSchema.parse({
      summary: 'Resumen',
      factCheck: {
        verdict: 'Verified',
      },
    });

    expect(parsed.factCheck?.verdict).toBe('SupportedByArticle');
  });

  it('falla con verdict fuera del enum permitido', () => {
    expect(() =>
      analysisResponseSchema.parse({
        summary: 'Resumen',
        factCheck: {
          verdict: 'WRONG',
        },
      })
    ).toThrow();
  });

  it('falla si summary no es string', () => {
    expect(() =>
      analysisResponseSchema.parse({
        summary: 123,
      })
    ).toThrow();
  });
});
