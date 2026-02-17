import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyzeArticleUseCase } from '../../src/application/use-cases/analyze-article.usecase';
import { NewsArticle, type ArticleAnalysis } from '../../src/domain/entities/news-article.entity';

function createArticle(overrides: Partial<Record<string, unknown>> = {}): NewsArticle {
  return NewsArticle.reconstitute({
    id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    title: 'Articulo de prueba',
    description: 'Descripcion de prueba',
    url: 'https://example.com/article',
    urlToImage: 'https://example.com/image.jpg',
    publishedAt: new Date('2026-02-01T10:00:00Z'),
    source: 'Fuente test',
    author: 'Autor test',
    content: 'Contenido largo para analisis. '.repeat(80),
    category: 'politica',
    language: 'es',
    embedding: null,
    isFavorite: false,
    summary: null,
    biasScore: null,
    analysis: null,
    analyzedAt: null,
    fetchedAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    ...overrides,
    topicId: null,
    internalReasoning: null
  });
}

function createAnalysis(overrides: Partial<ArticleAnalysis> = {}): ArticleAnalysis {
  return {
    summary:
      'Resumen suficientemente largo para considerarse cache valido y evitar regeneraciones innecesarias.',
    qualityNotice: undefined,
    analysisModeUsed: 'standard',
    biasScore: 0.3,
    biasRaw: 3,
    biasScoreNormalized: 0.3,
    biasIndicators: [
      'Loaded wording: "total fracaso"',
      'Generalization: "todo el mundo"',
      'Selective framing: "solo una parte"',
    ],
    biasComment: 'Comentario de sesgo',
    articleLeaning: 'neutral',
    leaningConfidence: 'media',
    clickbaitScore: 15,
    reliabilityScore: 70,
    traceabilityScore: 65,
    factualityStatus: 'plausible_but_unverified',
    evidence_needed: [],
    reliabilityComment: 'Comentario fiabilidad',
    should_escalate: false,
    sentiment: 'neutral',
    mainTopics: ['politica'],
    factCheck: {
      claims: ['Claim 1'],
      verdict: 'SupportedByArticle',
      reasoning: 'Se apoya en el contenido',
    },
    ...overrides,
  };
}

