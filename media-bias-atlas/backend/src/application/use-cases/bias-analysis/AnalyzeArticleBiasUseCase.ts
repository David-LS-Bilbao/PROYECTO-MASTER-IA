import { ArticleBiasAnalysis, BiasAnalysisStatus } from '../../../domain/entities/ArticleBiasAnalysis';
import { IArticleRepository } from '../../../domain/repositories/IArticleRepository';
import { IArticleBiasAnalysisRepository } from '../../../domain/repositories/IArticleBiasAnalysisRepository';
import {
  ArticleBiasProviderPromptDescriptors,
  ArticleBiasTokenUsage,
  IArticleBiasAIProvider,
} from '../../contracts/IArticleBiasAIProvider';
import { ArticleBiasJsonParser } from '../../parsers/ArticleBiasJsonParser';
import {
  AIObservabilityService,
  AiRunStatus,
} from '../../../infrastructure/observability/ai-observability.service';
import { MbaAiObservabilityContext, normalizeMbaAiObservabilityContext } from '../../../infrastructure/observability/observability-context';
import { PromptRegistryService } from '../../../infrastructure/observability/prompt-registry.service';
import { TokenAndCostService } from '../../../infrastructure/observability/token-and-cost.service';
import { createModuleLogger } from '../../../infrastructure/logger/logger';

const MBA_MODULE = 'media-bias-atlas';
const ARTICLE_BIAS_OPERATION_KEY = 'article_bias_analysis';
const logger = createModuleLogger('AnalyzeArticleBiasUseCase');

export interface AnalyzeArticleBiasResult {
  analysis: ArticleBiasAnalysis;
  reusedExisting: boolean;
  invokedAI: boolean;
}

export class AnalyzeArticleBiasUseCase {
  constructor(
    private readonly articleRepository: IArticleRepository,
    private readonly articleBiasAnalysisRepository: IArticleBiasAnalysisRepository,
    private readonly articleBiasAIProvider: IArticleBiasAIProvider,
    private readonly articleBiasJsonParser: ArticleBiasJsonParser,
    private readonly aiObservabilityService?: AIObservabilityService,
    private readonly promptRegistryService?: PromptRegistryService,
    private readonly tokenAndCostService?: TokenAndCostService
  ) {}

