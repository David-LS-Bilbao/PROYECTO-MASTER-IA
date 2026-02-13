import { describe, expect, it } from 'vitest';
import { ANALYSIS_PROMPT } from '../../../../src/infrastructure/external/prompts/analysis.prompt';

describe('ANALYSIS_PROMPT vNext', () => {
  it('separa análisis textual y verificación factual, y exige JSON estricto', () => {
    expect(ANALYSIS_PROMPT).toContain('ANALISIS TEXTUAL');
    expect(ANALYSIS_PROMPT).toContain('VERIFICACION FACTUAL');
    expect(ANALYSIS_PROMPT).toContain('Responde SOLO con JSON valido');
  });

  it('delimita el artículo dentro de <ARTICLE>...</ARTICLE>', () => {
    expect(ANALYSIS_PROMPT).toContain('<ARTICLE>');
    expect(ANALYSIS_PROMPT).toContain('</ARTICLE>');
  });

  it('incluye dos few-shot de calibración', () => {
    expect(ANALYSIS_PROMPT).toContain('FEW-SHOT 1');
    expect(ANALYSIS_PROMPT).toContain('FEW-SHOT 2');
  });
});