describe('AnalyzeArticleUseCase - mode-aware cache', () => {
  const mockArticleRepository = {
    findById: vi.fn(),
    save: vi.fn(),
    addFavoriteForUser: vi.fn(),
  };

  const mockGeminiClient = {
    analyzeArticle: vi.fn(),
    generateEmbedding: vi.fn(),
  };

  const mockJinaReaderClient = {
    scrapeUrl: vi.fn(),
  };

  const mockMetadataExtractor = {
    extractMetadata: vi.fn(),
    getBestImageUrl: vi.fn(),
  };

  const mockVectorClient = {
    upsertItem: vi.fn(),
  };

  let useCase: AnalyzeArticleUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new AnalyzeArticleUseCase(
      mockArticleRepository as any,
      mockGeminiClient as any,
      mockJinaReaderClient as any,
      mockMetadataExtractor as any,
      mockVectorClient as any
    );
  });

  it('reutiliza cache en modo standard sin llamar a Gemini', async () => {
    const cachedAnalysis = createAnalysis();
    const cachedArticle = createArticle({
      isAnalyzed: true,
      summary: cachedAnalysis.summary,
      biasScore: cachedAnalysis.biasScoreNormalized,
      analysis: JSON.stringify(cachedAnalysis),
      analyzedAt: new Date('2026-02-02T10:00:00Z'),
    });
    mockArticleRepository.findById.mockResolvedValueOnce(cachedArticle);

    const result = await useCase.execute({ articleId: cachedArticle.id, mode: 'standard' });

    expect(result.summary).toBe(cachedAnalysis.summary);
    expect(mockGeminiClient.analyzeArticle).not.toHaveBeenCalled();
    expect(mockArticleRepository.save).toHaveBeenCalledTimes(1);
    const persistedAccessState = mockArticleRepository.save.mock.calls[0][0] as NewsArticle;
    expect(persistedAccessState.accessStatus).toBe('PUBLIC');
    expect(persistedAccessState.analysisBlocked).toBe(false);
  });

  it('en modo deep regenera cache si faltan deep.sections', async () => {
    const cachedWithoutDeep = createAnalysis({
      analysisModeUsed: 'standard',
      deep: undefined,
    });
    const cachedArticle = createArticle({
      isAnalyzed: true,
      summary: cachedWithoutDeep.summary,
      biasScore: cachedWithoutDeep.biasScoreNormalized,
      analysis: JSON.stringify(cachedWithoutDeep),
      analyzedAt: new Date('2026-02-02T10:00:00Z'),
    });

    const deepFreshAnalysis = createAnalysis({
      analysisModeUsed: 'deep',
      deep: {
        sections: {
          known: ['K1'],
          unknown: ['U1'],
          quotes: ['"Q1"'],
          risks: ['R1'],
        },
      },
    });

    mockArticleRepository.findById.mockResolvedValueOnce(cachedArticle);
    mockGeminiClient.analyzeArticle.mockResolvedValueOnce(deepFreshAnalysis);
    mockGeminiClient.generateEmbedding.mockResolvedValueOnce(Array.from({ length: 8 }, () => 0.1));
    mockArticleRepository.save.mockResolvedValueOnce(undefined);
    mockVectorClient.upsertItem.mockResolvedValueOnce(undefined);

    const result = await useCase.execute({ articleId: cachedArticle.id, mode: 'deep' });

    expect(mockGeminiClient.analyzeArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisMode: 'deep',
      })
    );
    expect(mockArticleRepository.save).toHaveBeenCalled();
    expect(result.analysis.deep?.sections?.known).toEqual(expect.any(Array));
    expect(result.analysis.deep?.sections?.unknown).toEqual(expect.any(Array));
    expect(result.analysis.deep?.sections?.quotes).toEqual(expect.any(Array));
    expect(result.analysis.deep?.sections?.risks).toEqual(expect.any(Array));
  });

  it('si el articulo esta bloqueado por paywall no llama a Jina ni Gemini', async () => {
    const blockedArticle = createArticle({
      analysisBlocked: true,
      accessStatus: 'PAYWALLED',
      accessReason: 'metadata_subscriber_flag',
      analyzedAt: null,
      summary: null,
      biasScore: null,
      analysis: null,
    });

    mockArticleRepository.findById.mockResolvedValueOnce(blockedArticle);

    await expect(useCase.execute({ articleId: blockedArticle.id, mode: 'standard' })).rejects.toMatchObject({
      errorCode: 'PAYWALL_BLOCKED',
      httpStatusCode: 422,
    });

    expect(mockJinaReaderClient.scrapeUrl).not.toHaveBeenCalled();
    expect(mockGeminiClient.analyzeArticle).not.toHaveBeenCalled();
    expect(mockArticleRepository.save).not.toHaveBeenCalled();
  });

  it('si el articulo esta marcado PAYWALLED y tiene cache legacy, devuelve PAYWALL_BLOCKED', async () => {
    const cachedAnalysis = createAnalysis({
      summary: 'Resumen legacy cacheado',
      analysisModeUsed: 'standard',
    });
    const paywalledCachedArticle = createArticle({
      isAnalyzed: true,
      summary: cachedAnalysis.summary,
      biasScore: cachedAnalysis.biasScoreNormalized,
      analysis: JSON.stringify(cachedAnalysis),
      analyzedAt: new Date('2026-02-02T10:00:00Z'),
      analysisBlocked: false,
      accessStatus: 'PAYWALLED',
      accessReason: 'metadata_subscriber_flag',
    });

    mockArticleRepository.findById.mockResolvedValueOnce(paywalledCachedArticle);

    await expect(useCase.execute({ articleId: paywalledCachedArticle.id, mode: 'standard' })).rejects.toMatchObject({
      errorCode: 'PAYWALL_BLOCKED',
      httpStatusCode: 422,
    });

    expect(mockGeminiClient.analyzeArticle).not.toHaveBeenCalled();
    expect(mockJinaReaderClient.scrapeUrl).not.toHaveBeenCalled();
    expect(mockArticleRepository.save).not.toHaveBeenCalled();
  });
});
