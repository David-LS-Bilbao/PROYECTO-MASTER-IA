/**
 * GeminiClient Implementation (Infrastructure Layer)
 * Uses Google's Gemini API for article analysis
 *
 * === COST OPTIMIZATION (Sprint 8) ===
 * - Prompts compactados para reducir tokens de entrada (~67% menos)
 * - LÃ­mites explÃ­citos de output para controlar tokens de salida
 * - Ventana deslizante de historial para evitar crecimiento exponencial
 * - DocumentaciÃ³n de decisiones de optimizaciÃ³n
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { AiRunStatus } from '@prisma/client';
import {
  IGeminiClient,
  AnalysisMode,
  AnalyzeContentInput,
  ChatWithContextInput,
  ChatResponse,
  AIObservabilityContext,
} from '../../domain/services/gemini-client.interface';
import { ArticleAnalysis, TokenUsage } from '../../domain/entities/news-article.entity';
import {
  ExternalAPIError,
  ConfigurationError,
} from '../../domain/errors/infrastructure.error';
import { TokenTaximeter } from '../monitoring/token-taximeter';
import { GeminiErrorMapper } from './gemini-error-mapper';
import { createModuleLogger } from '../logger/logger';
import { Sentry } from '../monitoring/sentry'; // Sprint 15 - Paso 3: Custom Spans for distributed tracing
import {
  analysisResponseSchema,
  type AnalysisResponsePayload,
  type ArticleLeaning,
  type LegacyBiasLeaning,
  type FactCheckVerdict,
  type FactualityStatus,
} from './schemas/analysis-response.schema';
import {
  ANALYSIS_PROMPT,
  ANALYSIS_PROMPT_DEEP,
  ANALYSIS_PROMPT_LOW_COST,
  ANALYSIS_PROMPT_MODERATE,
  buildLocationSourcesPrompt,
  MAX_ARTICLE_CONTENT_LENGTH,
  buildGroundingChatPrompt,
  buildRagChatPrompt,
  GROUNDING_CHAT_PROMPT_TEMPLATE,
  GROUNDING_CHAT_PROMPT_VERSION,
  LOCATION_SOURCES_PROMPT_TEMPLATE,
  LOCATION_SOURCES_PROMPT_VERSION,
  MAX_CHAT_HISTORY_MESSAGES,
  buildRssDiscoveryPrompt,
  RAG_CHAT_PROMPT_TEMPLATE,
  RAG_CHAT_PROMPT_VERSION,
  RSS_DISCOVERY_PROMPT_TEMPLATE,
  RSS_DISCOVERY_PROMPT_VERSION,
} from './prompts';
import { AIObservabilityService } from '../observability/ai-observability.service';
import { PromptRegistryService } from '../observability/prompt-registry.service';
import { TokenAndCostService } from '../observability/token-and-cost.service';
import {
  GENERAL_CHAT_PROMPT_VERSION,
  GENERAL_CHAT_SYSTEM_PROMPT,
} from './prompts/general-chat.prompt';

// ============================================================================
// LOGGER - SEGURIDAD (Sprint 14 - Bloqueante #1)
// ============================================================================

/**
 * Logger especÃ­fico para GeminiClient
 * Usa Pino con redaction automÃ¡tica de datos sensibles (PII)
 *
 * IMPORTANTE: Nunca loguear:
 * - TÃ­tulos de artÃ­culos (puede contener informaciÃ³n privada)
 * - Contenido de usuarios (preguntas, datos personales)
 * - URLs de fuentes privadas
 *
 * OK loguear:
 * - Metadatos: conteos, dimensiones, tokens
 * - Estados: "iniciando", "completado", "reintentando"
 * - Errores tÃ©cnicos: codigos, tipos de error (sin detalles sensibles)
 */
const logger = createModuleLogger('GeminiClient');

const getErrorCode = (error: unknown): string | undefined => {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code);
  }
  return undefined;
};

// ============================================================================
// TOKEN TAXIMETER - DEPENDENCY INJECTION (Bloqueante #2 resuelto)
// ============================================================================

/**
 * TokenTaximeter ya NO es un singleton global.
 * Ahora se inyecta en el constructor (Dependency Injection).
 *
 * Beneficios:
 * - Testing aislado con mocks
 * - Sin estado global compartido
 * - Mejor control del ciclo de vida
 */

// ============================================================================
// MODEL CONFIGURATION & LIMITS
// ============================================================================

/**
 * LÃ­mite de caracteres para texto de embedding.
 * El modelo text-embedding-004 tiene lÃ­mite de ~8000 tokens (~6000 chars).
 * Evita enviar textos enormes que consumen tokens innecesarios.
 */
const MAX_EMBEDDING_TEXT_LENGTH = 6000;
const ANALYSIS_HEAD_CHARS = 3000;
const ANALYSIS_TAIL_CHARS = 2000;
const ANALYSIS_QUOTES_DATA_CHARS = 2000;
const AUTO_LOW_COST_CONTENT_THRESHOLD = 800;
const ANALYSIS_PARSE_FALLBACK_SUMMARY =
  'No se pudo procesar el formato del analisis. Reintenta.';
const MAX_JSON_REPAIR_INPUT_CHARS = 12000;
const JSON_REPAIR_PROMPT = `
Eres un reparador de JSON.
TAREA:
- Recibirás una respuesta rota/no estructurada.
- Devuelve SOLO un JSON válido (sin markdown, sin texto adicional).
- Mantén el idioma original.

FORMATO MINIMO OBLIGATORIO:
{
  "summary": "string"
}

Si puedes, incluye también campos válidos del esquema de análisis:
"biasRaw","biasScoreNormalized","biasIndicators","reliabilityScore","traceabilityScore",
"factualityStatus","evidence_needed","should_escalate","clickbaitScore","sentiment",
"mainTopics","factCheck":{"claims":[],"verdict":"SupportedByArticle|NotSupportedByArticle|InsufficientEvidenceInArticle","reasoning":"string"},
"deep":{"sections":{"known":[],"unknown":[],"quotes":[],"risks":[]}}
`;

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /disregard\s+(all\s+)?previous\s+instructions?/gi,
  /follow\s+these\s+new\s+instructions/gi,
  /system\s+prompt/gi,
  /developer\s+message/gi,
];

const HIGH_RISK_CLAIM_PATTERNS: RegExp[] = [
  /\b(cura|curacion|tratamiento definitivo|vacuna definitiva)\b/i,
  /\b(fraude electoral|elecciones manipuladas|golpe de estado)\b/i,
  /\b(colapso bancario|quiebra inminente|corrida bancaria)\b/i,
  /\b(ataque terrorista|amenaza inminente|riesgo de seguridad)\b/i,
  /\b(murio|mueren|fallecio|fallecieron)\b/i,
];

const VERITY_MODULE = 'verity';
const ARTICLE_ANALYSIS_OPERATION_KEY = 'article_analysis';
const RAG_CHAT_OPERATION_KEY = 'rag_chat';
const GENERAL_CHAT_GROUNDING_OPERATION_KEY = 'general_chat_grounding';
const GROUNDING_CHAT_OPERATION_KEY = 'grounding_chat';
const EMBEDDING_OPERATION_KEY = 'embedding_generation';
const JSON_REPAIR_OPERATION_KEY = 'json_repair';
const RSS_DISCOVERY_OPERATION_KEY = 'rss_discovery';
const LOCAL_SOURCE_DISCOVERY_OPERATION_KEY = 'local_source_discovery';
const GEMINI_PROVIDER = 'google';
const GEMINI_ANALYSIS_MODEL = 'gemini-2.5-flash';
const GEMINI_EMBEDDING_MODEL = 'text-embedding-004';
const ANALYSIS_PROMPT_SOURCE_FILE =
  'backend/src/infrastructure/external/prompts/analysis.prompt.ts';
const ANALYSIS_PROMPT_VERSION = '1.0.0';
const RAG_CHAT_PROMPT_SOURCE_FILE =
  'backend/src/infrastructure/external/prompts/rag-chat.prompt.ts';
const GROUNDING_CHAT_PROMPT_SOURCE_FILE =
  'backend/src/infrastructure/external/prompts/grounding-chat.prompt.ts';
const GENERAL_CHAT_PROMPT_SOURCE_FILE =
  'backend/src/infrastructure/external/prompts/general-chat.prompt.ts';
const RSS_DISCOVERY_PROMPT_SOURCE_FILE =
  'backend/src/infrastructure/external/prompts/rss-discovery.prompt.ts';
const JSON_REPAIR_PROMPT_SOURCE_FILE =
  'backend/src/infrastructure/external/gemini.client.ts';
const JSON_REPAIR_PROMPT_KEY = 'JSON_REPAIR_PROMPT';
const JSON_REPAIR_PROMPT_VERSION = '1.0.0';

interface PromptRegistrationConfig {
  promptKey: string;
  version: string;
  template: string;
  sourceFile: string;
}

interface NormalizedAiObservabilityContext extends AIObservabilityContext {
  requestId: string;
  correlationId: string;
}

interface AiOperationRunContext {
  context: NormalizedAiObservabilityContext;
  operationKey: string;
  provider: string;
  model: string;
  promptVersionId: string | null;
  promptKey?: string;
  promptVersion?: string;
  runId: string | null;
  startedAt: number;
}

interface OperationTokenUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

interface GeminiClientDependencies {
  aiObservabilityService?: AIObservabilityService;
  promptRegistryService?: PromptRegistryService;
  tokenAndCostService?: TokenAndCostService;
}

export class GeminiClient implements IGeminiClient {
  private readonly model: GenerativeModel;
  private readonly chatModel: GenerativeModel;
  private readonly genAI: GoogleGenerativeAI;
  private readonly taximeter: TokenTaximeter;
  private readonly aiObservabilityService?: AIObservabilityService;
  private readonly promptRegistryService?: PromptRegistryService;
  private readonly tokenAndCostService?: TokenAndCostService;