  async execute(
    articleId: string,
    observabilityContext?: MbaAiObservabilityContext
  ): Promise<AnalyzeArticleBiasResult> {
    if (!articleId) {
      throw new Error('El ID del articulo es obligatorio');
    }

    const article = await this.articleRepository.findById(articleId);
    if (!article) {
      throw new Error(`Article with id ${articleId} not found`);
    }

    const existingAnalysis = await this.articleBiasAnalysisRepository.findByArticleId(articleId);
    if (existingAnalysis?.status === BiasAnalysisStatus.COMPLETED) {
      return {
        analysis: existingAnalysis,
        reusedExisting: true,
        invokedAI: false,
      };
    }

    if (article.isPolitical !== true) {
      const reason = article.isPolitical === false
        ? 'El articulo no es politico; no se analiza sesgo ideologico.'
        : 'El articulo aun no esta clasificado como politico.';

      return {
        analysis: await this.persistFailure(articleId, reason),
        reusedExisting: false,
        invokedAI: false,
      };
    }

    if (!article.title.trim()) {
      return {
        analysis: await this.persistFailure(articleId, 'El articulo no tiene titulo util para analizar.'),
        reusedExisting: false,
        invokedAI: false,
      };
    }

    const normalizedContext = normalizeMbaAiObservabilityContext(observabilityContext, {
      entityType: 'article',
      entityId: article.id,
      metadata: {
        feedId: article.feedId,
      },
    });
    const providerPrompts = this.articleBiasAIProvider.getPromptDescriptors();
    const promptRegistration = await this.registerPromptVersions(providerPrompts);
    const operationStartedAt = Date.now();

    await this.articleBiasAnalysisRepository.upsertByArticleId({
      articleId,
      status: BiasAnalysisStatus.PENDING,
      provider: this.articleBiasAIProvider.providerName,
      model: this.articleBiasAIProvider.modelName,
      ideologyLabel: null,
      confidence: null,
      summary: null,
      reasoningShort: null,
      rawJson: null,
      errorMessage: null,
      analyzedAt: null,
    });

    const runId = await this.startObservabilityRun({
      providerPrompts,
      promptRegistration,
      context: normalizedContext,
      articleId: article.id,
    });

    try {
      const providerResponse = await this.articleBiasAIProvider.analyzeArticle({
        articleId: article.id,
        title: article.title.trim(),
        url: article.url,
        publishedAt: article.publishedAt.toISOString(),
      });
      const estimatedCostMicrosEur = await this.estimateObservedCost(
        providerResponse.provider,
        providerResponse.model,
        providerResponse.tokenUsage
      );
      const runMetadata = this.buildRunMetadata({
        context: normalizedContext,
        article,
        providerPrompts,
        promptRegistration,
        providerMetadata: providerResponse.metadata,
        providerModel: providerResponse.model,
        tokenUsage: providerResponse.tokenUsage,
      });

      try {
        const parsed = this.articleBiasJsonParser.parse(providerResponse.rawText);

        const completedAnalysis = await this.articleBiasAnalysisRepository.upsertByArticleId({
          articleId,
          status: BiasAnalysisStatus.COMPLETED,
          provider: providerResponse.provider,
          model: providerResponse.model,
          ideologyLabel: parsed.ideologyLabel,
          confidence: parsed.confidence,
          summary: parsed.summary,
          reasoningShort: parsed.reasoningShort,
          rawJson: providerResponse.rawText,
          errorMessage: null,
          analyzedAt: new Date(),
        });

        await this.completeObservabilityRun({
          runId,
          tokenUsage: providerResponse.tokenUsage,
          estimatedCostMicrosEur,
          latencyMs: Date.now() - operationStartedAt,
          metadata: runMetadata,
        });

        return {
          analysis: completedAnalysis,
          reusedExisting: false,
          invokedAI: true,
        };
      } catch (error) {
        await this.failObservabilityRun({
          runId,
          status: AiRunStatus.FAILED,
          errorCode: 'INVALID_PROVIDER_RESPONSE',
          errorMessage: this.normalizeError(error),
          tokenUsage: providerResponse.tokenUsage,
          estimatedCostMicrosEur,
          latencyMs: Date.now() - operationStartedAt,
          metadata: runMetadata,
        });

        return {
          analysis: await this.persistFailure(
            articleId,
            `Respuesta IA invalida: ${this.normalizeError(error)}`,
            providerResponse.provider,
            providerResponse.model,
            providerResponse.rawText
          ),
          reusedExisting: false,
          invokedAI: true,
        };
      }
    } catch (error) {
      await this.failObservabilityRun({
        runId,
        status: this.mapErrorToAiRunStatus(error),
        errorCode: this.mapErrorCode(error),
        errorMessage: this.normalizeError(error),
        latencyMs: Date.now() - operationStartedAt,
        metadata: this.buildRunMetadata({
          context: normalizedContext,
          article,
          providerPrompts,
          promptRegistration,
          providerMetadata: {
            usageAvailable: false,
          },
          providerModel: this.articleBiasAIProvider.modelName,
          tokenUsage: undefined,
        }),
      });

      return {
        analysis: await this.persistFailure(
          articleId,
          `Error invocando IA: ${this.normalizeError(error)}`,
          this.articleBiasAIProvider.providerName,
          this.articleBiasAIProvider.modelName
        ),
        reusedExisting: false,
        invokedAI: true,
      };
    }
  }

  private async persistFailure(
    articleId: string,
    errorMessage: string,
    provider: string | null = this.articleBiasAIProvider.providerName,
    model: string | null = this.articleBiasAIProvider.modelName,
    rawJson: string | null = null
  ): Promise<ArticleBiasAnalysis> {
    return this.articleBiasAnalysisRepository.upsertByArticleId({
      articleId,
      status: BiasAnalysisStatus.FAILED,
      provider,
      model,
      ideologyLabel: null,
      confidence: null,
      summary: null,
      reasoningShort: null,
      rawJson,
      errorMessage,
      analyzedAt: new Date(),
    });
  }

