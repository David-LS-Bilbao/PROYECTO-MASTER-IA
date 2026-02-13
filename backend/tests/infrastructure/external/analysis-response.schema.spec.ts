import { describe, expect, it } from 'vitest';
import { analysisResponseSchema } from '../../../src/infrastructure/external/schemas/analysis-response.schema';

describe('analysisResponseSchema (Zod)', () => {
  it('valida el payload vNext con nuevo enum de factCheck.verdict', () => {
    const parsed = analysisResponseSchema.parse({
      summary: 'Resumen del articulo con contexto.',
      biasRaw: -3,
      biasComment:
        'El texto usa senales citadas y comparables en el encuadre, sin evidencia suficiente para afirmar una agenda ideologica externa y limitando el analisis al propio contenido.',
      biasLeaning: 'indeterminada',
      reliabilityScore: 58,
      traceabilityScore: 54,
      factualityStatus: 'no_determinable',
      evidence_needed: ['Fuente primaria', 'Documento oficial'],
      reliabilityComment:
        'La fiabilidad interna es media por trazabilidad parcial de citas y atribuciones; no verificable con fuentes internas, y faltan Fuente primaria y Documento oficial para cerrar contexto.',
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
    expect(parsed.biasComment).toContain('senales');
    expect(parsed.biasLeaning).toBe('indeterminada');
    expect(parsed.reliabilityScore).toBe(58);
    expect(parsed.traceabilityScore).toBe(54);
    expect(parsed.factualityStatus).toBe('no_determinable');
    expect(parsed.evidence_needed).toHaveLength(2);
    expect(parsed.reliabilityComment).toContain('no verificable con fuentes internas');
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

  it('falla si biasComment supera 220 chars', () => {
    expect(() =>
      analysisResponseSchema.parse({
        summary: 'Resumen',
        biasComment: 'a'.repeat(221),
      })
    ).toThrow();
  });

  it('falla si reliabilityComment supera 220 chars', () => {
    expect(() =>
      analysisResponseSchema.parse({
        summary: 'Resumen',
        reliabilityComment: 'b'.repeat(221),
      })
    ).toThrow();
  });
});
