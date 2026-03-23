import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticleBiasJsonParser } from '../../src/application/parsers/ArticleBiasJsonParser';
import { IArticleBiasAIProvider } from '../../src/application/contracts/IArticleBiasAIProvider';
import { AnalyzeArticleBiasUseCase } from '../../src/application/use-cases/bias-analysis/AnalyzeArticleBiasUseCase';
import { Article, ClassificationStatus } from '../../src/domain/entities/Article';
import { ArticleBiasAnalysis, BiasAnalysisStatus, IdeologyLabel } from '../../src/domain/entities/ArticleBiasAnalysis';
import { IArticleBiasAnalysisRepository } from '../../src/domain/repositories/IArticleBiasAnalysisRepository';
import { IArticleRepository } from '../../src/domain/repositories/IArticleRepository';
import { AIObservabilityService } from '../../src/infrastructure/observability/ai-observability.service';
import { PromptRegistryService } from '../../src/infrastructure/observability/prompt-registry.service';
import { TokenAndCostService } from '../../src/infrastructure/observability/token-and-cost.service';

function buildArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'article-1',
    feedId: 'feed-1',
    title: 'El parlamento debate una reforma fiscal clave',
    url: 'https://example.com/article-1',
    publishedAt: new Date('2026-03-17T10:00:00.000Z'),
    createdAt: new Date('2026-03-17T10:00:00.000Z'),
    updatedAt: new Date('2026-03-17T10:00:00.000Z'),
    isPolitical: true,
    classificationStatus: ClassificationStatus.COMPLETED,
    classificationReason: 'Politico',
    classifiedAt: new Date('2026-03-17T10:00:00.000Z'),
    ...overrides,
  };
}

function buildAnalysis(overrides: Partial<ArticleBiasAnalysis> = {}): ArticleBiasAnalysis {
  return {
    id: 'analysis-1',
    articleId: 'article-1',
    status: BiasAnalysisStatus.PENDING,
    provider: 'mock-ai',
    model: 'test-model',
    ideologyLabel: null,
    confidence: null,
    summary: null,
    reasoningShort: null,
    rawJson: null,
    errorMessage: null,
    analyzedAt: null,
    createdAt: new Date('2026-03-17T10:00:00.000Z'),
    updatedAt: new Date('2026-03-17T10:00:00.000Z'),
    ...overrides,
  };
}

