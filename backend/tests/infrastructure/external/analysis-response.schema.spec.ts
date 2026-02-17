import { describe, expect, it } from 'vitest';
import { analysisResponseSchema } from '../../../src/infrastructure/external/schemas/analysis-response.schema';

describe('analysisResponseSchema (Zod)', () => {
  it('requiere summary como string en payload valido', () => {
    const parsed = analysisResponseSchema.parse({
      summary: 'Resumen editorial claro y directo.',
    });

    expect(typeof parsed.summary).toBe('string');
    expect(parsed.summary.length).toBeGreaterThan(0);
  });

  it('valida el payload vNext con nuevo enum de factCheck.verdict', () => {
    const parsed = analysisResponseSchema.parse({
      summary: 'Resumen del articulo con contexto.',
      biasRaw: -3,
      biasComment:
        'El texto usa indicios textuales citados y comparables en el encuadre, sin evidencia suficiente para afirmar una agenda ideologica externa y limitando el analisis al propio contenido.',
      articleLeaning: 'indeterminada',
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
    expect(parsed.biasComment).toContain('indicios textuales');
    expect(parsed.articleLeaning).toBe('indeterminada');
    expect(parsed.reliabilityScore).toBe(58);
    expect(parsed.traceabilityScore).toBe(54);
    expect(parsed.factualityStatus).toBe('no_determinable');
    expect(parsed.evidence_needed).toHaveLength(2);
    expect(parsed.reliabilityComment).toContain('no verificable con fuentes internas');
    expect(parsed.should_escalate).toBe(false);
    expect(parsed.factCheck?.verdict).toBe('SupportedByArticle');
  });

  it('limita arrays segun contrato de coste', () => {
    const parsed = analysisResponseSchema.parse({
      summary: 'Resumen',
      biasIndicators: ['1', '2', '3', '4', '5', '6', '7', '8'],
      evidence_needed: ['a', 'b', 'c', 'd'],
      factCheck: {
        claims: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'],
        verdict: 'InsufficientEvidenceInArticle',
      },
    });

    expect(parsed.biasIndicators).toHaveLength(8);
    expect(parsed.evidence_needed).toHaveLength(4);
    expect(parsed.factCheck?.claims).toHaveLength(10);
  });

  it('acepta bloque deep.sections opcional', () => {
    const parsed = analysisResponseSchema.parse({
      summary: 'Resumen',
      deep: {
        sections: {
          known: ['K1'],
          unknown: ['U1'],
          quotes: ['"Q1"'],
          risks: ['R1'],
        },
      },
    });

    expect(parsed.deep?.sections?.known).toEqual(['K1']);
    expect(parsed.deep?.sections?.unknown).toEqual(['U1']);
    expect(parsed.deep?.sections?.quotes).toEqual(['"Q1"']);
    expect(parsed.deep?.sections?.risks).toEqual(['R1']);
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