  constructor(
    apiKey: string,
    taximeter: TokenTaximeter,
    dependencies: GeminiClientDependencies = {}
  ) {
    if (!apiKey || apiKey.trim() === '') {
      throw new ConfigurationError('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.taximeter = taximeter;
    this.aiObservabilityService = dependencies.aiObservabilityService;
    this.promptRegistryService = dependencies.promptRegistryService;
    this.tokenAndCostService = dependencies.tokenAndCostService;

    // Modelo base para anÃ¡lisis (sin herramientas externas)
    this.model = this.genAI.getGenerativeModel({ model: GEMINI_ANALYSIS_MODEL });

    // Modelo para chat con Google Search habilitado (Grounding)
    this.chatModel = this.genAI.getGenerativeModel({
      model: GEMINI_ANALYSIS_MODEL,
          // @ts-expect-error - googleSearch tool typing not yet available in current SDK
          tools: [{ googleSearch: {} }],
    });
  }

  /**
   * Generic retry mechanism with exponential backoff
   * 
   * RESILIENCIA: Reintentos inteligentes para errores transitorios
   * - Solo reintenta errores 429 (Rate Limit) y 5xx (Server Errors)
   * - No reintenta errores 401 (Auth), 404 (Not Found), 400 (Bad Request)
   * - Exponential Backoff: delay * (2 ^ attempt)
   * 
   * @param operation FunciÃ³n asÃ­ncrona a ejecutar
   * @param retries NÃºmero mÃ¡ximo de reintentos (default: 3)
   * @param initialDelay Delay inicial en ms (default: 1000)
   * @returns Resultado de la operaciÃ³n
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message || '';

        // No reintentar errores no transitorios
        const isRetryable = GeminiErrorMapper.isRetryable(errorMessage);

        if (!isRetryable || attempt >= retries) {
          // Ãšltimo intento o error no retriable
          throw GeminiErrorMapper.toExternalAPIError(lastError);
        }

        // Calcular delay con exponential backoff
        const delay = initialDelay * Math.pow(2, attempt - 1);

        logger.warn(
          {
            attempt,
            retries,
            delayMs: delay,
            errorCode: getErrorCode(error),
          },
          `Gemini API transient error - retrying`
        );

        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Si llegamos aquÃ­, todos los reintentos fallaron
    throw new ExternalAPIError(
      'Gemini',
      `Operation failed after ${retries} attempts: ${lastError?.message}`,
      500,
      lastError || undefined
    );
  }

  /**
   * Analyze article content with AI
   * Security: Includes retry with exponential backoff for rate limit handling
   */
  async analyzeArticle(input: AnalyzeContentInput): Promise<ArticleAnalysis> {
    // COST OPTIMIZATION: 'language' eliminado del prompt (se infiere del contenido)
    const { title, content, source } = input;

    // Validate input
    if (!content || content.trim().length < 50) {
      throw new ExternalAPIError(
        'Gemini',
        'Content is too short for meaningful analysis',
        400
      );
    }

    // Neutralize known prompt-injection patterns without mutating article structure.
    const sanitizedTitle = this.sanitizeInput(title);
    const sanitizedContent = this.sanitizeInput(content);
    const sanitizedSource = this.sanitizeInput(source);
    const selectedContent = this.selectContentForAnalysis(sanitizedContent);
    const requestedMode = this.normalizeAnalysisMode(input.analysisMode);
    const effectiveMode = this.resolveAnalysisMode(requestedMode, sanitizedContent);
    const inputQuality = this.normalizeInputQuality(
      input.inputQuality,
      sanitizedContent.length
    );
    const contentChars =
      typeof input.contentChars === 'number' && input.contentChars > 0
        ? Math.floor(input.contentChars)
        : sanitizedContent.length;
    const textSource = this.normalizeTextSource(input.textSource);

    // COST OPTIMIZATION: Seleccion inteligente de contenido para reducir tokens.
    const promptDescriptor = this.getAnalysisPromptDescriptor(effectiveMode);
    const prompt = this.populateAnalysisPrompt(promptDescriptor.template, {
      title: sanitizedTitle,
      source: sanitizedSource,
      content: selectedContent,
      inputQuality,
      contentChars,
      textSource,
    });
    const observabilityContext = this.normalizeObservabilityContext(input.observability);
    const operationStartedAt = Date.now();
    let runId: string | null = null;
    let promptVersionId: string | null = null;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;
    let totalTokens: number | null = null;

    promptVersionId = await this.registerPromptVersion({
      promptDescriptorName: promptDescriptor.name,
      promptTemplate: promptDescriptor.template,
      analysisMode: effectiveMode,
    });

    if (this.aiObservabilityService) {
      try {
        runId = await this.aiObservabilityService.startRun({
          module: VERITY_MODULE,
          operationKey: ARTICLE_ANALYSIS_OPERATION_KEY,
          provider: GEMINI_PROVIDER,
          model: GEMINI_ANALYSIS_MODEL,
          status: AiRunStatus.PENDING,
          promptVersionId,
          requestId: observabilityContext.requestId,
          correlationId: observabilityContext.correlationId,
          endpoint: observabilityContext.endpoint,
          userId: observabilityContext.userId,
          entityType: observabilityContext.entityType,
          entityId: observabilityContext.entityId,
          metadataJson: {
            ...observabilityContext.metadata,
            promptKey: promptDescriptor.name,
            promptVersion: ANALYSIS_PROMPT_VERSION,
            analysisMode: effectiveMode,
            inputQuality,
            contentChars,
            textSource,
          },
        });
      } catch (observabilityError) {
        logger.warn(
          {
            error:
              observabilityError instanceof Error
                ? observabilityError.message
                : String(observabilityError),
          },
          'Could not persist initial AI operation run'
        );
      }
    }

    try {
      const analysis = await this.executeWithRetry(async () => {
        logger.info(
          {
            originalContentLength: sanitizedContent.length,
            selectedContentLength: selectedContent.length,
            promptProfile: effectiveMode,
            analysis_mode: effectiveMode,
            prompt_name: promptDescriptor.name,
            inputQuality,
            contentChars,
            textSource,
          },
          'Starting article analysis'
        );

        // ðŸ” Sprint 15 - Paso 3: Custom Span for Performance Monitoring
        // Envuelve la llamada a Gemini en un span para distributed tracing
        const result = await Sentry.startSpan(
          {
            name: 'gemini.analyze_article',
            op: 'ai.generation',
            attributes: {
              'ai.model': GEMINI_ANALYSIS_MODEL,
              'ai.operation': 'article_analysis',
              'input.content_length': selectedContent.length,
            },
          },
          async () =>
            await this.model.generateContent({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: this.getMaxOutputTokensForMode(effectiveMode),
              },
            })
        );

        const response = result.response;
        const text = response.text();

        // TOKEN TAXIMETER: Capturar uso de tokens
        const usageMetadata = response.usageMetadata;
        let tokenUsage: TokenUsage | undefined;

        if (usageMetadata) {
          promptTokens = usageMetadata.promptTokenCount || 0;
          completionTokens = usageMetadata.candidatesTokenCount || 0;
          totalTokens = promptTokens + completionTokens; // Always calculate manually to avoid cached tokens inflation
          const costEstimated = this.taximeter.calculateCost(promptTokens, completionTokens);

          tokenUsage = {
            promptTokens,
            completionTokens,
            totalTokens,
            costEstimated,
          };

          // ðŸ” Sprint 15 - Paso 3: AÃ±adir mÃ©tricas de tokens al span activo
          const activeSpan = Sentry.getActiveSpan();
          if (activeSpan) {
            activeSpan.setAttribute('ai.tokens.prompt', promptTokens);
            activeSpan.setAttribute('ai.tokens.completion', completionTokens);
            activeSpan.setAttribute('ai.tokens.total', totalTokens);
            activeSpan.setAttribute('ai.cost_eur', costEstimated);
          }

          // Log with taximeter (IMPORTANTE: no loguea tÃ­tulos, solo metadatos)
          this.taximeter.logAnalysis(
            '[REDACTED]',
            promptTokens,
            completionTokens,
            totalTokens,
            costEstimated
          );

          logger.debug(
            { promptTokens, completionTokens, totalTokens, costEUR: costEstimated },
            'Article analysis completed with token usage'
          );
        } else {
          logger.debug('Article analysis completed without token metadata');
        }

        let parsedAnalysis: ArticleAnalysis;
        try {
          parsedAnalysis = this.parseAnalysisResponse(
            text,
            tokenUsage,
            sanitizedContent,
            effectiveMode
          );
        } catch (parseError) {
          logger.warn(
            {
              error:
                parseError instanceof Error ? parseError.message : String(parseError),
            },
            'Initial analysis parsing failed. Attempting one JSON repair.'
          );
          const repairedRaw = await this.tryJsonRepair(text, {
            ...observabilityContext,
            operationKey: JSON_REPAIR_OPERATION_KEY,
            metadata: {
              ...observabilityContext.metadata,
              parentOperationKey: ARTICLE_ANALYSIS_OPERATION_KEY,
            },
          });
          if (repairedRaw) {
            try {
              parsedAnalysis = this.parseAnalysisResponse(
                repairedRaw,
                tokenUsage,
                sanitizedContent,
                effectiveMode
              );
              return parsedAnalysis;
            } catch (repairError) {
              logger.warn(
                {
                  error:
                    repairError instanceof Error
                      ? repairError.message
                      : String(repairError),
                },
                'JSON repair parse failed. Returning fallback analysis.'
              );
            }
          }

          return this.parseAnalysisResponse(
            JSON.stringify({ summary: ANALYSIS_PARSE_FALLBACK_SUMMARY }),
            tokenUsage,
            sanitizedContent,
            effectiveMode
          );
        }

        if (parsedAnalysis.formatError) {
          const repairedRaw = await this.tryJsonRepair(text, {
            ...observabilityContext,
            operationKey: JSON_REPAIR_OPERATION_KEY,
            metadata: {
              ...observabilityContext.metadata,
              parentOperationKey: ARTICLE_ANALYSIS_OPERATION_KEY,
            },
          });
          if (repairedRaw) {
            try {
              const repairedAnalysis = this.parseAnalysisResponse(
                repairedRaw,
                tokenUsage,
                sanitizedContent,
                effectiveMode
              );
              if (!repairedAnalysis.formatError) {
                return repairedAnalysis;
              }
            } catch (repairError) {
              logger.warn(
                {
                  error:
                    repairError instanceof Error
                      ? repairError.message
                      : String(repairError),
                },
                'JSON repair attempt failed after fallback parse.'
              );
            }
          }
        }

        return parsedAnalysis;
      }, 3, 1000);

      if (runId && this.aiObservabilityService) {
        const estimatedCostMicrosEur = await this.estimateRunCostMicrosEur({
          provider: GEMINI_PROVIDER,
          model: GEMINI_ANALYSIS_MODEL,
          promptTokens,
          completionTokens,
        });
        await this.aiObservabilityService.completeRun({
          runId,
          status: AiRunStatus.COMPLETED,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostMicrosEur,
          latencyMs: Date.now() - operationStartedAt,
          metadataJson: {
            ...observabilityContext.metadata,
            promptKey: promptDescriptor.name,
            promptVersion: ANALYSIS_PROMPT_VERSION,
            analysisMode: effectiveMode,
            inputQuality,
            contentChars,
            textSource,
          },
        });
      }

      return analysis;
    } catch (error) {
      const mappedError =
        error instanceof ExternalAPIError
          ? error
          : GeminiErrorMapper.toExternalAPIError(error);

      if (runId && this.aiObservabilityService) {
        const estimatedCostMicrosEur = await this.estimateRunCostMicrosEur({
          provider: GEMINI_PROVIDER,
          model: GEMINI_ANALYSIS_MODEL,
          promptTokens,
          completionTokens,
        });
        await this.aiObservabilityService.failRun({
          runId,
          status: this.mapErrorToAiRunStatus(mappedError),
          errorCode: String(mappedError.statusCode ?? 'UNKNOWN'),
          errorMessage: mappedError.message,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostMicrosEur,
          latencyMs: Date.now() - operationStartedAt,
          metadataJson: {
            ...observabilityContext.metadata,
            promptKey: promptDescriptor.name,
            promptVersion: ANALYSIS_PROMPT_VERSION,
            analysisMode: effectiveMode,
            inputQuality,
            contentChars,
            textSource,
          },
        });
      }

      throw mappedError;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Sin reintentos para health check (queremos respuesta rÃ¡pida)
      const result = await this.model.generateContent('Respond with "OK"');
      return result.response.text().includes('OK');
    } catch {
      return false;
    }
  }

  /**
   * Generate embedding vector for text using text-embedding-004
   * Includes retry logic for transient failures
   */
  async generateEmbedding(
    text: string,
    observability?: AIObservabilityContext
  ): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new ExternalAPIError(
        'Gemini',
        'Text is required for embedding generation',
        400
      );
    }

