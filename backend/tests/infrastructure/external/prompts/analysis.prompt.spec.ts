import { describe, expect, it } from 'vitest';
import { ANALYSIS_PROMPT } from '../../../../src/infrastructure/external/prompts/analysis.prompt';

describe('ANALYSIS_PROMPT vNext.1', () => {
  it('separa analisis textual y verificacion factual, y exige JSON estricto', () => {
    expect(ANALYSIS_PROMPT).toContain('ANALISIS TEXTUAL');
    expect(ANALYSIS_PROMPT).toContain('VERIFICACION FACTUAL');
    expect(ANALYSIS_PROMPT).toContain('Responde SOLO con JSON valido');
  });

  it('delimita el articulo dentro de <ARTICLE>...</ARTICLE>', () => {
    expect(ANALYSIS_PROMPT).toContain('<ARTICLE>');
    expect(ANALYSIS_PROMPT).toContain('</ARTICLE>');
  });

  it('incluye dos few-shot de calibracion', () => {
    expect(ANALYSIS_PROMPT).toContain('FEW-SHOT 1');
    expect(ANALYSIS_PROMPT).toContain('FEW-SHOT 2');
  });

  it('exige 3 biasIndicators con cita y fallback neutral', () => {
    expect(ANALYSIS_PROMPT).toContain('EXACTAMENTE 3 indicadores');
    expect(ANALYSIS_PROMPT).toContain('fuerza sesgo neutral');
  });

  it('usa enum de verdict basado en evidencia interna del articulo', () => {
    expect(ANALYSIS_PROMPT).toContain('SupportedByArticle');
    expect(ANALYSIS_PROMPT).toContain('NotSupportedByArticle');
    expect(ANALYSIS_PROMPT).toContain('InsufficientEvidenceInArticle');
    expect(ANALYSIS_PROMPT).toContain('NO uses "Verified" ni "False"');
  });

  it('incluye campos vNext de explicabilidad con limites de longitud', () => {
    expect(ANALYSIS_PROMPT).toContain('biasComment');
    expect(ANALYSIS_PROMPT).toContain('articleLeaning');
    expect(ANALYSIS_PROMPT).toContain('reliabilityComment');
    expect(ANALYSIS_PROMPT).toContain('max 220');
  });

  it('exige frase literal para no_determinable en reliabilityComment', () => {
    expect(ANALYSIS_PROMPT).toContain('no verificable con fuentes internas');
  });
});