  private normalizeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Error desconocido';
  }

  private async registerPromptVersions(
    prompts: ArticleBiasProviderPromptDescriptors
  ): Promise<{
    primaryPromptVersionId: string | null;
    relatedPromptVersionIds: string[];
  }> {
    if (!this.promptRegistryService) {
      return {
        primaryPromptVersionId: null,
        relatedPromptVersionIds: [],
      };
    }

    const relatedPromptVersionIds: string[] = [];
    let primaryPromptVersionId: string | null = null;

    try {
      if (prompts.primaryPrompt) {
        primaryPromptVersionId = (
          await this.promptRegistryService.registerPromptVersion({
            module: MBA_MODULE,
            promptKey: prompts.primaryPrompt.promptKey,
            version: prompts.primaryPrompt.version,
            template: prompts.primaryPrompt.template,
            sourceFile: prompts.primaryPrompt.sourceFile,
          })
        ).id;
      }

      for (const prompt of prompts.relatedPrompts ?? []) {
        const registered = await this.promptRegistryService.registerPromptVersion({
          module: MBA_MODULE,
          promptKey: prompt.promptKey,
          version: prompt.version,
          template: prompt.template,
          sourceFile: prompt.sourceFile,
        });
        relatedPromptVersionIds.push(registered.id);
      }
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'No se pudieron registrar prompt versions para observabilidad MBA'
      );

      return {
        primaryPromptVersionId: null,
        relatedPromptVersionIds: [],
      };
    }

    return {
      primaryPromptVersionId,
      relatedPromptVersionIds,
    };
  }

  private async startObservabilityRun(params: {
    providerPrompts: ArticleBiasProviderPromptDescriptors;
    promptRegistration: {
      primaryPromptVersionId: string | null;
      relatedPromptVersionIds: string[];
    };
    context: ReturnType<typeof normalizeMbaAiObservabilityContext>;
    articleId: string;
  }): Promise<string | null> {
    if (!this.aiObservabilityService) {
      return null;
    }

    try {
      return await this.aiObservabilityService.startRun({
        module: MBA_MODULE,
        operationKey: ARTICLE_BIAS_OPERATION_KEY,
        provider: this.articleBiasAIProvider.providerName,
        model: this.articleBiasAIProvider.modelName,
        promptVersionId: params.promptRegistration.primaryPromptVersionId,
        requestId: params.context.requestId,
        correlationId: params.context.correlationId,
        endpoint: params.context.endpoint,
        userId: params.context.userId,
        entityType: params.context.entityType ?? 'article',
        entityId: params.context.entityId ?? params.articleId,
        metadataJson: this.buildPromptMetadata(
          params.providerPrompts,
          params.promptRegistration,
          params.context.metadata
        ),
      });
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'No se pudo crear ai_operation_run para MBA'
      );
      return null;
    }
  }

  private async completeObservabilityRun(params: {
    runId: string | null;
    tokenUsage?: ArticleBiasTokenUsage;
    estimatedCostMicrosEur: bigint | null;
    latencyMs: number;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    if (!params.runId || !this.aiObservabilityService) {
      return;
    }

    await this.aiObservabilityService.completeRun({
      runId: params.runId,
      status: AiRunStatus.COMPLETED,
      promptTokens: params.tokenUsage?.promptTokens ?? null,
      completionTokens: params.tokenUsage?.completionTokens ?? null,
      totalTokens: params.tokenUsage?.totalTokens ?? null,
      estimatedCostMicrosEur: params.estimatedCostMicrosEur,
      latencyMs: params.latencyMs,
      metadataJson: params.metadata,
    });
  }

  private async failObservabilityRun(params: {
    runId: string | null;
    status: AiRunStatus;
    errorCode: string;
    errorMessage: string;
    tokenUsage?: ArticleBiasTokenUsage;
    estimatedCostMicrosEur?: bigint | null;
    latencyMs: number;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    if (!params.runId || !this.aiObservabilityService) {
      return;
    }

    await this.aiObservabilityService.failRun({
      runId: params.runId,
      status: params.status,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      promptTokens: params.tokenUsage?.promptTokens ?? null,
      completionTokens: params.tokenUsage?.completionTokens ?? null,
      totalTokens: params.tokenUsage?.totalTokens ?? null,
      estimatedCostMicrosEur: params.estimatedCostMicrosEur ?? null,
      latencyMs: params.latencyMs,
      metadataJson: params.metadata,
    });
  }

  private async estimateObservedCost(
    provider: string,
    model: string | null,
    tokenUsage: ArticleBiasTokenUsage | undefined
  ): Promise<bigint | null> {
    if (
      !this.tokenAndCostService ||
      !model ||
      !this.hasRealTokenUsage(tokenUsage)
    ) {
      return null;
    }

    try {
      const estimate = await this.tokenAndCostService.estimateCostMicrosEur({
        provider,
        model,
        promptTokens: tokenUsage?.promptTokens ?? null,
        completionTokens: tokenUsage?.completionTokens ?? null,
      });

      return estimate.estimatedCostMicrosEur;
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          provider,
          model,
        },
        'No se pudo estimar el coste IA para MBA'
      );
      return null;
    }
  }

  private hasRealTokenUsage(tokenUsage: ArticleBiasTokenUsage | undefined): boolean {
    return (
      typeof tokenUsage?.promptTokens === 'number' ||
      typeof tokenUsage?.completionTokens === 'number' ||
      typeof tokenUsage?.totalTokens === 'number'
    );
  }

  private buildRunMetadata(params: {
    context: ReturnType<typeof normalizeMbaAiObservabilityContext>;
    article: { id: string; feedId: string };
    providerPrompts: ArticleBiasProviderPromptDescriptors;
    promptRegistration: {
      primaryPromptVersionId: string | null;
      relatedPromptVersionIds: string[];
    };
    providerMetadata?: Record<string, unknown>;
    providerModel: string | null;
    tokenUsage?: ArticleBiasTokenUsage;
  }): Record<string, unknown> {
    return {
      ...this.buildPromptMetadata(
        params.providerPrompts,
        params.promptRegistration,
        params.context.metadata
      ),
      feedId: params.article.feedId,
      providerResponseModel: params.providerModel,
      tokenUsageAvailable: this.hasRealTokenUsage(params.tokenUsage),
      providerMetadata: params.providerMetadata ?? {
        usageAvailable: false,
      },
    };
  }

  private buildPromptMetadata(
    prompts: ArticleBiasProviderPromptDescriptors,
    promptRegistration: {
      primaryPromptVersionId: string | null;
      relatedPromptVersionIds: string[];
    },
    baseMetadata?: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      ...(baseMetadata ?? {}),
      promptKey: prompts.primaryPrompt?.promptKey ?? null,
      promptVersion: prompts.primaryPrompt?.version ?? null,
      promptSourceFile: prompts.primaryPrompt?.sourceFile ?? null,
      promptVersionId: promptRegistration.primaryPromptVersionId,
      relatedPromptKeys: (prompts.relatedPrompts ?? []).map((prompt) => prompt.promptKey),
      relatedPromptVersionIds: promptRegistration.relatedPromptVersionIds,
    };
  }

  private mapErrorToAiRunStatus(error: unknown): AiRunStatus {
    const message = this.normalizeError(error).toLowerCase();

    if (message.includes('timeout') || message.includes('etimedout')) {
      return AiRunStatus.TIMEOUT;
    }

    if (message.includes('cancel') || message.includes('abort')) {
      return AiRunStatus.CANCELLED;
    }

    return AiRunStatus.FAILED;
  }

  private mapErrorCode(error: unknown): string {
    const normalized = this.normalizeError(error);
    const httpStatusMatch = normalized.match(/respondio\s+(\d{3})/i);

    if (httpStatusMatch) {
      return `HTTP_${httpStatusMatch[1]}`;
    }

    const message = normalized.toLowerCase();
    if (message.includes('timeout') || message.includes('etimedout')) {
      return 'TIMEOUT';
    }

    if (message.includes('cancel') || message.includes('abort')) {
      return 'CANCELLED';
    }

    return 'PROVIDER_ERROR';
  }
}
