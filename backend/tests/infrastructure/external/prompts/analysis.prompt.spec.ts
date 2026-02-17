import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_PROMPT,
  ANALYSIS_PROMPT_DEEP,
  ANALYSIS_PROMPT_LOW_COST,
  ANALYSIS_PROMPT_MODERATE,
} from '../../../../src/infrastructure/external/prompts/analysis.prompt';

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

  it('permite 1-2 biasIndicators citados, pero solo escala sesgo fuerte con 3+', () => {
    expect(ANALYSIS_PROMPT).toContain('entre 1 y 5 indicadores');
    expect(ANALYSIS_PROMPT).toContain('1-2 indicadores citados');
    expect(ANALYSIS_PROMPT).toContain('Solo escala sesgo fuerte cuando haya 3 o mas indicadores citados');
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
    expect(ANALYSIS_PROMPT).toContain('leaningConfidence');
    expect(ANALYSIS_PROMPT).toContain('reliabilityComment');
    expect(ANALYSIS_PROMPT).toContain('max 220');
  });

  it('incluye coherencia de fiabilidad para SupportedByArticle', () => {
    expect(ANALYSIS_PROMPT).toMatch(/Soportado por el art/i);
  });

  it('exige frase literal para no_determinable en reliabilityComment', () => {
    expect(ANALYSIS_PROMPT).toContain('no verificable con fuentes internas');
  });

  it('define reglas editoriales de summary en todas las variantes', () => {
    const variants = [ANALYSIS_PROMPT, ANALYSIS_PROMPT_MODERATE, ANALYSIS_PROMPT_LOW_COST];

    for (const prompt of variants) {
      expect(prompt).toContain('summary');
      expect(prompt).toContain('inputQuality');
      expect(prompt).toContain('35-45 palabras');
      expect(prompt).toContain('clickbait');
      expect(prompt).toContain('3-5 frases');
      expect(prompt).toMatch(/fragmento|extracto/i);
    }
  });

  it('incluye secciones enriquecidas para modo deep', () => {
    expect(ANALYSIS_PROMPT_DEEP).toContain('"deep"');
    expect(ANALYSIS_PROMPT_DEEP).toContain('"sections"');
    expect(ANALYSIS_PROMPT_DEEP).toContain('known');
    expect(ANALYSIS_PROMPT_DEEP).toContain('unknown');
    expect(ANALYSIS_PROMPT_DEEP).toContain('quotes');
    expect(ANALYSIS_PROMPT_DEEP).toContain('risks');
    expect(ANALYSIS_PROMPT_DEEP).toMatch(/6.*10 claims/i);
  });

  it('en modo standard/moderate exige resumen de 3-5 frases y maximo 90 palabras', () => {
    expect(ANALYSIS_PROMPT).toContain('3-5 frases');
    expect(ANALYSIS_PROMPT).toContain('60-90 palabras');
    expect(ANALYSIS_PROMPT_MODERATE).toContain('3-5 frases');
    expect(ANALYSIS_PROMPT_MODERATE).toContain('60-90 palabras');
  });

  it('prohibe frases vacias y prefijos legacy de resumen', () => {
    expect(ANALYSIS_PROMPT).toContain('"no es una novedad"');
    expect(ANALYSIS_PROMPT).toContain('"cabe destacar"');
    expect(ANALYSIS_PROMPT).toContain('"en este contexto"');
    expect(ANALYSIS_PROMPT).toContain('"segun se desprende"');
    expect(ANALYSIS_PROMPT).toContain('Prohibido usar el prefijo "Resumen provisional..."');
    expect(ANALYSIS_PROMPT).toContain('"No se puede confirmar detalles"');
  });
});

