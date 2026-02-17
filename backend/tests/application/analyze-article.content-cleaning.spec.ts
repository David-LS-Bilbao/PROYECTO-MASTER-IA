import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyzeArticleUseCase } from '../../src/application/use-cases/analyze-article.usecase';

describe('AnalyzeArticleUseCase content cleaning', () => {
  const repository = { save: vi.fn() };
  const useCase = new AnalyzeArticleUseCase(repository as any, {} as any, {} as any, {} as any, {} as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('persistAccessStatusIfChanged no guarda si estado ya coincide', async () => {
    const article = {
      accessStatus: 'PUBLIC',
      analysisBlocked: false,
      accessReason: 'full_text_available',
      withAccessStatus: vi.fn(),
    } as any;

    const result = await (useCase as any).persistAccessStatusIfChanged(article, {
      accessStatus: 'PUBLIC',
      analysisBlocked: false,
      accessReason: 'full_text_available',
    });

    expect(result).toBe(article);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('persistAccessStatusIfChanged guarda cuando cambia estado o motivo', async () => {
    const updatedArticle = { id: 'updated' } as any;
    const article = {
      accessStatus: 'UNKNOWN',
      analysisBlocked: false,
      accessReason: null,
      withAccessStatus: vi.fn(() => updatedArticle),
    } as any;

    const result = await (useCase as any).persistAccessStatusIfChanged(article, {
      accessStatus: 'PAYWALLED',
      analysisBlocked: true,
      accessReason: 'keyword:suscribete'.repeat(30),
    });

    expect(article.withAccessStatus).toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(updatedArticle);
    expect(result).toBe(updatedArticle);
  });

  it('extractMetadataFlagsFromRawContent cubre null, no-json y json invalido', () => {
    expect((useCase as any).extractMetadataFlagsFromRawContent(null)).toBeUndefined();
    expect((useCase as any).extractMetadataFlagsFromRawContent('texto llano')).toBeUndefined();
    expect((useCase as any).extractMetadataFlagsFromRawContent('{bad json')).toBeUndefined();
  });

  it('extractMetadataFlagsFromRawContent extrae flags subscriber anidados', () => {
    const raw = JSON.stringify({
      data: [
        { flags: { isSubscriberContent: true } },
        { deep: { isSuscriberContent: 'yes' } },
      ],
    });

    const flags = (useCase as any).extractMetadataFlagsFromRawContent(raw) as Record<string, unknown>;
    expect(flags).toBeDefined();
    expect(Object.keys(flags).some((key) => /issubscribercontent|issuscribercontent/i.test(key))).toBe(true);
  });

  it('extractMetadataFlagsFromRawContent devuelve undefined cuando no hay flags', () => {
    const raw = JSON.stringify({ data: { title: 'sin flags', value: 1 } });
    expect((useCase as any).extractMetadataFlagsFromRawContent(raw)).toBeUndefined();
  });

  it('extractFirstTextFieldFromObject recorre preferred/container/fallback y respeta depth', () => {
    expect((useCase as any).extractFirstTextFieldFromObject('short text')).toBeUndefined();
    expect((useCase as any).extractFirstTextFieldFromObject('texto largo '.repeat(5))).toContain('texto largo');
    expect((useCase as any).extractFirstTextFieldFromObject({ content: 'contenido con longitud suficiente '.repeat(3) })).toContain('contenido');
    expect((useCase as any).extractFirstTextFieldFromObject({ data: { payload: { text: 'texto en contenedor '.repeat(3) } } })).toContain('texto en contenedor');
    expect((useCase as any).extractFirstTextFieldFromObject({ other: { any: 'fallback value con longitud suficiente '.repeat(3) } })).toContain('fallback value');
    expect((useCase as any).extractFirstTextFieldFromObject({ text: 'texto profundo '.repeat(3) }, 6)).toBeUndefined();
  });

  it('tryExtractTextFromJsonPayload y extractDomain manejan errores y casos validos', () => {
    expect((useCase as any).tryExtractTextFromJsonPayload('   ')).toBeUndefined();
    expect((useCase as any).tryExtractTextFromJsonPayload('{oops')).toBeUndefined();
    const parsed = (useCase as any).tryExtractTextFromJsonPayload(
      JSON.stringify({ payload: { text: 'texto extraido correctamente '.repeat(3) } })
    );
    expect(parsed).toContain('texto extraido');

    expect((useCase as any).extractDomain('https://www.Example.com/news')).toBe('example.com');
    expect((useCase as any).extractDomain('not-a-valid-url')).toBe('');
  });

  it('resolveInputQuality cubre todas las combinaciones relevantes', () => {
    expect((useCase as any).resolveInputQuality({ usedFallback: true, rssSnippetDetected: true, scrapedContentLength: 0 })).toBe('snippet_rss');
    expect((useCase as any).resolveInputQuality({ usedFallback: true, rssSnippetDetected: false, scrapedContentLength: 0 })).toBe('paywall_o_vacio');
    expect((useCase as any).resolveInputQuality({ usedFallback: false, rssSnippetDetected: true, scrapedContentLength: 1000 })).toBe('snippet_rss');
    expect((useCase as any).resolveInputQuality({ usedFallback: false, rssSnippetDetected: false, scrapedContentLength: 1200 })).toBe('full');
    expect((useCase as any).resolveInputQuality({ usedFallback: false, rssSnippetDetected: false, scrapedContentLength: 10 })).toBe('paywall_o_vacio');
    expect((useCase as any).resolveInputQuality({ usedFallback: false, rssSnippetDetected: false, scrapedContentLength: 0 })).toBe('unknown');
  });

  it('shouldRegenerateCachedSummary detecta legacy/short/invalid y acepta resumen valido', () => {
    expect((useCase as any).shouldRegenerateCachedSummary(null)).toBe(true);
    expect((useCase as any).shouldRegenerateCachedSummary('')).toBe(true);
    expect((useCase as any).shouldRegenerateCachedSummary('muy corto')).toBe(true);
    expect((useCase as any).shouldRegenerateCachedSummary('Resumen provisional basado en contenido interno: texto')).toBe(true);
    expect((useCase as any).shouldRegenerateCachedSummary('resumen no disponible: parser fail')).toBe(true);
    expect(
      (useCase as any).shouldRegenerateCachedSummary(
        'Resumen editorial amplio con datos clave, actores relevantes e impacto explicito para el lector final.'
      )
    ).toBe(false);
  });

  it('normalizeSummaryText aplica fallback segun calidad y limita frases/palabras', () => {
    const low = (useCase as any).normalizeSummaryText('Resumen provisional basado en contenido interno: ', {
      scrapedContentLength: 100,
      usedFallback: true,
      rssSnippetDetected: false,
    }) as string;
    expect(low).toContain('extracto disponible');

    const full = (useCase as any).normalizeSummaryText(
      'No es una novedad. En este contexto cabe destacar que hay mas de noventa palabras ' + 'palabra '.repeat(120),
      {
        scrapedContentLength: 1800,
        usedFallback: false,
        rssSnippetDetected: false,
      }
    ) as string;
    expect(full.toLowerCase()).not.toContain('no es una novedad');
    expect(full.split(/\s+/).length).toBeLessThanOrEqual(90);
  });

  it('buildQualityNotice y alignReliabilityScoreWithVerdict ajustan salida por calidad/veredicto', () => {
    expect((useCase as any).buildQualityNotice({ usedFallback: true, rssSnippetDetected: false, scrapedContentLength: 0 })).toBeDefined();
    expect((useCase as any).buildQualityNotice({ usedFallback: false, rssSnippetDetected: false, scrapedContentLength: 1200 })).toBeUndefined();

    expect(
      (useCase as any).alignReliabilityScoreWithVerdict({
        reliabilityScore: 99,
        verdict: 'SupportedByArticle',
        factualityStatus: 'plausible_but_unverified',
      })
    ).toBeLessThanOrEqual(65);

    expect(
      (useCase as any).alignReliabilityScoreWithVerdict({
        reliabilityScore: 99,
        verdict: 'InsufficientEvidenceInArticle',
        factualityStatus: 'no_determinable',
        qualityNotice: 'low quality',
      })
    ).toBeLessThanOrEqual(45);
  });

  it('ensureDeepSections rellena known/unknown/risks/quotes cuando faltan datos', () => {
    const analysis = {
      summary: 'Resumen base para secciones deep',
      factualityStatus: 'no_determinable',
      biasIndicators: [],
      factCheck: { claims: ['Claim A'], verdict: 'InsufficientEvidenceInArticle', reasoning: 'n/a' },
      deep: { sections: { known: [], unknown: [], quotes: [], risks: [] } },
    } as any;

    const result = (useCase as any).ensureDeepSections(analysis, {
      scrapedContentLength: 100,
      usedFallback: true,
      rssSnippetDetected: true,
      analyzedText: 'Texto "cita valida" con soporte parcial.',
    });

    expect(result.deep.sections.known.length).toBeGreaterThan(0);
    expect(result.deep.sections.unknown.length).toBeGreaterThan(0);
    expect(result.deep.sections.risks.length).toBeGreaterThan(0);
    expect(result.deep.sections.quotes.length).toBeGreaterThan(0);
  });

  it('normalizeDeepSectionArray y normalizeDeepQuotes filtran ruido y respetan limites', () => {
    expect((useCase as any).normalizeDeepSectionArray(undefined, 3)).toEqual([]);

    const cleaned = (useCase as any).normalizeDeepSectionArray(
      ['   ', 123 as any, 'texto uno '.repeat(20), 'texto dos', 'texto uno '.repeat(20)],
      2,
      5
    );
    expect(cleaned.length).toBeLessThanOrEqual(2);
    expect(cleaned[0].split(/\s+/).length).toBeLessThanOrEqual(5);

    const quotes = (useCase as any).normalizeDeepQuotes(
      ['"Quote uno valida"', '"Quote dos valida"'],
      'Texto sin extras',
      []
    );
    expect(quotes).toHaveLength(2);
  });

  it('isGarbageQuote, sanitizePotentialMojibake y clampNumber cubren ramas defensivas', () => {
    expect((useCase as any).isGarbageQuote('"isSuscriberContent"')).toBe(true);
    expect((useCase as any).isGarbageQuote('"1003744124282_0"')).toBe(true);
    expect((useCase as any).isGarbageQuote('"quote valida"')).toBe(false);

    expect((useCase as any).sanitizePotentialMojibake('texto normal')).toBe('texto normal');
    expect((useCase as any).sanitizePotentialMojibake('InformaciÃƒÂ³n con mojibake')).not.toContain('Ãƒ');

    expect((useCase as any).clampNumber(undefined, 1, 10, 3)).toBe(3);
    expect((useCase as any).clampNumber(0, 1, 10, 3)).toBe(1);
    expect((useCase as any).clampNumber(99, 1, 10, 3)).toBe(10);
    expect((useCase as any).clampNumber(5, 1, 10, 3)).toBe(5);
  });

  it('requiresAnalysisUpgrade/hasDeepSections/getAnalysisModeRank cubren comparativas de modo', () => {
    expect((useCase as any).requiresAnalysisUpgrade({ analysisModeUsed: 'low_cost' }, 'moderate')).toBe(true);
    expect((useCase as any).requiresAnalysisUpgrade({ analysisModeUsed: 'deep' }, 'moderate')).toBe(false);

    expect((useCase as any).hasDeepSections({ deep: undefined })).toBe(false);
    expect(
      (useCase as any).hasDeepSections({
        deep: { sections: { known: ['k'], unknown: ['u'], quotes: ['q'], risks: ['r'] } },
      })
    ).toBe(true);

    expect((useCase as any).getAnalysisModeRank('deep')).toBeGreaterThan((useCase as any).getAnalysisModeRank('moderate'));
    expect((useCase as any).getAnalysisModeRank('invalid_mode' as any)).toBe(1);
  });

  it('normalizeAnalysis cubre defaults sin contexto y activa escalado inferido', () => {
    const normalized = (useCase as any).normalizeAnalysis({
      summary: 'Resumen principal del articulo con afirmacion definitiva.',
      biasScore: 6,
      biasIndicators: 'invalid' as any,
      clickbaitScore: 12,
      reliabilityScore: 40,
      traceabilityScore: 20,
      factualityStatus: 'plausible_but_unverified',
      evidence_needed: 'sin-array' as any,
      should_escalate: undefined,
      sentiment: 'neutral',
      mainTopics: ['politica'],
      category: 'politica',
      factCheck: {
        claims: ['Esto demuestra 100% el resultado final'],
        verdict: 'NotSupportedByArticle',
        reasoning: '',
      },
      analysisModeUsed: 'deep',
    } as any);

    expect(normalized.analysisModeUsed).toBe('deep');
    expect(normalized.should_escalate).toBe(true);
    expect(normalized.evidence_needed).toEqual([]);
    expect(normalized.deep?.sections).toBeDefined();
  });

  it('normalizeFactCheck y helpers de resumen cubren ramas de fallback', () => {
    const fallbackFactCheck = (useCase as any).normalizeFactCheck({
      claims: [],
      verdict: undefined,
      reasoning: '',
      forceInsufficientEvidenceVerdict: false,
    });
    expect(fallbackFactCheck.verdict).toBe('InsufficientEvidenceInArticle');
    expect(fallbackFactCheck.reasoning.toLowerCase()).toContain('analisis estimado');

    const fullFallbackSummary = (useCase as any).normalizeSummaryText(undefined as any, {
      scrapedContentLength: 1200,
      usedFallback: false,
      rssSnippetDetected: false,
    });
    expect(fullFallbackSummary).toBe('No hay evidencia suficiente para un resumen editorial.');

    expect((useCase as any).extractSummaryFromJsonString(undefined as any)).toBeUndefined();
    expect((useCase as any).extractSummaryFromJsonString('{')).toBeUndefined();
    expect((useCase as any).extractSummaryFromJsonString('{"summary":123}')).toBeUndefined();
    expect((useCase as any).extractSummaryFromJsonString('{"summary":"   "}')).toBeUndefined();
    expect((useCase as any).removeLegacySummaryPrefix('')).toBe('');
    expect((useCase as any).isFormatFallbackSummary('')).toBe(false);
  });

  it('title/bias helpers cubren equivalencias y ramas de leaning', () => {
    expect((useCase as any).withTitleBiasIndicator([], undefined)).toEqual([]);
    expect(
      (useCase as any).withTitleBiasIndicator(
        ['Titular: "Plan economico completo"'],
        'Plan economico completo'
      )
    ).toHaveLength(1);

    expect((useCase as any).createTitleBiasIndicator(123 as any)).toBeUndefined();
    expect((useCase as any).createTitleBiasIndicator('   <p> </p>   ')).toBeUndefined();
    expect((useCase as any).createTitleBiasIndicator('T'.repeat(130))).toContain('...');

    expect((useCase as any).normalizeArticleLeaning('otra')).toBe('indeterminada');
    expect((useCase as any).toLegacyBiasLeaning('extremista')).toBe('otra');
    expect((useCase as any).enforceExtremistRule('extremista', ['indicador neutral'])).toBe(
      'indeterminada'
    );

    const biasComment = (useCase as any).buildBiasComment({
      shouldForceIndeterminateBias: false,
      hasCalibratedBiasSignals: true,
      biasIndicators: ['"Cita A"', '"Cita B"', '"Cita C"'],
      articleLeaning: 'indeterminada',
    });
    expect(biasComment.toLowerCase()).toContain('sin tendencia ideologica concluyente');
  });

  it('buildReliabilityComment cubre plantillas supported/medium/long y bandas', () => {
    const supported = (useCase as any).buildReliabilityComment({
      reliabilityScore: 92,
      traceabilityScore: 70,
      factualityStatus: 'plausible_but_unverified',
      evidenceNeeded: ['citas'],
      scrapedContentLength: 1200,
      usedFallback: false,
      factCheckVerdict: 'SupportedByArticle',
      hasAttributionOrCitations: false,
    });
    expect(supported.toLowerCase()).toContain('soportado por el articulo');

    const medium = (useCase as any).buildReliabilityComment({
      reliabilityScore: 75,
      traceabilityScore: 50,
      factualityStatus: 'plausible_but_unverified',
      evidenceNeeded: ['contexto'],
      scrapedContentLength: 700,
      usedFallback: false,
      factCheckVerdict: 'NotSupportedByArticle',
      hasAttributionOrCitations: true,
    });
    expect(medium.toLowerCase()).toContain('fiabilidad media');

    const long = (useCase as any).buildReliabilityComment({
      reliabilityScore: 20,
      traceabilityScore: 35,
      factualityStatus: 'plausible_but_unverified',
      evidenceNeeded: ['contexto', 'documento'],
      scrapedContentLength: 1400,
      usedFallback: false,
      factCheckVerdict: 'NotSupportedByArticle',
      hasAttributionOrCitations: true,
    });
    expect(long.toLowerCase()).toContain('muy baja');
  });

  it('helpers de listas/cadenas cubren ramas defensivas', () => {
    expect((useCase as any).summarizeIndicator('')).toBe('"sin cita legible"');
    expect((useCase as any).joinAsNaturalList([])).toBe('');
    expect((useCase as any).joinAsNaturalList(['citas'])).toBe('citas');
    expect((useCase as any).joinAsNaturalList(['citas', 'contexto'])).toBe('citas y contexto');

    expect((useCase as any).mergeMetadataFlags(undefined, undefined)).toBeUndefined();
    expect((useCase as any).normalizeCategoryForEscalation(undefined)).toBe('');
    expect(
      (useCase as any).applyCategoryEscalationPolicy({
        currentValue: false,
        category: 'politica',
        clickbaitScore: 10,
        claims: ['100% definitivo sin duda'],
        summary: 'Resumen',
        reliabilityScore: 40,
        traceabilityScore: 30,
      })
    ).toBe(true);
  });

  it('cubre limpieza y extraccion en ramas edge de contenido', () => {
    const prepared = (useCase as any).prepareContentForAnalysis(
      '<a href="https://example.com"></a><p>Texto limpio</p>'
    ) as string;
    expect(prepared).toContain('https://example.com');

    expect((useCase as any).extractFirstTextFieldFromObject([1, { text: 'texto largo '.repeat(5) }])).toContain(
      'texto largo'
    );
    expect((useCase as any).extractFirstTextFieldFromObject(123 as any)).toBeUndefined();

    expect((useCase as any).removeKnownMetadataNoise('')).toBe('');
    const filtered = (useCase as any).removeKnownMetadataNoise(
      'flags: true\n{"ids": 10}\nLinea valida final'
    );
    expect(filtered).toContain('Linea valida final');
    expect(filtered.toLowerCase()).not.toContain('flags');

    expect((useCase as any).decodeUnicodeEscapes('\\uZZZZ texto')).toContain('\\uZZZZ');
    expect((useCase as any).decodeHtmlEntities('&amp; &#35; &#x20;')).toContain('& #');
  });

  it('ensureDeepSections y citas cubren branches de relleno y filtros de basura', () => {
    const enriched = (useCase as any).ensureDeepSections(
      {
        summary: 'Resumen utilizable',
        factualityStatus: 'plausible_but_unverified',
        biasIndicators: ['uno', 'dos'],
        factCheck: undefined,
        deep: { sections: { known: [], unknown: [], quotes: ['"isSuscriberContent"'], risks: [] } },
      },
      {
        scrapedContentLength: 1400,
        usedFallback: false,
        rssSnippetDetected: false,
        analyzedText:
          '"Cita 1 valida en articulo" "Cita 2 valida en articulo" "Cita 3 valida en articulo" "Cita 4 valida en articulo" "Cita 5 extra"',
      }
    );

    expect(enriched.deep.sections.known.length).toBeGreaterThan(0);
    expect(enriched.deep.sections.risks.length).toBeGreaterThan(0);
    expect(enriched.deep.sections.quotes.length).toBeLessThanOrEqual(4);

    expect((useCase as any).isGarbageQuote('')).toBe(true);
    expect((useCase as any).isGarbageQuote('"abc_12"')).toBe(true);
    expect((useCase as any).isGarbageQuote('"flags": true')).toBe(true);
    expect((useCase as any).isGarbageQuote('{"content":{"data":{"x":1}}}')).toBe(true);
  });

  it('executeBatch maneja errores no-Error y rate-limit en catch', async () => {
    const batchRepository = {
      findUnanalyzed: vi.fn(async () => [{ id: 'a1' }, { id: 'a2' }]),
    };
    const batchUseCase = new AnalyzeArticleUseCase(
      batchRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    const executeSpy = vi
      .spyOn(batchUseCase as any, 'execute')
      .mockRejectedValueOnce('boom-string')
      .mockRejectedValueOnce(new Error('429 Rate limit reached'));

    const result = await batchUseCase.executeBatch({ limit: 2 });

    expect(executeSpy).toHaveBeenCalledTimes(2);
    expect(result.failed).toBe(2);
    expect(result.results[0].error).toBe('Unknown error');
    expect(result.results[1].error).toContain('429');
  });
});