describe('AnalyzeArticleBiasUseCase', () => {
  const mockArticleRepository: IArticleRepository = {
    saveManySkipDuplicates: vi.fn(),
    findByFeedId: vi.fn(),
    updateClassification: vi.fn(),
    findById: vi.fn(),
  };

  const mockArticleBiasAnalysisRepository: IArticleBiasAnalysisRepository = {
    findByArticleId: vi.fn(),
    upsertByArticleId: vi.fn(),
  };

  const mockAIProvider: IArticleBiasAIProvider = {
    providerName: 'mock-ai',
    modelName: 'test-model',
    getPromptDescriptors: vi.fn(() => ({
      primaryPrompt: {
        promptKey: 'article_bias_prompt',
        version: '1.0.0',
        template: 'prompt {{title}}',
        sourceFile: 'src/infrastructure/ai/articleBiasPrompt.ts',
      },
      relatedPrompts: [],
    })),
    analyzeArticle: vi.fn(),
  };

  const mockAiObservabilityService = {
    startRun: vi.fn(),
    completeRun: vi.fn(),
    failRun: vi.fn(),
  } as unknown as AIObservabilityService;

  const mockPromptRegistryService = {
    registerPromptVersion: vi.fn(),
  } as unknown as PromptRegistryService;

  const mockTokenAndCostService = {
    estimateCostMicrosEur: vi.fn(),
  } as unknown as TokenAndCostService;

  let useCase: AnalyzeArticleBiasUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new AnalyzeArticleBiasUseCase(
      mockArticleRepository,
      mockArticleBiasAnalysisRepository,
      mockAIProvider,
      new ArticleBiasJsonParser()
    );
  });

  it('no invoca IA si el articulo no es politico y persiste FAILED', async () => {
    vi.mocked(mockArticleRepository.findById).mockResolvedValue(buildArticle({
      isPolitical: false,
    }));
    vi.mocked(mockArticleBiasAnalysisRepository.findByArticleId).mockResolvedValue(null);
    vi.mocked(mockArticleBiasAnalysisRepository.upsertByArticleId).mockResolvedValue(buildAnalysis({
      status: BiasAnalysisStatus.FAILED,
      errorMessage: 'El articulo no es politico; no se analiza sesgo ideologico.',
      analyzedAt: new Date('2026-03-17T10:10:00.000Z'),
    }));

    const result = await useCase.execute('article-1');

    expect(result.analysis.status).toBe(BiasAnalysisStatus.FAILED);
    expect(result.invokedAI).toBe(false);
    expect(mockAIProvider.analyzeArticle).not.toHaveBeenCalled();
    expect(mockArticleBiasAnalysisRepository.upsertByArticleId).toHaveBeenCalledWith(expect.objectContaining({
      articleId: 'article-1',
      status: BiasAnalysisStatus.FAILED,
      errorMessage: expect.stringContaining('no es politico'),
    }));
  });

  it('reutiliza un analisis COMPLETED ya existente', async () => {
    vi.mocked(mockArticleRepository.findById).mockResolvedValue(buildArticle());
    vi.mocked(mockArticleBiasAnalysisRepository.findByArticleId).mockResolvedValue(buildAnalysis({
      status: BiasAnalysisStatus.COMPLETED,
      ideologyLabel: IdeologyLabel.CENTER_LEFT,
      confidence: 0.66,
      summary: 'Resumen existente',
      reasoningShort: 'Justificacion existente',
      analyzedAt: new Date('2026-03-17T10:10:00.000Z'),
    }));

    const result = await useCase.execute('article-1');

    expect(result.reusedExisting).toBe(true);
    expect(result.analysis.status).toBe(BiasAnalysisStatus.COMPLETED);
    expect(mockAIProvider.analyzeArticle).not.toHaveBeenCalled();
    expect(mockArticleBiasAnalysisRepository.upsertByArticleId).not.toHaveBeenCalled();
  });

  it('persiste FAILED si la IA devuelve JSON invalido', async () => {
    vi.mocked(mockArticleRepository.findById).mockResolvedValue(buildArticle());
    vi.mocked(mockArticleBiasAnalysisRepository.findByArticleId).mockResolvedValue(null);
    vi.mocked(mockArticleBiasAnalysisRepository.upsertByArticleId)
      .mockResolvedValueOnce(buildAnalysis({ status: BiasAnalysisStatus.PENDING }))
      .mockResolvedValueOnce(buildAnalysis({
        status: BiasAnalysisStatus.FAILED,
        rawJson: '{"ideologyLabel":"LEFT","confidence":"alta"}',
        errorMessage: 'Respuesta IA invalida: Payload de sesgo invalido',
        analyzedAt: new Date('2026-03-17T10:15:00.000Z'),
      }));
    vi.mocked(mockAIProvider.analyzeArticle).mockResolvedValue({
      provider: 'mock-ai',
      model: 'test-model',
      rawText: '{"ideologyLabel":"LEFT","confidence":"alta"}',
    });

    const result = await useCase.execute('article-1');

    expect(result.analysis.status).toBe(BiasAnalysisStatus.FAILED);
    expect(result.invokedAI).toBe(true);
    expect(mockAIProvider.analyzeArticle).toHaveBeenCalledTimes(1);
    expect(mockArticleBiasAnalysisRepository.upsertByArticleId).toHaveBeenCalledTimes(2);
    expect(mockArticleBiasAnalysisRepository.upsertByArticleId).toHaveBeenLastCalledWith(expect.objectContaining({
      articleId: 'article-1',
      status: BiasAnalysisStatus.FAILED,
      rawJson: '{"ideologyLabel":"LEFT","confidence":"alta"}',
      errorMessage: expect.stringContaining('Respuesta IA invalida'),
    }));
  });

  it('persiste COMPLETED cuando la IA devuelve JSON valido', async () => {
    vi.mocked(mockArticleRepository.findById).mockResolvedValue(buildArticle());
    vi.mocked(mockArticleBiasAnalysisRepository.findByArticleId).mockResolvedValue(null);
    vi.mocked(mockArticleBiasAnalysisRepository.upsertByArticleId)
      .mockResolvedValueOnce(buildAnalysis({ status: BiasAnalysisStatus.PENDING }))
      .mockResolvedValueOnce(buildAnalysis({
        status: BiasAnalysisStatus.COMPLETED,
        ideologyLabel: IdeologyLabel.CENTER_RIGHT,
        confidence: 0.73,
        summary: 'Titular con enfoque mas favorable a posiciones conservadoras.',
        reasoningShort: 'El framing prioriza orden y fiscalidad.',
        rawJson: '{"ideologyLabel":"CENTER_RIGHT","confidence":0.73,"summary":"Titular con enfoque mas favorable a posiciones conservadoras.","reasoningShort":"El framing prioriza orden y fiscalidad."}',
        analyzedAt: new Date('2026-03-17T10:20:00.000Z'),
      }));
    vi.mocked(mockAIProvider.analyzeArticle).mockResolvedValue({
      provider: 'mock-ai',
      model: 'test-model',
      rawText: '{"ideologyLabel":"CENTER_RIGHT","confidence":0.73,"summary":"Titular con enfoque mas favorable a posiciones conservadoras.","reasoningShort":"El framing prioriza orden y fiscalidad."}',
    });

    const result = await useCase.execute('article-1');

    expect(result.analysis.status).toBe(BiasAnalysisStatus.COMPLETED);
    expect(result.reusedExisting).toBe(false);
    expect(result.invokedAI).toBe(true);
    expect(mockArticleBiasAnalysisRepository.upsertByArticleId).toHaveBeenLastCalledWith(expect.objectContaining({
      articleId: 'article-1',
      status: BiasAnalysisStatus.COMPLETED,
      ideologyLabel: IdeologyLabel.CENTER_RIGHT,
      confidence: 0.73,
    }));
  });

  it('completa ai_operation_run cuando la IA devuelve tokens reales', async () => {
    vi.mocked(mockArticleRepository.findById).mockResolvedValue(buildArticle());
    vi.mocked(mockArticleBiasAnalysisRepository.findByArticleId).mockResolvedValue(null);
    vi.mocked(mockArticleBiasAnalysisRepository.upsertByArticleId)
      .mockResolvedValueOnce(buildAnalysis({ status: BiasAnalysisStatus.PENDING }))
      .mockResolvedValueOnce(buildAnalysis({
        status: BiasAnalysisStatus.COMPLETED,
        ideologyLabel: IdeologyLabel.CENTER,
        confidence: 0.61,
        summary: 'Resumen',
        reasoningShort: 'Motivo',
        analyzedAt: new Date('2026-03-17T10:20:00.000Z'),
      }));
    vi.mocked(mockPromptRegistryService.registerPromptVersion).mockResolvedValue({
      id: 'prompt-version-1',
      templateHash: 'hash-1',
    });
    vi.mocked(mockAiObservabilityService.startRun).mockResolvedValue('run-1');
    vi.mocked(mockTokenAndCostService.estimateCostMicrosEur).mockResolvedValue({
      estimatedCostMicrosEur: 1234n,
      pricingId: 'pricing-1',
      currency: 'EUR',
    });
    vi.mocked(mockAIProvider.analyzeArticle).mockResolvedValue({
      provider: 'mock-ai',
      model: 'test-model',
      rawText: '{"ideologyLabel":"CENTER","confidence":0.61,"summary":"Resumen","reasoningShort":"Motivo"}',
      tokenUsage: {
        promptTokens: 100,
        completionTokens: 40,
        totalTokens: 140,
      },
      metadata: {
        usageAvailable: true,
      },
    });

    useCase = new AnalyzeArticleBiasUseCase(
      mockArticleRepository,
      mockArticleBiasAnalysisRepository,
      mockAIProvider,
      new ArticleBiasJsonParser(),
      mockAiObservabilityService,
      mockPromptRegistryService,
      mockTokenAndCostService
    );

    const result = await useCase.execute('article-1', {
      requestId: 'req-1',
      correlationId: 'corr-1',
      endpoint: 'POST /api/articles/article-1/analyze-bias',
    });

    expect(result.analysis.status).toBe(BiasAnalysisStatus.COMPLETED);
    expect(mockAiObservabilityService.startRun).toHaveBeenCalledWith(expect.objectContaining({
      module: 'media-bias-atlas',
      operationKey: 'article_bias_analysis',
      requestId: 'req-1',
      correlationId: 'corr-1',
      entityType: 'article',
      entityId: 'article-1',
      promptVersionId: 'prompt-version-1',
    }));
    expect(mockTokenAndCostService.estimateCostMicrosEur).toHaveBeenCalledWith({
      provider: 'mock-ai',
      model: 'test-model',
      promptTokens: 100,
      completionTokens: 40,
    });
    expect(mockAiObservabilityService.completeRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-1',
      promptTokens: 100,
      completionTokens: 40,
      totalTokens: 140,
      estimatedCostMicrosEur: 1234n,
    }));
  });
});
