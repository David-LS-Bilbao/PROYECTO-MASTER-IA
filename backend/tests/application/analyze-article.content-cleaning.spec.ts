import { describe, expect, it } from 'vitest';
import { AnalyzeArticleUseCase } from '../../src/application/use-cases/analyze-article.usecase';

describe('AnalyzeArticleUseCase content cleaning', () => {
  const useCase = new AnalyzeArticleUseCase(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );

  it('extracts nested data.content when payload is JSON and removes known metadata keys', () => {
    const dirtyPayload = JSON.stringify({
      data: {
        content:
          '<article><p>Texto principal con contexto verificable.</p><p>Detalle adicional.</p></article>',
        isSuscriberContent: true,
        ids: ['item_0'],
      },
      flags: { paywall: true },
    });

    const cleaned = (useCase as any).prepareContentForAnalysis(dirtyPayload) as string;

    expect(cleaned).toContain('Texto principal con contexto verificable.');
    expect(cleaned).not.toMatch(/isSuscriberContent/i);
    expect(cleaned).not.toMatch(/\bitem_0\b/i);
  });

  it('decodes unicode escapes and strips html markup from extracted text', () => {
    const dirtyPayload =
      '{"data":{"content":"<html><body><p>Analisis de la noticia sobre OTAN y Trump: texto \\\\u00f1 con etiquetas.</p></body></html>"}}';

    const cleaned = (useCase as any).prepareContentForAnalysis(dirtyPayload) as string;

    expect(cleaned).toContain('texto ñ con etiquetas.');
    expect(cleaned).not.toMatch(/<html|<body|<p>/i);
  });

  it('recovers summary text when cached summary is a raw JSON string', () => {
    const rawJsonSummary =
      '{"summary":"Resumen limpio para UI","biasRaw":0,"should_escalate":false}';

    const normalized = (useCase as any).normalizeSummaryText(rawJsonSummary, {
      scrapedContentLength: 1200,
      usedFallback: false,
      rssSnippetDetected: false,
    }) as string;

    expect(normalized).toBe('Resumen limpio para UI');
    expect(normalized).not.toContain('{');
  });

  it('filters garbage quote tokens from deep sections', () => {
    const cleanedQuotes = (useCase as any).normalizeDeepQuotes(
      ['"isSuscriberContent"', '"1003744124282_0"', '"Cita textual valida"'],
      'El texto base incluye una cita: "Cita textual valida".',
      ['Claim limpio sin metadatos']
    ) as string[];

    expect(cleanedQuotes.some((quote) => /isSuscriberContent/i.test(quote))).toBe(false);
    expect(cleanedQuotes.some((quote) => /1003744124282_0/.test(quote))).toBe(false);
    expect(cleanedQuotes.some((quote) => /Cita textual valida/.test(quote))).toBe(true);
  });

  it('cuando hay formatError no genera secciones deep synthetic', () => {
    const normalized = (useCase as any).normalizeAnalysis(
      {
        formatError: true,
        summary: 'No se pudo procesar el formato del analisis. Reintenta.',
        biasScore: 0,
        biasRaw: 0,
        biasScoreNormalized: 0,
        biasIndicators: [],
        clickbaitScore: 0,
        reliabilityScore: 50,
        traceabilityScore: 50,
        factualityStatus: 'no_determinable',
        evidence_needed: [],
        should_escalate: false,
        sentiment: 'neutral',
        mainTopics: [],
        factCheck: {
          claims: [],
          verdict: 'InsufficientEvidenceInArticle',
          reasoning: 'Sin informacion suficiente para verificar.',
        },
        analysisModeUsed: 'deep',
      },
      {
        scrapedContentLength: 1400,
        usedFallback: false,
        analyzedText: 'Texto completo',
        analysisModeUsed: 'deep',
        articleCategory: 'politica',
        articleTitle: 'Titulo',
        rssSnippetDetected: false,
      }
    );

    expect(normalized.formatError).toBe(true);
    expect(normalized.deep).toBeUndefined();
  });
});
