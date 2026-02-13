import { describe, expect, it } from 'vitest';
import { analysisResponseSchema } from '../../../src/infrastructure/external/schemas/analysis-response.schema';

describe('analysisResponseSchema (Zod)', () => {
  it('valida el nuevo payload de scoring vNext', () => {
    const parsed = analysisResponseSchema.parse({
      summary: 'Resumen del artículo con contexto.',
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
      mainTopics: ['política'],
    });

    expect(parsed.summary).toContain('Resumen');
    expect(parsed.biasRaw).toBe(-3);
    expect(parsed.reliabilityScore).toBe(58);
    expect(parsed.traceabilityScore).toBe(54);
    expect(parsed.factualityStatus).toBe('no_determinable');
    expect(parsed.evidence_needed).toHaveLength(2);
    expect(parsed.should_escalate).toBe(false);
  });

  it('falla si summary no es string', () => {
    expect(() =>
      analysisResponseSchema.parse({
        summary: 123,
      })
    ).toThrow();
  });
});