    const truncatedText = text.substring(0, MAX_EMBEDDING_TEXT_LENGTH);
    const operation = await this.beginAiOperationRun({
      operationKey: EMBEDDING_OPERATION_KEY,
      model: GEMINI_EMBEDDING_MODEL,
      observability,
      metadata: {
        textLength: truncatedText.length,
        tokenUsageAvailable: false,
      },
    });

    let tokenUsage: OperationTokenUsage = {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    };

    try {
      const embedding = await this.executeWithRetry(async () => {
        logger.info(
          { textLength: truncatedText.length },
          'Starting embedding generation'
        );

        return await Sentry.startSpan(
          {
            name: 'gemini.generate_embedding',
            op: 'ai.embedding',
            attributes: {
              'ai.model': GEMINI_EMBEDDING_MODEL,
              'ai.operation': EMBEDDING_OPERATION_KEY,
              'input.text_length': truncatedText.length,
            },
          },
          async () => {
            const embeddingModel = this.genAI.getGenerativeModel({
              model: GEMINI_EMBEDDING_MODEL,
            });
            const result = await embeddingModel.embedContent(truncatedText);
            const values = result.embedding.values;
            const usageMetadata = (
              result as {
                usageMetadata?: {
                  promptTokenCount?: number;
                  candidatesTokenCount?: number;
                  totalTokenCount?: number;
                };
              }
            ).usageMetadata;
            tokenUsage = this.resolveTokenUsage(usageMetadata);

            const activeSpan = Sentry.getActiveSpan();
            if (activeSpan) {
              activeSpan.setAttribute('ai.embedding.dimensions', values.length);
              activeSpan.setAttribute(
                'ai.embedding.usage_metadata_available',
                Boolean(usageMetadata)
              );
            }

            return values;
          }
        );
      }, 3, 1000);

      logger.debug(
        { embeddingDimensions: embedding.length },
        'Embedding generated successfully'
      );

      await this.completeAiOperationRun({
        operation,
        tokens: tokenUsage,
        metadata: {
          textLength: truncatedText.length,
          embeddingDimensions: embedding.length,
          tokenUsageAvailable: tokenUsage.totalTokens !== null,
        },
      });

      return embedding;
    } catch (error) {
      const mappedError =
        error instanceof ExternalAPIError
          ? error
          : GeminiErrorMapper.toExternalAPIError(error);

      await this.failAiOperationRun({
        operation,
        error: mappedError,
        tokens: tokenUsage,
        metadata: {
          textLength: truncatedText.length,
          tokenUsageAvailable: tokenUsage.totalTokens !== null,
        },
      });

      throw mappedError;
    }
  }

  /**
   * Chat with context injection for article Q&A
   * Uses Google Search Grounding for hybrid responses (article + external info)
   *
   * COST OPTIMIZATION: Ventana deslizante de historial
   * - Solo se envÃ­an los Ãºltimos MAX_CHAT_HISTORY_MESSAGES mensajes
   * - Evita crecimiento exponencial de tokens en conversaciones largas
   * - Ahorro estimado: ~70% en conversaciones de 20+ mensajes
   */
  async chatWithContext(input: ChatWithContextInput): Promise<ChatResponse> {
    const { systemContext, messages, observability } = input;

    if (!messages || messages.length === 0) {
      throw new ExternalAPIError('Gemini', 'At least one message is required', 400);
    }

    // COST OPTIMIZATION: Ventana deslizante - solo Ãºltimos N mensajes
    const recentMessages = messages.slice(-MAX_CHAT_HISTORY_MESSAGES);

    if (messages.length > MAX_CHAT_HISTORY_MESSAGES) {
      logger.debug(
        { originalCount: messages.length, truncatedCount: recentMessages.length },
        'Chat history window truncated to optimize costs'
      );
    }

    // COST OPTIMIZATION: Prompt extraÃ­do a mÃ³dulo centralizado
    const conversationParts = buildGroundingChatPrompt(recentMessages);
    conversationParts.unshift(`[CONTEXTO]\n${systemContext}`, '\n[HISTORIAL]');
    conversationParts.push('\nResponde a la Ãºltima pregunta.');
    const prompt = conversationParts.join('\n');
    const operation = await this.beginAiOperationRun({
      operationKey: GROUNDING_CHAT_OPERATION_KEY,
      model: GEMINI_ANALYSIS_MODEL,
      observability,
      prompt: {
        promptKey: 'GROUNDING_CHAT_PROMPT',
        version: GROUNDING_CHAT_PROMPT_VERSION,
        template: GROUNDING_CHAT_PROMPT_TEMPLATE,
        sourceFile: GROUNDING_CHAT_PROMPT_SOURCE_FILE,
      },
      metadata: {
        messageCount: messages.length,
        recentMessageCount: recentMessages.length,
        systemContextLength: systemContext.length,
      },
    });
    let tokenUsage: OperationTokenUsage = {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    };

    try {
      const responsePayload = await this.executeWithRetry(async () => {
        logger.info(
          { messageCount: recentMessages.length },
          'Starting grounding chat with Google Search'
        );

      // ðŸ” Sprint 15 - Paso 3: Custom Span for Grounding Chat
      const result = await Sentry.startSpan(
        {
          name: 'gemini.chat_with_grounding',
          op: 'ai.chat',
          attributes: {
            'ai.model': 'gemini-2.5-flash',
            'ai.operation': 'grounding_chat',
            'ai.grounding.enabled': true,
            'chat.message_count': recentMessages.length,
          },
        },
        async () => await this.chatModel.generateContent(prompt)
      );

        const response = result.response;
        const text = response.text();

        // Log if grounding was used
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        if (groundingMetadata?.searchEntryPoint) {
          logger.debug('Google Search grounding was utilized');

          // ðŸ” Add grounding metadata to span
          const activeSpan = Sentry.getActiveSpan();
          if (activeSpan) {
            activeSpan.setAttribute('ai.grounding.used', true);
          }
        }

        // TOKEN TAXIMETER: Capturar uso de tokens para chat grounding
        const usageMetadata = response.usageMetadata;
        tokenUsage = this.resolveTokenUsage(usageMetadata);
        if (usageMetadata) {
          const promptTokens = tokenUsage.promptTokens ?? 0;
          const completionTokens = tokenUsage.completionTokens ?? 0;
          const totalTokens = tokenUsage.totalTokens ?? promptTokens + completionTokens;
          const costEstimated = this.taximeter.calculateCost(promptTokens, completionTokens);

          // ðŸ” Sprint 15 - Paso 3: AÃ±adir mÃ©tricas de tokens al span activo
          const activeSpan = Sentry.getActiveSpan();
          if (activeSpan) {
            activeSpan.setAttribute('ai.tokens.prompt', promptTokens);
            activeSpan.setAttribute('ai.tokens.completion', completionTokens);
            activeSpan.setAttribute('ai.tokens.total', totalTokens);
            activeSpan.setAttribute('ai.cost_eur', costEstimated);
          }

          // SECURITY: No loguear la pregunta del usuario, solo metadatos
          this.taximeter.logGroundingChat(
            '[REDACTED]',
            promptTokens,
            completionTokens,
            totalTokens,
            costEstimated
          );

          logger.debug(
            { promptTokens, completionTokens, totalTokens, costEUR: costEstimated },
            'Grounding chat completed with token usage'
          );
        }

        return { message: text.trim() };
      }, 3, 1000); // 3 reintentos, 1s delay inicial

      await this.completeAiOperationRun({
        operation,
        tokens: tokenUsage,
        metadata: {
          messageCount: messages.length,
          recentMessageCount: recentMessages.length,
          systemContextLength: systemContext.length,
          tokenUsageAvailable: tokenUsage.totalTokens !== null,
        },
      });

      return responsePayload;
    } catch (error) {
      const mappedError =
        error instanceof ExternalAPIError
          ? error
          : GeminiErrorMapper.toExternalAPIError(error);

      await this.failAiOperationRun({
        operation,
        error: mappedError,
        tokens: tokenUsage,
        metadata: {
          messageCount: messages.length,
          recentMessageCount: recentMessages.length,
          systemContextLength: systemContext.length,
          tokenUsageAvailable: tokenUsage.totalTokens !== null,
        },
      });

      throw mappedError;
    }
  }

  /**
   * Generate a chat response using RAG context
   * Uses a focused system prompt that only answers from provided context
   * NO Google Search Grounding - pure RAG response
   *
   * COST OPTIMIZATION: Prompt compactado
   * - Eliminado markdown decorativo en instrucciones
   * - Reducidos ejemplos de fallback (3 â†’ 1)
   * - Headers simplificados
   * - AÃ±adido lÃ­mite de output (max 150 palabras)
   * - Ahorro estimado: ~70% en tokens de instrucciones
   */
  async generateChatResponse(
    context: string,
    question: string,
    observability?: AIObservabilityContext
  ): Promise<string> {
    if (!context || context.trim().length === 0) {
      throw new ExternalAPIError('Gemini', 'Context is required for RAG response', 400);
    }

    if (!question || question.trim().length === 0) {
      throw new ExternalAPIError('Gemini', 'Question is required', 400);
    }

    // COST OPTIMIZATION: Prompt extraÃ­do a mÃ³dulo centralizado
    const ragPrompt = buildRagChatPrompt(question, context);
    const operation = await this.beginAiOperationRun({
      operationKey: RAG_CHAT_OPERATION_KEY,
      model: GEMINI_ANALYSIS_MODEL,
      observability,
      prompt: {
        promptKey: 'RAG_CHAT_PROMPT',
        version: RAG_CHAT_PROMPT_VERSION,
        template: RAG_CHAT_PROMPT_TEMPLATE,
        sourceFile: RAG_CHAT_PROMPT_SOURCE_FILE,
      },
      metadata: {
        questionLength: question.length,
        contextLength: context.length,
      },
    });
    let tokenUsage: OperationTokenUsage = {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    };

    try {
      const generatedResponse = await this.executeWithRetry(async () => {
        logger.info('Starting RAG chat response generation');

      // ðŸ” Sprint 15 - Paso 3: Custom Span for RAG Chat
      const result = await Sentry.startSpan(
        {
          name: 'gemini.rag_chat',
          op: 'ai.chat',
          attributes: {
            'ai.model': 'gemini-2.5-flash',
            'ai.operation': 'rag_chat',
            'ai.grounding.enabled': false,
            'rag.context_length': context.length,
          },
        },
        async () => await this.model.generateContent(ragPrompt)
      );

        const response = result.response;
        const text = response.text().trim();

        // TOKEN TAXIMETER: Capturar uso de tokens para RAG chat
        const usageMetadata = response.usageMetadata;
        tokenUsage = this.resolveTokenUsage(usageMetadata);
        if (usageMetadata) {
          const promptTokens = tokenUsage.promptTokens ?? 0;
          const completionTokens = tokenUsage.completionTokens ?? 0;
          const totalTokens = tokenUsage.totalTokens ?? promptTokens + completionTokens;
          const costEstimated = this.taximeter.calculateCost(promptTokens, completionTokens);

          // ðŸ” Sprint 15 - Paso 3: AÃ±adir mÃ©tricas de tokens al span activo
          const activeSpan = Sentry.getActiveSpan();
          if (activeSpan) {
            activeSpan.setAttribute('ai.tokens.prompt', promptTokens);
            activeSpan.setAttribute('ai.tokens.completion', completionTokens);
            activeSpan.setAttribute('ai.tokens.total', totalTokens);
            activeSpan.setAttribute('ai.cost_eur', costEstimated);
          }

          // SECURITY: No loguear la pregunta del usuario, solo metadatos
          this.taximeter.logRagChat(
            '[REDACTED]',
            promptTokens,
            completionTokens,
            totalTokens,
            costEstimated
          );

          logger.debug(
            { promptTokens, completionTokens, totalTokens, costEUR: costEstimated },
            'RAG chat completed with token usage'
          );
        }

        return text;
      }, 3, 1000); // 3 reintentos, 1s delay inicial

      await this.completeAiOperationRun({
        operation,
        tokens: tokenUsage,
        metadata: {
          questionLength: question.length,
          contextLength: context.length,
          tokenUsageAvailable: tokenUsage.totalTokens !== null,
        },
      });

      return generatedResponse;
    } catch (error) {
      const mappedError =
        error instanceof ExternalAPIError
          ? error
          : GeminiErrorMapper.toExternalAPIError(error);

      await this.failAiOperationRun({
        operation,
        error: mappedError,
        tokens: tokenUsage,
        metadata: {
          questionLength: question.length,
          contextLength: context.length,
          tokenUsageAvailable: tokenUsage.totalTokens !== null,
        },
      });

      throw mappedError;
    }
  }

  /**
   * Generate a general chat response with conversation history and Google Search Grounding.
   * Uses chatModel (Google Search enabled) for real-time data access.
   *
   * Sprint 27.4: Chat General con conocimiento completo + Google Search
   */
  async generateGeneralResponse(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    observability?: AIObservabilityContext
  ): Promise<string> {
    if (!systemPrompt || systemPrompt.trim().length === 0) {
      throw new ExternalAPIError('Gemini', 'System prompt is required', 400);
    }

    if (!messages || messages.length === 0) {
      throw new ExternalAPIError('Gemini', 'At least one message is required', 400);
    }

    // COST OPTIMIZATION: Sliding window - only last N messages
    const recentMessages = messages.slice(-MAX_CHAT_HISTORY_MESSAGES);

    if (messages.length > MAX_CHAT_HISTORY_MESSAGES) {
      logger.debug(
        { originalCount: messages.length, truncatedCount: recentMessages.length },
        'General chat history window truncated to optimize costs'
      );
    }

    // Build multi-turn prompt with system prompt + conversation history
    const promptParts: string[] = [systemPrompt, '\n[HISTORIAL]'];
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        promptParts.push(`Usuario: ${msg.content}`);
      } else if (msg.role === 'assistant') {
        promptParts.push(`Asistente: ${msg.content}`);
      }
    }
    promptParts.push('\nResponde a la Ãºltima pregunta del usuario.');
    const prompt = promptParts.join('\n');
    const operation = await this.beginAiOperationRun({
      operationKey: GENERAL_CHAT_GROUNDING_OPERATION_KEY,
      model: GEMINI_ANALYSIS_MODEL,
      observability,
      prompt: {
        promptKey:
          this.normalizeObservabilityText(observability?.promptKey, 120) ??
          'GENERAL_CHAT_SYSTEM_PROMPT',
        version:
          this.normalizeObservabilityText(observability?.promptVersion, 40) ??
          GENERAL_CHAT_PROMPT_VERSION,
        template:
          this.normalizeObservabilityText(observability?.promptTemplate, 20000) ??
          GENERAL_CHAT_SYSTEM_PROMPT,
        sourceFile:
          this.normalizeObservabilityText(observability?.promptSourceFile, 260) ??
          GENERAL_CHAT_PROMPT_SOURCE_FILE,
      },
      metadata: {
        messagesCount: messages.length,
        recentMessagesCount: recentMessages.length,
      },
    });

    let tokenUsage: OperationTokenUsage = {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    };

    try {
      const generatedResponse = await this.executeWithRetry(async () => {
        logger.info(
          { messageCount: recentMessages.length },
          'Starting general chat with Google Search Grounding'
        );

        const result = await Sentry.startSpan(
          {
            name: 'gemini.general_chat',
            op: 'ai.chat',
            attributes: {
              'ai.model': GEMINI_ANALYSIS_MODEL,
              'ai.operation': GENERAL_CHAT_GROUNDING_OPERATION_KEY,
              'ai.grounding.enabled': true,
              'chat.message_count': recentMessages.length,
            },
          },
          async () => await this.chatModel.generateContent(prompt)
        );

        const response = result.response;
        const text = response.text().trim();

        const usageMetadata = response.usageMetadata;
        tokenUsage = this.resolveTokenUsage(usageMetadata);
        if (usageMetadata) {
          const promptTokens = tokenUsage.promptTokens ?? 0;
          const completionTokens = tokenUsage.completionTokens ?? 0;
          const totalTokens = tokenUsage.totalTokens ?? promptTokens + completionTokens;
          const costEstimated = this.taximeter.calculateCost(promptTokens, completionTokens);

          const activeSpan = Sentry.getActiveSpan();
          if (activeSpan) {
            activeSpan.setAttribute('ai.tokens.prompt', promptTokens);
            activeSpan.setAttribute('ai.tokens.completion', completionTokens);
            activeSpan.setAttribute('ai.tokens.total', totalTokens);
            activeSpan.setAttribute('ai.cost_eur', costEstimated);
          }

          // General chat usa grounding (Google Search), no bucket RAG.
          this.taximeter.logGroundingChat(
            '[GENERAL]',
            promptTokens,
            completionTokens,
            totalTokens,
            costEstimated
          );

          logger.debug(
            { promptTokens, completionTokens, totalTokens, costEUR: costEstimated },
            'General chat completed with token usage'
          );
        }

        if (!text) {
          throw new ExternalAPIError('Gemini', 'Empty response from general chat', 500);
        }

        return text;
      }, 3, 1000);

      await this.completeAiOperationRun({
        operation,
        tokens: tokenUsage,
        metadata: {
          messagesCount: messages.length,
          recentMessagesCount: recentMessages.length,
          tokenUsageAvailable: tokenUsage.totalTokens !== null,
        },
      });

      return generatedResponse;
    } catch (error) {
      const mappedError =
        error instanceof ExternalAPIError
          ? error
          : GeminiErrorMapper.toExternalAPIError(error);

      await this.failAiOperationRun({
        operation,
        error: mappedError,
        tokens: tokenUsage,
        metadata: {
          messagesCount: messages.length,
          recentMessagesCount: recentMessages.length,
          tokenUsageAvailable: tokenUsage.totalTokens !== null,
        },
      });

      throw mappedError;
    }
  }

  /**
   * Neutralize prompt injection patterns without altering article semantics.
   * IMPORTANT: Do not mutate article braces "{}".
   */
  private sanitizeInput(input: string): string {
    let sanitized = input
      .replace(/\r\n/g, '\n')
      .replace(/\u0000/g, '')
      // Keep <ARTICLE> delimiters safe even if present in the content itself.
      .replace(/<\/ARTICLE>/gi, '<\\/ARTICLE>')
      .replace(/<ARTICLE>/gi, '<ARTICLE_ESCAPED>');

    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[blocked_prompt_injection_pattern]');
    }

    return sanitized.replace(/\n{4,}/g, '\n\n\n').trim();
  }

  /**
   * Parse the JSON response from Gemini
   * Handles vNext analysis format with traceability and escalation fields
   * Includes optional token usage for cost tracking
   */
  private parseAnalysisResponse(
    text: string,
    tokenUsage?: TokenUsage,
    analyzedContent: string = '',
    analysisMode: AnalysisMode = 'low_cost'
  ): ArticleAnalysis {
    const cleanText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    let rawPayload: unknown;
    let usedParseFallback = false;

    if (!jsonMatch) {
      usedParseFallback = true;
      logger.warn(
        {
          reason: 'missing_json_block',
          responsePreview: cleanText.slice(0, 180),
          rawModelResponsePreview: text.slice(0, 180),
        },
        'Gemini response did not include JSON. Applying fallback payload.'
      );
      rawPayload = {
        summary: ANALYSIS_PARSE_FALLBACK_SUMMARY,
      };
    } else {
      try {
        rawPayload = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        usedParseFallback = true;
        logger.warn(
          {
            reason: 'invalid_json_syntax',
            responsePreview: jsonMatch[0].slice(0, 180),
            rawModelResponsePreview: text.slice(0, 180),
            parseError:
              parseError instanceof Error ? parseError.message : String(parseError),
          },
          'Gemini response contained malformed JSON. Applying fallback payload.'
        );
        rawPayload = {
          summary: ANALYSIS_PARSE_FALLBACK_SUMMARY,
        };
      }
    }

    try {
      const repairedPayload = this.repairAnalysisPayload(
        rawPayload,
        analyzedContent,
        analysisMode
      );
      const parsed = analysisResponseSchema.parse(
        repairedPayload
      ) as AnalysisResponsePayload;

      const internal_reasoning = typeof parsed.internal_reasoning === 'string'
        ? parsed.internal_reasoning
        : undefined;

      const category = typeof parsed.category === 'string'
        ? parsed.category
        : undefined;

      const parsedBiasRawCandidate = typeof parsed.biasRaw === 'number'
        ? parsed.biasRaw
        : typeof parsed.biasScore === 'number'
          ? parsed.biasScore
          : 0;
      const parsedBiasRaw = this.clampScore(parsedBiasRawCandidate, -10, 10, 0);
      const parsedBiasScoreNormalized = typeof parsed.biasScoreNormalized === 'number'
        ? this.clampScore(parsed.biasScoreNormalized, 0, 1, Math.abs(parsedBiasRaw) / 10)
        : Math.abs(parsedBiasRaw) / 10;

      const parsedBiasType = typeof parsed.analysis?.biasType === 'string'
        ? parsed.analysis.biasType
        : undefined;

      const explanation = typeof parsed.analysis?.explanation === 'string'
        ? parsed.analysis.explanation
        : undefined;
      const parsedBiasComment = this.normalizeShortComment(parsed.biasComment);
      const parsedArticleLeaning = this.normalizeArticleLeaning(
        parsed.articleLeaning ?? parsed.biasLeaning
      );

      const maxBiasIndicators = analysisMode === 'deep' ? 8 : 5;
      const maxClaims = analysisMode === 'deep' ? 10 : 5;
      const parsedBiasIndicators = this.normalizeStringArray(parsed.biasIndicators).slice(
        0,
        maxBiasIndicators
      );
      const citedBiasIndicators = this.extractQuotedBiasIndicators(
        parsedBiasIndicators,
        maxBiasIndicators
      );
      const hasCalibratedBiasSignals = this.hasThreeQuotedBiasIndicators(parsedBiasIndicators);
      const biasRaw = hasCalibratedBiasSignals ? parsedBiasRaw : 0;
      const biasScoreNormalized = hasCalibratedBiasSignals ? parsedBiasScoreNormalized : 0;
      const biasType = hasCalibratedBiasSignals ? (parsedBiasType ?? 'ninguno') : 'ninguno';
      const biasIndicators = citedBiasIndicators;
      const articleLeaning = hasCalibratedBiasSignals
        ? (parsedArticleLeaning ?? 'indeterminada')
        : 'indeterminada';
      const biasComment = hasCalibratedBiasSignals
        ? parsedBiasComment
        : 'No hay suficientes indicios textuales citados para inferir una tendencia ideologica y, con esta evidencia interna, el sesgo queda indeterminado.';

      let reliabilityScore = this.clampScore(parsed.reliabilityScore, 0, 100, 50);
      let traceabilityScore = this.clampScore(
        parsed.traceabilityScore,
        0,
        100,
        reliabilityScore
      );

      const calibratedScores = this.calibrateEvidenceScores(
        analyzedContent,
        reliabilityScore,
        traceabilityScore
      );
      reliabilityScore = calibratedScores.reliabilityScore;
      traceabilityScore = calibratedScores.traceabilityScore;

      const factualityStatus: FactualityStatus =
        parsed.factualityStatus ?? 'no_determinable';
      const evidence_needed = this.normalizeStringArray(parsed.evidence_needed).slice(0, 4);
      const reliabilityComment = this.normalizeShortComment(parsed.reliabilityComment);

      const clickbaitScore = this.clampScore(parsed.clickbaitScore, 0, 100, 0);
      const sentiment = this.normalizeSentiment(parsed.sentiment);

      const mainTopics = this.normalizeStringArray(
        Array.isArray(parsed.suggestedTopics)
          ? parsed.suggestedTopics
          : parsed.mainTopics
      ).slice(0, 3);

      const claims = this.normalizeStringArray(parsed.factCheck?.claims).slice(0, maxClaims);
      const verdict =
        claims.length === 0
          ? 'InsufficientEvidenceInArticle'
          : this.validateVerdict(parsed.factCheck?.verdict);
      const factCheck = {
        claims,
        verdict,
        reasoning: typeof parsed.factCheck?.reasoning === 'string'
          ? parsed.factCheck.reasoning
          : 'Sin informacion suficiente para verificar',
      };

      const should_escalate = typeof parsed.should_escalate === 'boolean'
        ? parsed.should_escalate
        : this.computeEscalation({
            claims,
            summary: parsed.summary,
            reliabilityScore,
            traceabilityScore,
            clickbaitScore,
          });
      const forcedLowCostEscalation =
        analysisMode === 'low_cost' &&
        this.hasStrongClaimsWithoutAttribution({
          claims,
          summary: parsed.summary,
          content: analyzedContent,
        });
      const deepSections = this.normalizeDeepSections(parsed.deep?.sections, maxClaims);
      const formatError =
        usedParseFallback || parsed.summary.trim() === ANALYSIS_PARSE_FALLBACK_SUMMARY;

      return {
        internal_reasoning,
        formatError,
        summary: parsed.summary,
        category,
        biasScore: biasScoreNormalized,
        biasRaw,
        biasScoreNormalized,
        biasType,
        biasIndicators,
        biasComment,
        articleLeaning,
        biasLeaning: this.toLegacyBiasLeaning(articleLeaning),
        analysisModeUsed: analysisMode,
        clickbaitScore,
        reliabilityScore,
        traceabilityScore,
        factualityStatus,
        evidence_needed,
        reliabilityComment,
        should_escalate: should_escalate || forcedLowCostEscalation,
        sentiment,
        mainTopics,
        factCheck,
        explanation,
        ...(!formatError && (analysisMode === 'deep' || deepSections)
          ? {
              deep: {
                sections: deepSections ?? {
                  known: [],
                  unknown: [],
                  quotes: [],
                  risks: [],
                },
              },
            }
          : {}),
        ...(tokenUsage && { usage: tokenUsage }),
      };
    } catch (error) {
      throw new ExternalAPIError(
        'Gemini',
        `Failed to parse analysis response: ${(error as Error).message}`,
        500
      );
    }
  }

  private async tryJsonRepair(
    rawModelResponse: string,
    observability?: AIObservabilityContext
  ): Promise<string | null> {
    const trimmed = rawModelResponse?.trim();
    if (!trimmed) {
      return null;
    }

    const safeInput =
      trimmed.length > MAX_JSON_REPAIR_INPUT_CHARS
        ? trimmed.slice(0, MAX_JSON_REPAIR_INPUT_CHARS)
        : trimmed;
    const repairPrompt = `${JSON_REPAIR_PROMPT}\n\nRAW_RESPONSE:\n${safeInput}`;
    const operation = await this.beginAiOperationRun({
      operationKey: JSON_REPAIR_OPERATION_KEY,
      model: GEMINI_ANALYSIS_MODEL,
      observability,
      prompt: {
        promptKey: JSON_REPAIR_PROMPT_KEY,
        version: JSON_REPAIR_PROMPT_VERSION,
        template: JSON_REPAIR_PROMPT,
        sourceFile: JSON_REPAIR_PROMPT_SOURCE_FILE,
      },
      metadata: {
        inputLength: safeInput.length,
        wasInputTruncated: trimmed.length > MAX_JSON_REPAIR_INPUT_CHARS,
      },
    });
    let tokenUsage: OperationTokenUsage = {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    };

    try {
      const repairedText = await this.executeWithRetry(async () => {
        const repairResult = await this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: repairPrompt }] }],
          generationConfig: {
            maxOutputTokens: 1200,
          },
        });

        tokenUsage = this.resolveTokenUsage(repairResult.response.usageMetadata);
        return repairResult.response.text().trim();
      }, 2, 500);

      if (!repairedText) {
        await this.completeAiOperationRun({
          operation,
          tokens: tokenUsage,
          metadata: {
            inputLength: safeInput.length,
            repaired: false,
            tokenUsageAvailable: tokenUsage.totalTokens !== null,
          },
        });
        return null;
      }

      await this.completeAiOperationRun({
        operation,
        tokens: tokenUsage,
        metadata: {
          inputLength: safeInput.length,
          repaired: true,
          outputLength: repairedText.length,
          tokenUsageAvailable: tokenUsage.totalTokens !== null,
        },
      });

      logger.info(
        { repairResponseLength: repairedText.length },
        'JSON repair attempt completed'
      );
      return repairedText;
    } catch (error) {
      const mappedError =
        error instanceof ExternalAPIError
          ? error
          : GeminiErrorMapper.toExternalAPIError(error);

      await this.failAiOperationRun({
        operation,
        error: mappedError,
        tokens: tokenUsage,
        metadata: {
          inputLength: safeInput.length,
          tokenUsageAvailable: tokenUsage.totalTokens !== null,
        },
      });

      logger.warn(
        {
          error: mappedError.message,
        },
        'JSON repair request failed'
      );
      return null;
    }
  }

  private repairAnalysisPayload(
    payload: unknown,
    analyzedContent: string,
    analysisMode: AnalysisMode
  ): Record<string, unknown> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {
        summary: this.buildFallbackSummary(analyzedContent),
      };
    }

    const candidate = { ...(payload as Record<string, unknown>) };
    const repairedSummary = this.coerceValueToString(candidate.summary, [
      'summary',
      'text',
      'content',
    ]);
    const hasMissingSummary = !repairedSummary;

    if (hasMissingSummary) {
      candidate.summary = this.buildFallbackSummary(analyzedContent);
      logger.warn(
        {
          reason: 'missing_summary',
          contentLength: analyzedContent.length,
        },
        'Gemini response repaired before schema validation'
      );
    } else {
      candidate.summary = repairedSummary;
    }

    const maxBiasIndicators = analysisMode === 'deep' ? 8 : 5;
    const maxClaims = analysisMode === 'deep' ? 10 : 5;

    candidate.biasIndicators = this.coerceStringArray(
      candidate.biasIndicators,
      ['indicator', 'text', 'quote', 'citation', 'evidence'],
      maxBiasIndicators
    );
    candidate.evidence_needed = this.coerceStringArray(
      candidate.evidence_needed,
      ['evidence', 'need', 'text', 'item', 'value'],
      4
    );

    const factCheckRaw = candidate.factCheck;
    if (factCheckRaw && typeof factCheckRaw === 'object' && !Array.isArray(factCheckRaw)) {
      const factCheckCandidate = {
        ...(factCheckRaw as Record<string, unknown>),
      };
      factCheckCandidate.claims = this.coerceStringArray(
        factCheckCandidate.claims,
        ['claim', 'text', 'statement', 'quote', 'value'],
        maxClaims
      );

      if (typeof factCheckCandidate.reasoning !== 'string') {
        const coercedReasoning = this.coerceValueToString(factCheckCandidate.reasoning, [
          'reasoning',
          'text',
          'explanation',
          'details',
        ]);
        if (coercedReasoning) {
          factCheckCandidate.reasoning = coercedReasoning;
        }
      }

      candidate.factCheck = factCheckCandidate;
    }

    const deepRaw = candidate.deep;
    if (deepRaw && typeof deepRaw === 'object' && !Array.isArray(deepRaw)) {
      const deepCandidate = { ...(deepRaw as Record<string, unknown>) };
      const sectionsRaw = deepCandidate.sections;
      if (sectionsRaw && typeof sectionsRaw === 'object' && !Array.isArray(sectionsRaw)) {
        const sectionsCandidate = { ...(sectionsRaw as Record<string, unknown>) };
        sectionsCandidate.known = this.coerceStringArray(
          sectionsCandidate.known,
          ['text', 'value', 'item'],
          10
        );
        sectionsCandidate.unknown = this.coerceStringArray(
          sectionsCandidate.unknown,
          ['text', 'value', 'item'],
          10
        );
        sectionsCandidate.quotes = this.coerceStringArray(
          sectionsCandidate.quotes,
          ['text', 'quote', 'value'],
          4
        );
        sectionsCandidate.risks = this.coerceStringArray(
          sectionsCandidate.risks,
          ['text', 'value', 'item'],
          4
        );
        deepCandidate.sections = sectionsCandidate;
      }
      candidate.deep = deepCandidate;
    }

    for (const boundedField of ['biasComment', 'reliabilityComment'] as const) {
      const value = candidate[boundedField];
      if (typeof value === 'string' && value.trim().length > 220) {
        candidate[boundedField] = `${value.trim().slice(0, 217).trimEnd()}...`;
      }
    }

    return candidate;
  }

  private buildFallbackSummary(content: string): string {
    const withoutFallbackHeader = content.replace(
      /^ADVERTENCIA:[\s\S]*?\n\n/i,
      ''
    );
    const compact = withoutFallbackHeader.replace(/\s+/g, ' ').trim();
    if (!compact) {
      return 'No hay texto suficiente para resumir con el extracto disponible.';
    }
    const words = compact.split(/\s+/).filter(Boolean);
    const isLowQualityInput = compact.length < 300;
    const maxWords = isLowQualityInput ? 45 : 90;
    const limited = words.slice(0, maxWords).join(' ').trim();
    return limited;
  }

  private coerceStringArray(
    value: unknown,
    preferredKeys: string[] = [],
    maxItems: number = Number.POSITIVE_INFINITY
  ): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const normalizedItems: string[] = [];

    for (const entry of value) {
      const coerced = this.coerceValueToString(entry, preferredKeys);
      if (!coerced) {
        continue;
      }

      normalizedItems.push(coerced);
      if (normalizedItems.length >= maxItems) {
        break;
      }
    }

    return normalizedItems;
  }

  private coerceValueToString(
    value: unknown,
    preferredKeys: string[] = []
  ): string | undefined {
    if (typeof value === 'string') {
      const normalized = value.replace(/\s+/g, ' ').trim();
      return normalized.length > 0 ? normalized : undefined;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    const record = value as Record<string, unknown>;
    for (const key of preferredKeys) {
      const nested = record[key];
      if (typeof nested === 'string' && nested.trim().length > 0) {
        return nested.replace(/\s+/g, ' ').trim();
      }
    }

    for (const nested of Object.values(record)) {
      if (typeof nested === 'string' && nested.trim().length > 0) {
        return nested.replace(/\s+/g, ' ').trim();
      }
    }

    try {
      const serialized = JSON.stringify(value);
      if (!serialized) {
        return undefined;
      }
      return serialized.length <= 280
        ? serialized
        : `${serialized.slice(0, 277).trimEnd()}...`;
    } catch {
      return undefined;
    }
  }

  private clampScore(
    value: number | undefined,
    min: number,
    max: number,
    fallback: number
  ): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, value));
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  private normalizeShortComment(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return undefined;
    }

    if (normalized.length <= 220) {
      return normalized;
    }

    return `${normalized.slice(0, 217).trimEnd()}...`;
  }

  private normalizeArticleLeaning(value: unknown): ArticleLeaning | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    const validValues: ArticleLeaning[] = [
      'progresista',
      'conservadora',
      'extremista',
      'neutral',
      'indeterminada',
    ];

    if ((validValues as string[]).includes(normalized)) {
      return normalized as ArticleLeaning;
    }

    if (normalized === 'otra') {
      return 'indeterminada';
    }

    return undefined;
  }

  private toLegacyBiasLeaning(value: ArticleLeaning): LegacyBiasLeaning {
    if (value === 'extremista') {
      return 'otra';
    }

    return value;
  }

  private normalizeSentiment(raw: unknown): 'positive' | 'negative' | 'neutral' {
    const sentimentRaw = String(raw || 'neutral').toLowerCase();
    if (['positive', 'negative', 'neutral'].includes(sentimentRaw)) {
      return sentimentRaw as 'positive' | 'negative' | 'neutral';
    }
    return 'neutral';
  }

  private calibrateEvidenceScores(
    content: string,
    reliabilityScore: number,
    traceabilityScore: number
  ): { reliabilityScore: number; traceabilityScore: number } {
    if (!content || content.trim().length === 0) {
      return {
        reliabilityScore: Math.round(reliabilityScore),
        traceabilityScore: Math.round(traceabilityScore),
      };
    }

    const attributionMatches =
      content.match(
        /\b(seg[uú]n|according to|de acuerdo con|afirm[oó]|inform[oó]|report[oó]|dijo|stated|reported|ministerio|universidad|instituto)\b/gi
      ) ?? [];
    const linkMatches = content.match(/\bhttps?:\/\/\S+|\bwww\.\S+/gi) ?? [];
    const quoteMarks = content.match(/["“”]/g) ?? [];
    const quotePairs = Math.floor(quoteMarks.length / 2);
    const figureMatches =
      content.match(/\b\d+(?:[.,]\d+)?\s?(?:%|millones|miles|euros|d[oó]lares|USD|EUR|años|dias|years|deaths?)\b/gi) ??
      [];
    const vagueMatches =
      content.match(/\b(algunos|muchos|se dice|fuentes cercanas|experts say|sources say|everyone knows|todos lo saben)\b/gi) ??
      [];
    const clickbaitMatches =
      content.match(/\b(URGENTE|NO CREER[ÁA]S|ESC[ÁA]NDALO|BOMBAZO|IMPACTANTE|SHOCKING|BREAKING)\b|!{2,}/gi) ?? [];

    const positiveScore =
      Math.min(attributionMatches.length, 4) * 16 +
      Math.min(linkMatches.length, 3) * 24 +
      Math.min(quotePairs, 4) * 10 +
      Math.min(figureMatches.length, 4) * 12;

    const negativeScore =
      Math.min(vagueMatches.length, 4) * 18 +
      Math.min(clickbaitMatches.length, 4) * 26;

    const heuristicTraceability = this.clampScore(
      18 + positiveScore - negativeScore,
      0,
      100,
      50
    );

    const heuristicReliability = this.clampScore(
      15 + positiveScore - negativeScore - Math.min(clickbaitMatches.length, 4) * 4,
      0,
      100,
      50
    );

    const modelWeight = 0.4;
    const heuristicWeight = 0.6;

    return {
      reliabilityScore: Math.round(
        this.clampScore(
          reliabilityScore * modelWeight + heuristicReliability * heuristicWeight,
          0,
          100,
          reliabilityScore
        )
      ),
      traceabilityScore: Math.round(
        this.clampScore(
          traceabilityScore * modelWeight + heuristicTraceability * heuristicWeight,
          0,
          100,
          traceabilityScore
        )
      ),
    };
  }

  private hasThreeQuotedBiasIndicators(indicators: string[]): boolean {
    return this.extractQuotedBiasIndicators(indicators).length >= 3;
  }

  private extractQuotedBiasIndicators(indicators: string[], maxItems: number = 5): string[] {
    const citationPattern = /["'`][^"'`]{3,140}["'`]|\([^()]{3,120}\)|\[[^\[\]]{3,120}\]/;
    return indicators.filter((indicator) => citationPattern.test(indicator)).slice(0, maxItems);
  }

  private normalizeAnalysisMode(value: unknown): AnalysisMode {
    if (value === 'moderate' || value === 'standard' || value === 'low_cost' || value === 'deep') {
      return value;
    }

    // Default by design: low-cost in bulk/list contexts.
    return 'low_cost';
  }

  private resolveAnalysisMode(
    requestedMode: AnalysisMode,
    content: string
  ): AnalysisMode {
    if (requestedMode === 'deep') {
      return 'deep';
    }

    if (this.shouldUseLowCostPrompt(content)) {
      return 'low_cost';
    }

    return requestedMode;
  }

  private getAnalysisPromptDescriptor(mode: AnalysisMode): {
    name: string;
    template: string;
  } {
    switch (mode) {
      case 'deep':
        return {
          name: 'ANALYSIS_PROMPT_DEEP',
          template: ANALYSIS_PROMPT_DEEP,
        };
      case 'moderate':
        return {
          name: 'ANALYSIS_PROMPT_MODERATE',
          template: ANALYSIS_PROMPT_MODERATE,
        };
      case 'standard':
        return {
          name: 'ANALYSIS_PROMPT',
          template: ANALYSIS_PROMPT,
        };
      case 'low_cost':
      default:
        return {
          name: 'ANALYSIS_PROMPT_LOW_COST',
          template: ANALYSIS_PROMPT_LOW_COST,
        };
    }
  }

  private populateAnalysisPrompt(
    template: string,
    variables: {
      title: string;
      source: string;
      content: string;
      inputQuality: 'full' | 'snippet_rss' | 'paywall_o_vacio' | 'unknown';
      contentChars: number;
      textSource: string;
    }
  ): string {
    return template
      .replace(/{title}/g, variables.title)
      .replace(/{source}/g, variables.source)
      .replace(/{content}/g, variables.content)
      .replace(/{inputQuality}/g, variables.inputQuality)
      .replace(/{contentChars}/g, String(variables.contentChars))
      .replace(/{textSource}/g, variables.textSource);
  }

  private normalizeInputQuality(
    inputQuality: AnalyzeContentInput['inputQuality'],
    contentLength: number
  ): 'full' | 'snippet_rss' | 'paywall_o_vacio' | 'unknown' {
    if (
      inputQuality === 'full' ||
      inputQuality === 'snippet_rss' ||
      inputQuality === 'paywall_o_vacio' ||
      inputQuality === 'unknown'
    ) {
      return inputQuality;
    }

    if (contentLength >= AUTO_LOW_COST_CONTENT_THRESHOLD) {
      return 'full';
    }

    if (contentLength > 0) {
      return 'paywall_o_vacio';
    }

    return 'unknown';
  }

  private normalizeTextSource(textSource: unknown): string {
    if (typeof textSource !== 'string') {
      return 'unknown';
    }

    const compact = textSource.trim();
    return compact.length > 0 ? compact.slice(0, 60) : 'unknown';
  }

  private getMaxOutputTokensForMode(mode: AnalysisMode): number {
    switch (mode) {
      case 'deep':
        return 2200;
      case 'standard':
        return 1600;
      case 'moderate':
        return 1300;
      case 'low_cost':
      default:
        return 1000;
    }
  }

  private normalizeDeepSections(
    sections: unknown,
    maxClaims: number
  ):
    | {
        known: string[];
        unknown: string[];
        quotes: string[];
        risks: string[];
      }
    | undefined {
    if (!sections || typeof sections !== 'object') {
      return undefined;
    }

    const known = this.normalizeStringArray((sections as Record<string, unknown>).known).slice(
      0,
      Math.max(6, maxClaims)
    );
    const unknown = this.normalizeStringArray((sections as Record<string, unknown>).unknown).slice(
      0,
      10
    );
    const quotes = this.normalizeStringArray((sections as Record<string, unknown>).quotes)
      .map((quote) => this.limitWords(quote, 24))
      .slice(0, 4);
    const risks = this.normalizeStringArray((sections as Record<string, unknown>).risks).slice(0, 4);

    return {
      known,
      unknown,
      quotes,
      risks,
    };
  }

  private limitWords(text: string, maxWords: number): string {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) {
      return text.trim();
    }

    return words.slice(0, maxWords).join(' ').trim();
  }

  private shouldUseLowCostPrompt(content: string): boolean {
    if (content.length < AUTO_LOW_COST_CONTENT_THRESHOLD) {
      return true;
    }

    return /no\s+se\s+pudo\s+acceder\s+al\s+art[ií]culo\s+completo/i.test(content);
  }

  private selectContentForAnalysis(content: string): string {
    if (content.length <= MAX_ARTICLE_CONTENT_LENGTH) {
      return content;
    }

    const head = content.slice(0, ANALYSIS_HEAD_CHARS).trim();
    const tail = content.slice(-ANALYSIS_TAIL_CHARS).trim();
    const quotesAndData = this.extractQuoteAndDataSnippets(content, ANALYSIS_QUOTES_DATA_CHARS);

    const selection = [
      '[META]',
      `original_length_chars=${content.length}`,
      `selection=HEAD(${ANALYSIS_HEAD_CHARS})+TAIL(${ANALYSIS_TAIL_CHARS})+QUOTES_DATA(${ANALYSIS_QUOTES_DATA_CHARS})`,
      '',
      '[HEAD]',
      head,
      '',
      '[TAIL]',
      tail,
      '',
      '[QUOTES_DATA]',
      quotesAndData,
    ].join('\n');

    return selection.substring(0, MAX_ARTICLE_CONTENT_LENGTH).trim();
  }

  private extractQuoteAndDataSnippets(content: string, maxChars: number): string {
    const snippetPattern =
      /(^|\n)([^.\n]{0,120}(?:"[^"\n]{3,120}"|'[^'\n]{3,120}'|\bhttps?:\/\/\S+|\b\d+(?:[.,]\d+)?\s?(?:%|USD|EUR|\$|millones|miles|years|anos|casos|personas|deaths?)\b)[^.\n]{0,120}(?:[.\n]|$))/gim;

    const snippets: string[] = [];
    const seen = new Set<string>();
    let totalChars = 0;

    for (const match of content.matchAll(snippetPattern)) {
      const snippet = (match[2] ?? '').replace(/\s+/g, ' ').trim();
      if (snippet.length < 20) {
        continue;
      }

      const key = snippet.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      const projected = totalChars + snippet.length + 1;
      if (projected > maxChars) {
        break;
      }

      snippets.push(snippet);
      seen.add(key);
      totalChars = projected;
    }

    if (snippets.length === 0) {
      return content.slice(0, Math.min(400, maxChars)).trim();
    }

    return snippets.join('\n');
  }

  private computeEscalation(params: {
    claims: string[];
    summary: string;
    reliabilityScore: number;
    traceabilityScore: number;
    clickbaitScore: number;
  }): boolean {
    const allClaims = [...params.claims, params.summary].join(' ');
    const hasHighRiskClaim = HIGH_RISK_CLAIM_PATTERNS.some((pattern) =>
      pattern.test(allClaims)
    );
    const hasStrongClaim =
      /\b(siempre|nunca|todo esta|todo está|demuestra|100%|sin duda|definitivo)\b/i.test(
        allClaims
      ) || hasHighRiskClaim;

    const veryLowTraceability =
      params.traceabilityScore <= 35 && params.reliabilityScore <= 50;
    const hasAnyClaim = params.claims.length > 0;
    const extremeClickbait = params.clickbaitScore >= 70;

    return (
      hasHighRiskClaim ||
      extremeClickbait ||
      (veryLowTraceability && (hasStrongClaim || hasAnyClaim))
    );
  }

  private hasStrongClaimsWithoutAttribution(params: {
    claims: string[];
    summary: string;
    content: string;
  }): boolean {
    const claimsText = [...params.claims, params.summary].join(' ');
    const hasHighRiskClaim = HIGH_RISK_CLAIM_PATTERNS.some((pattern) =>
      pattern.test(claimsText)
    );
    const hasStrongClaim =
      hasHighRiskClaim ||
      /\b(siempre|nunca|todo esta|todo está|demuestra|100%|sin duda|definitivo|urgente|esc[áa]ndalo|bomba|inminente)\b/i.test(
        claimsText
      );
    if (!hasStrongClaim) {
      return false;
    }

    const hasAttribution = /\b(seg[uú]n|according to|de acuerdo con|afirm[oó]|inform[oó]|report[oó]|ministerio|universidad|instituto|documento|informe)\b|https?:\/\/\S+|www\.\S+/i.test(
      params.content
    );
    return !hasAttribution;
  }

  private async beginAiOperationRun(params: {
    operationKey: string;
    model: string;
    observability?: AIObservabilityContext;
    prompt?: PromptRegistrationConfig;
    metadata?: Record<string, unknown>;
  }): Promise<AiOperationRunContext> {
    const normalizedContext = this.normalizeObservabilityContext(params.observability);
    const operationKey =
      this.normalizeObservabilityText(params.observability?.operationKey, 80) ??
      params.operationKey;

    const promptConfig = this.resolvePromptConfig(params.prompt, params.observability);
    const promptVersionId = await this.registerPromptVersionForOperation({
      operationKey,
      model: params.model,
      prompt: promptConfig,
      metadata: params.metadata,
    });

    let runId: string | null = null;

    if (this.aiObservabilityService) {
      try {
        runId = await this.aiObservabilityService.startRun({
          module: VERITY_MODULE,
          operationKey,
          provider: GEMINI_PROVIDER,
          model: params.model,
          status: AiRunStatus.PENDING,
          promptVersionId,
          requestId: normalizedContext.requestId,
          correlationId: normalizedContext.correlationId,
          endpoint: normalizedContext.endpoint,
          userId: normalizedContext.userId,
          entityType: normalizedContext.entityType,
          entityId: normalizedContext.entityId,
          metadataJson: {
            ...normalizedContext.metadata,
            ...params.metadata,
            ...(promptConfig
              ? {
                  promptKey: promptConfig.promptKey,
                  promptVersion: promptConfig.version,
                }
              : {}),
          },
        });
      } catch (error) {
        logger.warn(
          {
            operationKey,
            error: error instanceof Error ? error.message : String(error),
          },
          'Could not persist initial AI operation run'
        );
      }
    }

    return {
      context: normalizedContext,
      operationKey,
      provider: GEMINI_PROVIDER,
      model: params.model,
      promptVersionId,
      promptKey: promptConfig?.promptKey,
      promptVersion: promptConfig?.version,
      runId,
      startedAt: Date.now(),
    };
  }

  private async completeAiOperationRun(params: {
    operation: AiOperationRunContext;
    tokens: OperationTokenUsage;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!params.operation.runId || !this.aiObservabilityService) {
      return;
    }

    const estimatedCostMicrosEur = await this.estimateRunCostMicrosEur({
      provider: params.operation.provider,
      model: params.operation.model,
      promptTokens: params.tokens.promptTokens,
      completionTokens: params.tokens.completionTokens,
    });

    await this.aiObservabilityService.completeRun({
      runId: params.operation.runId,
      status: AiRunStatus.COMPLETED,
      promptTokens: params.tokens.promptTokens,
      completionTokens: params.tokens.completionTokens,
      totalTokens: params.tokens.totalTokens,
      estimatedCostMicrosEur,
      latencyMs: Date.now() - params.operation.startedAt,
      metadataJson: {
        ...params.operation.context.metadata,
        ...params.metadata,
        ...(params.operation.promptKey
          ? {
              promptKey: params.operation.promptKey,
              promptVersion: params.operation.promptVersion,
            }
          : {}),
      },
    });
  }

  private async failAiOperationRun(params: {
    operation: AiOperationRunContext;
    error: ExternalAPIError;
    tokens: OperationTokenUsage;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!params.operation.runId || !this.aiObservabilityService) {
      return;
    }

    const estimatedCostMicrosEur = await this.estimateRunCostMicrosEur({
      provider: params.operation.provider,
      model: params.operation.model,
      promptTokens: params.tokens.promptTokens,
      completionTokens: params.tokens.completionTokens,
    });

    await this.aiObservabilityService.failRun({
      runId: params.operation.runId,
      status: this.mapErrorToAiRunStatus(params.error),
      errorCode: String(params.error.statusCode ?? 'UNKNOWN'),
      errorMessage: params.error.message,
      promptTokens: params.tokens.promptTokens,
      completionTokens: params.tokens.completionTokens,
      totalTokens: params.tokens.totalTokens,
      estimatedCostMicrosEur,
      latencyMs: Date.now() - params.operation.startedAt,
      metadataJson: {
        ...params.operation.context.metadata,
        ...params.metadata,
        ...(params.operation.promptKey
          ? {
              promptKey: params.operation.promptKey,
              promptVersion: params.operation.promptVersion,
            }
          : {}),
      },
    });
  }

  private resolvePromptConfig(
    defaultPrompt: PromptRegistrationConfig | undefined,
    observability: AIObservabilityContext | undefined
  ): PromptRegistrationConfig | undefined {
    const promptKey =
      this.normalizeObservabilityText(observability?.promptKey, 120) ??
      defaultPrompt?.promptKey;
    const version =
      this.normalizeObservabilityText(observability?.promptVersion, 40) ??
      defaultPrompt?.version;
    const template =
      this.normalizeObservabilityText(observability?.promptTemplate, 20000) ??
      defaultPrompt?.template;
    const sourceFile =
      this.normalizeObservabilityText(observability?.promptSourceFile, 260) ??
      defaultPrompt?.sourceFile;

    if (!promptKey || !version || !template || !sourceFile) {
      return undefined;
    }

    return {
      promptKey,
      version,
      template,
      sourceFile,
    };
  }

  private async registerPromptVersionForOperation(params: {
    operationKey: string;
    model: string;
    prompt?: PromptRegistrationConfig;
    metadata?: Record<string, unknown>;
  }): Promise<string | null> {
    if (!this.promptRegistryService || !params.prompt) {
      return null;
    }

    try {
      const registeredPromptVersion =
        await this.promptRegistryService.registerPromptVersion({
          module: VERITY_MODULE,
          promptKey: params.prompt.promptKey,
          version: params.prompt.version,
          template: params.prompt.template,
          sourceFile: params.prompt.sourceFile,
          metadata: {
            operationKey: params.operationKey,
            provider: GEMINI_PROVIDER,
            model: params.model,
            ...params.metadata,
          },
        });

      return registeredPromptVersion.id;
    } catch (error) {
      logger.warn(
        {
          operationKey: params.operationKey,
          promptKey: params.prompt.promptKey,
          error: error instanceof Error ? error.message : String(error),
        },
        'Could not register prompt version for AI observability'
      );
      return null;
    }
  }

  private resolveTokenUsage(usageMetadata: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  } | null | undefined): OperationTokenUsage {
    if (!usageMetadata) {
      return {
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      };
    }

    const promptTokens = usageMetadata.promptTokenCount ?? 0;
    const completionTokens = usageMetadata.candidatesTokenCount ?? 0;
    const totalTokens = usageMetadata.totalTokenCount ?? promptTokens + completionTokens;

    return {
      promptTokens,
      completionTokens,
      totalTokens,
    };
  }

  private async registerPromptVersion(params: {
    promptDescriptorName: string;
    promptTemplate: string;
    analysisMode: AnalysisMode;
  }): Promise<string | null> {
    if (!this.promptRegistryService) {
      return null;
    }

    try {
      const registeredPromptVersion = await this.promptRegistryService.registerPromptVersion({
        module: VERITY_MODULE,
        promptKey: params.promptDescriptorName,
        version: ANALYSIS_PROMPT_VERSION,
        template: params.promptTemplate,
        sourceFile: ANALYSIS_PROMPT_SOURCE_FILE,
        metadata: {
          operationKey: ARTICLE_ANALYSIS_OPERATION_KEY,
          provider: GEMINI_PROVIDER,
          model: GEMINI_ANALYSIS_MODEL,
          analysisMode: params.analysisMode,
        },
      });

      return registeredPromptVersion.id;
    } catch (error) {
      logger.warn(
        {
          promptKey: params.promptDescriptorName,
          error: error instanceof Error ? error.message : String(error),
        },
        'Could not register prompt version for AI observability'
      );
      return null;
    }
  }

  private normalizeObservabilityContext(
    context: AIObservabilityContext | undefined
  ): NormalizedAiObservabilityContext {
    const requestId = this.normalizeObservabilityId(context?.requestId);
    const correlationId =
      this.normalizeObservabilityText(context?.correlationId, 120) ?? requestId;
    const endpoint = this.normalizeObservabilityText(context?.endpoint, 120);
    const userId = this.normalizeObservabilityText(context?.userId, 80);
    const entityType = this.normalizeObservabilityText(context?.entityType, 80);
    const entityId = this.normalizeObservabilityText(context?.entityId, 120);
    const metadata =
      context?.metadata &&
      typeof context.metadata === 'object' &&
      !Array.isArray(context.metadata)
        ? context.metadata
        : undefined;

    return {
      requestId,
      correlationId,
      endpoint,
      userId,
      entityType,
      entityId,
      metadata,
    };
  }

  private normalizeObservabilityId(value: string | undefined): string {
    const normalized = this.normalizeObservabilityText(value, 120);
    if (normalized) {
      return normalized;
    }

    return `ai_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private normalizeObservabilityText(
    value: string | undefined,
    maxLength: number
  ): string | undefined {
    if (!value || typeof value !== 'string') {
      return undefined;
    }

    const compact = value.replace(/\s+/g, ' ').trim();
    if (!compact) {
      return undefined;
    }

    return compact.slice(0, maxLength);
  }

  private async estimateRunCostMicrosEur(params: {
    provider: string;
    model: string;
    promptTokens: number | null;
    completionTokens: number | null;
  }): Promise<bigint | null> {
    if (!this.tokenAndCostService) {
      return null;
    }

    try {
      const estimate = await this.tokenAndCostService.estimateCostMicrosEur({
        provider: params.provider,
        model: params.model,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
      });
      return estimate.estimatedCostMicrosEur;
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Could not estimate AI operation cost in micros EUR'
      );
      return null;
    }
  }

  private mapErrorToAiRunStatus(error: ExternalAPIError): AiRunStatus {
    const errorMessage = error.message.toLowerCase();

    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('etimedout') ||
      errorMessage.includes('gateway timeout') ||
      error.statusCode === 504
    ) {
      return AiRunStatus.TIMEOUT;
    }

    if (errorMessage.includes('cancel') || errorMessage.includes('aborted')) {
      return AiRunStatus.CANCELLED;
    }

    return AiRunStatus.FAILED;
  }

  /**
   * Validate and normalize factCheck verdict
   */
  private validateVerdict(verdict: unknown): FactCheckVerdict {
    if (typeof verdict !== 'string') {
      return 'InsufficientEvidenceInArticle';
    }

    const trimmed = verdict.trim();
    const validVerdicts: FactCheckVerdict[] = [
      'SupportedByArticle',
      'NotSupportedByArticle',
      'InsufficientEvidenceInArticle',
    ];
    if ((validVerdicts as string[]).includes(trimmed)) {
      return trimmed as FactCheckVerdict;
    }

    switch (trimmed) {
      case 'Verified':
        return 'SupportedByArticle';
      case 'False':
        return 'NotSupportedByArticle';
      case 'Mixed':
      case 'Unproven':
      default:
        return 'InsufficientEvidenceInArticle';
    }
  }

  /**
   * Auto-discover RSS URL for a given media name
   * 
   * FEATURE: RSS AUTO-DISCOVERY (Sprint 9)
   * Usa Gemini para encontrar la URL del feed RSS oficial de un medio dado.
   * 
   * @param mediaName Nombre del medio (e.g., "El PaÃ­s", "BBC News")
   * @returns URL del RSS si se encuentra, null si no existe o no se puede determinar
   */
  async discoverRssUrl(
    mediaName: string,
    observability?: AIObservabilityContext
  ): Promise<string | null> {
    logger.info(
      { mediaLength: mediaName.length },
      'Starting RSS URL discovery'
    );

    // COST OPTIMIZATION: Prompt extraÃ­do a mÃ³dulo centralizado
    const prompt = buildRssDiscoveryPrompt(mediaName);
    const operation = await this.beginAiOperationRun({
      operationKey: RSS_DISCOVERY_OPERATION_KEY,
      model: GEMINI_ANALYSIS_MODEL,
      observability,
      prompt: {
        promptKey: 'RSS_DISCOVERY_PROMPT',
        version: RSS_DISCOVERY_PROMPT_VERSION,
        template: RSS_DISCOVERY_PROMPT_TEMPLATE,
        sourceFile: RSS_DISCOVERY_PROMPT_SOURCE_FILE,
      },
      metadata: {
        mediaNameLength: mediaName.length,
      },
    });
    let tokenUsage: OperationTokenUsage = {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    };

    try {
      // RESILIENCIA: executeWithRetry maneja reintentos automÃ¡ticos
      const result = await this.executeWithRetry(async () => {
        // ðŸ” Sprint 15 - Paso 3: Custom Span for RSS Discovery
        return await Sentry.startSpan(
          {
            name: 'gemini.discover_rss',
            op: 'ai.generation',
            attributes: {
              'ai.model': 'gemini-2.5-flash',
              'ai.operation': 'rss_discovery',
            },
          },
          async () => {
            const response = await this.model.generateContent(prompt);
            tokenUsage = this.resolveTokenUsage(response.response.usageMetadata);
            return response.response.text().trim().replace(/['"]/g, '');
          }
        );
      }, 2, 500); // 2 reintentos, 500ms delay (operaciÃ³n menos crÃ­tica)

      // Si la respuesta es literalmente "null" o vacÃ­a, retornar null
      if (result === 'null' || result === '' || result.length < 10) {
        await this.completeAiOperationRun({
          operation,
          tokens: tokenUsage,
          metadata: {
            mediaNameLength: mediaName.length,
            rssFound: false,
            tokenUsageAvailable: tokenUsage.totalTokens !== null,
          },
        });
        logger.debug('No RSS URL found for media source');
        return null;
      }

      // Validar que sea una URL vÃ¡lida
      try {
        new URL(result);
        await this.completeAiOperationRun({
          operation,
          tokens: tokenUsage,
          metadata: {
            mediaNameLength: mediaName.length,
            rssFound: true,
            rssUrlLength: result.length,
            tokenUsageAvailable: tokenUsage.totalTokens !== null,
          },
        });
        logger.info(
          { rssUrlLength: result.length },
          'Valid RSS URL discovered'
        );
        return result;
      } catch {
        await this.completeAiOperationRun({
          operation,
          tokens: tokenUsage,
          metadata: {
            mediaNameLength: mediaName.length,
            rssFound: false,
            invalidUrlReturned: true,
            tokenUsageAvailable: tokenUsage.totalTokens !== null,
          },
        });
        logger.warn('RSS discovery returned invalid URL format');
        return null;
      }
    } catch (error) {
      const mappedError =
        error instanceof ExternalAPIError
          ? error
          : GeminiErrorMapper.toExternalAPIError(error);

      await this.failAiOperationRun({
        operation,
        error: mappedError,
        tokens: tokenUsage,
        metadata: {
          mediaNameLength: mediaName.length,
          tokenUsageAvailable: tokenUsage.totalTokens !== null,
        },
      });

      logger.error(
        { errorCode: String(mappedError.statusCode ?? getErrorCode(error) ?? 'UNKNOWN') },
        'Error during RSS URL discovery'
      );
      return null;
    }
  }

  /**
   * Sprint 24: Descubre fuentes de noticias locales para una ciudad usando Gemini
   *
   * @param city Nombre de la ciudad (e.g., "Bilbao", "Valencia")
   * @returns JSON string con array de fuentes sugeridas
   */
  async discoverLocalSources(
    city: string,
    observability?: AIObservabilityContext
  ): Promise<string> {
    logger.info(
      { cityLength: city.length },
      'Starting local sources discovery'
    );

    const prompt = buildLocationSourcesPrompt(city);
    const operation = await this.beginAiOperationRun({
      operationKey: LOCAL_SOURCE_DISCOVERY_OPERATION_KEY,
      model: GEMINI_ANALYSIS_MODEL,
      observability,
      prompt: {
        promptKey: 'LOCATION_SOURCES_PROMPT',
        version: LOCATION_SOURCES_PROMPT_VERSION,
        template: LOCATION_SOURCES_PROMPT_TEMPLATE,
        sourceFile: RSS_DISCOVERY_PROMPT_SOURCE_FILE,
      },
      metadata: {
        cityLength: city.length,
      },
    });
    let tokenUsage: OperationTokenUsage = {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    };

    try {
      // RESILIENCIA: executeWithRetry maneja reintentos automÃ¡ticos
      const result = await this.executeWithRetry(async () => {
        // ðŸ” Sprint 24: Custom Span for Local Source Discovery
        return await Sentry.startSpan(
          {
            name: 'gemini.discover_local_sources',
            op: 'ai.generation',
            attributes: {
              'ai.model': 'gemini-2.5-flash',
              'ai.operation': 'local_source_discovery',
              'location': city,
            },
          },
          async () => {
            const response = await this.model.generateContent(prompt);
            tokenUsage = this.resolveTokenUsage(response.response.usageMetadata);
            return response.response.text().trim();
          }
        );
      }, 2, 500); // 2 reintentos, 500ms delay

      await this.completeAiOperationRun({
        operation,
        tokens: tokenUsage,
        metadata: {
          cityLength: city.length,
          responseLength: result.length,
          tokenUsageAvailable: tokenUsage.totalTokens !== null,
        },
      });

      logger.info(
        { responseLength: result.length },
        'Local sources discovery completed'
      );
      return result;
    } catch (error) {
      const mappedError =
        error instanceof ExternalAPIError
          ? error
          : GeminiErrorMapper.toExternalAPIError(error);

      await this.failAiOperationRun({
        operation,
        error: mappedError,
        tokens: tokenUsage,
        metadata: {
          cityLength: city.length,
          tokenUsageAvailable: tokenUsage.totalTokens !== null,
        },
      });

      logger.error(
        { errorCode: String(mappedError.statusCode ?? getErrorCode(error) ?? 'UNKNOWN') },
        'Error during local sources discovery'
      );
      throw mappedError;
    }
  }

  /**
   * Obtiene el reporte de costes acumulados de la sesiÃ³n
   */
  getSessionCostReport() {
    return this.taximeter.getReport();
  }
}


