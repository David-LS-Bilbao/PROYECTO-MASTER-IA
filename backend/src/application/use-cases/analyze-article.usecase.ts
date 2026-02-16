/**
 * AnalyzeArticleUseCase (Application Layer)
 * Analiza artÃ­culos con Gemini AI para detectar sesgo, veracidad y generar resÃºmenes.
 *
 * === COST OPTIMIZATION (Sprint 8) ===
 *
 * CACHÃ‰ DE ANÃLISIS (ya implementado):
 * - Los anÃ¡lisis se persisten en PostgreSQL (campos: summary, biasScore, analysis, analyzedAt)
 * - Si article.isAnalyzed === true, se devuelve el anÃ¡lisis cacheado SIN llamar a Gemini
 * - UbicaciÃ³n del cachÃ©: lÃ­neas 70-83 (check isAnalyzed â†’ return cached)
 *
 * LÃMITES DEFENSIVOS:
 * - Batch limit: mÃ¡ximo 100 artÃ­culos por lote (lÃ­nea 234)
 * - No hay llamadas a Gemini dentro de bucles sin control
 * - El bucle de batch solo procesa artÃ­culos NO analizados (findUnanalyzed)
 */

import { ArticleAnalysis } from '../../domain/entities/news-article.entity';
import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
import { AnalysisMode, IGeminiClient } from '../../domain/services/gemini-client.interface';
import { IJinaReaderClient } from '../../domain/services/jina-reader-client.interface';
import { IVectorClient } from '../../domain/services/vector-client.interface';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/domain.error';
import { QuotaService } from '../../domain/services/quota.service';
import { MetadataExtractor } from '../../infrastructure/external/metadata-extractor';
import { GeminiErrorMapper } from '../../infrastructure/external/gemini-error-mapper';

// ============================================================================
// COST OPTIMIZATION CONSTANTS
// ============================================================================

/**
 * MÃ¡ximo de artÃ­culos por lote en anÃ¡lisis batch.
 * LÃ­mite defensivo para evitar costes inesperados.
 */
const MAX_BATCH_LIMIT = 100;

/**
 * MÃ­nimo de caracteres para considerar contenido vÃ¡lido.
 * Contenido muy corto no justifica una llamada a Gemini.
 */
const MIN_CONTENT_LENGTH = 100;
const AUTO_LOW_COST_CONTENT_THRESHOLD = 800;
const LEGACY_SUMMARY_PREFIX = 'resumen provisional basado en contenido interno:';
const SUMMARY_MIN_LENGTH_FOR_CACHE = 30;
const SUMMARY_MAX_WORDS_FULL = 90;
const SUMMARY_MAX_WORDS_LOW_QUALITY = 45;
const SUMMARY_LOW_QUALITY_NOTICE = 'Falta el texto completo para confirmar detalles.';
const NEUTRAL_LOW_CONFIDENCE_BIAS_COMMENT =
  'No se observan indicios textuales claros de encuadre ideologico en el texto disponible (confianza baja).';
const BIAS_INDICATOR_CITATION_PATTERN = /["'`][^"'`]{3,140}["'`]|\([^()]{3,120}\)|\[[^\[\]]{3,120}\]/;


export interface AnalyzeArticleInput {
  articleId: string;
  analysisMode?: AnalysisMode;
  mode?: 'standard' | 'deep';
  user?: {
    id: string;
    subscriptionPlan: 'FREE' | 'PREMIUM';
    usageStats?: {
      articlesAnalyzed?: number;
      chatMessages?: number;
      searchesPerformed?: number;
    } | null;
  };
}

export interface AnalyzeArticleOutput {
  articleId: string;
  summary: string;
  biasScore: number;
  analysis: ArticleAnalysis;
  scrapedContentLength: number;
}

export interface AnalyzeBatchInput {
  limit: number;
}

export interface AnalyzeBatchOutput {
  processed: number;
  successful: number;
  failed: number;
  results: Array<{
    articleId: string;
    success: boolean;
    error?: string;
  }>;
}

interface AnalysisNormalizationContext {
  scrapedContentLength: number;
  usedFallback: boolean;
  analyzedText: string;
  analysisModeUsed: AnalysisMode;
  articleCategory: string | null;
  articleTitle: string;
  rssSnippetDetected: boolean;
}

export class AnalyzeArticleUseCase {
  constructor(
    private readonly articleRepository: INewsArticleRepository,
    private readonly geminiClient: IGeminiClient,
    private readonly jinaReaderClient: IJinaReaderClient,
    private readonly metadataExtractor: MetadataExtractor,
    private readonly vectorClient: IVectorClient,
    private readonly quotaService?: QuotaService
  ) {}

  /**
   * Analyze a single article by ID
   */
  async execute(input: AnalyzeArticleInput): Promise<AnalyzeArticleOutput> {
    const { articleId, user } = input;
    const requestedMode = this.normalizeRequestedMode(input.mode);
    const requestedAnalysisMode =
      requestedMode === 'deep'
        ? 'deep'
        : this.normalizeAnalysisMode(input.analysisMode);

    // Validate input
    if (!articleId || articleId.trim() === '') {
      throw new ValidationError('Article ID is required');
    }

    // Sprint 14: Verify user quota BEFORE processing
    if (user && this.quotaService) {
      this.quotaService.verifyQuota(user, 'analysis');
    }

    // 1. Fetch article from database
    let article = await this.articleRepository.findById(articleId);
    if (!article) {
      throw new EntityNotFoundError('Article', articleId);
    }

    console.log(`\nðŸ” [AnÃ¡lisis] Iniciando noticia: "${article.title}"`);

    // =========================================================================
    // SPRINT 17: COST OPTIMIZATION - CACHÃ‰ GLOBAL DE ANÃLISIS
    // =========================================================================
    // Si el artÃ­culo ya fue analizado por CUALQUIER usuario, devolvemos el
    // anÃ¡lisis cacheado en PostgreSQL SIN llamar a Gemini.
    //
    // BENEFICIO: Si 100 usuarios piden anÃ¡lisis del mismo artÃ­culo:
    // - Primera peticiÃ³n: 1 llamada a Gemini âœ…
    // - Siguientes 99: 0 llamadas a Gemini â†’ 99% ahorro ðŸ’°
    //
    // El cachÃ© es GLOBAL (no por usuario) porque el anÃ¡lisis es objetivo
    // sobre el contenido de la noticia, no subjetivo al perfil del usuario.
    // =========================================================================
    if (article.isAnalyzed) {
      const existingAnalysis = article.getParsedAnalysis();
      if (existingAnalysis) {
        const cachedContentLength = article.content?.length || 0;
        const requiredModeForCache =
          requestedMode === 'deep'
            ? 'deep'
            : cachedContentLength < AUTO_LOW_COST_CONTENT_THRESHOLD
              ? 'low_cost'
              : requestedAnalysisMode;
        const shouldUpgradeCachedAnalysis = this.requiresAnalysisUpgrade(
          existingAnalysis,
          requiredModeForCache
        );
        const shouldRegenerateCachedSummary = this.shouldRegenerateCachedSummary(
          article.summary ?? existingAnalysis.summary
        );
        const shouldRegenerateCachedDeep =
          requestedMode === 'deep' && !this.hasDeepSections(existingAnalysis);

        if (
          !shouldUpgradeCachedAnalysis &&
          !shouldRegenerateCachedSummary &&
          !shouldRegenerateCachedDeep
        ) {
          const normalizedAnalysis = this.normalizeAnalysis(existingAnalysis, {
            scrapedContentLength: article.content?.length || 0,
            usedFallback: false,
            analyzedText: this.prepareContentForAnalysis(article.content || ''),
            analysisModeUsed: this.normalizeAnalysisMode(existingAnalysis.analysisModeUsed),
            articleCategory: article.category,
            articleTitle: article.title,
            rssSnippetDetected: this.detectRssSnippet(article.content || ''),
          });
          console.log(`   [CACHE GLOBAL] Analisis ya existe en BD (analizado: ${article.analyzedAt?.toLocaleString('es-ES')})`);
          console.log(`   Serving cached analysis -> Gemini NO llamado -> Ahorro de ~1500 tokens`);
          console.log(`   Score: ${article.biasScore} | Summary: ${article.summary?.substring(0, 50)}...`);

          // Sprint 18.2: Auto-favorite WITH unlocked analysis (user requested it)
          if (user?.id) {
            try {
              await this.articleRepository.addFavoriteForUser(user.id, article.id, true);
            } catch (favError) {
              // Non-blocking
              console.warn(`   [Auto-favorito cache] Fallo (no critico): ${favError instanceof Error ? favError.message : 'Error'}`);
            }
          }

          return {
            articleId: article.id,
            summary: normalizedAnalysis.summary,
            biasScore: normalizedAnalysis.biasScoreNormalized,
            analysis: normalizedAnalysis,
            scrapedContentLength: article.content?.length || 0,
          };
        }

        if (shouldRegenerateCachedDeep) {
          console.log('   [CACHE GLOBAL] Se fuerza re-analisis por cache deep inexistente o incompleta.');
        } else if (shouldRegenerateCachedSummary) {
          console.log('   [CACHE GLOBAL] Se fuerza re-analisis por summary legacy o demasiado corto.');
        } else {
          console.log(
            `   [CACHE GLOBAL] Se fuerza re-analisis por upgrade de modo (${requiredModeForCache}).`
          );
        }
      }
    }

    // 3. Scrape full content if needed
    let contentToAnalyze = article.content;
    let scrapedContentLength = contentToAnalyze?.length || 0;
    let usedFallback = false;

    // COST OPTIMIZATION: Verificar si el contenido justifica una llamada a Gemini
    // Contenido muy corto (<MIN_CONTENT_LENGTH chars) no vale la pena analizar
    const shouldForceRescrapeForDeep =
      requestedMode === 'deep' &&
      (!!contentToAnalyze &&
        (contentToAnalyze.length < AUTO_LOW_COST_CONTENT_THRESHOLD ||
          this.detectRssSnippet(contentToAnalyze)));
    const isContentInvalid =
      !contentToAnalyze ||
      contentToAnalyze.length < MIN_CONTENT_LENGTH ||
      contentToAnalyze.includes('JinaReader API Error') ||
      shouldForceRescrapeForDeep;

    if (isContentInvalid) {
      console.log(`   ðŸŒ Scraping contenido con Jina Reader (URL: ${article.url})...`);
      
      try {
        const scrapedData = await this.jinaReaderClient.scrapeUrl(article.url);
        
        if (scrapedData.content && scrapedData.content.length >= MIN_CONTENT_LENGTH) {
          contentToAnalyze = scrapedData.content;
          scrapedContentLength = scrapedData.content.length;
          console.log(`   âœ… Scraping OK (${scrapedContentLength} caracteres).`);

          // Update article with scraped content
          let articleWithContent = article.withFullContent(scrapedData.content);
          
          // Enrich with image URL if article doesn't have one
          if (!article.urlToImage && scrapedData.imageUrl) {
            console.log(`   ðŸ–¼ï¸  Imagen detectada: ${scrapedData.imageUrl}`);
            articleWithContent = articleWithContent.withImage(scrapedData.imageUrl);
          }
          
          await this.articleRepository.save(articleWithContent);
        } else {
          throw new Error('Contenido scrapeado vacÃ­o o muy corto');
        }
      } catch (scrapingError) {
        // FALLBACK: Usar tÃ­tulo + descripciÃ³n
        console.warn(`   âš ï¸ Scraping fallÃ³. Usando FALLBACK (tÃ­tulo + descripciÃ³n).`);
        console.warn(`   ðŸ‘‰ RazÃ³n: ${scrapingError instanceof Error ? scrapingError.message : 'Error desconocido'}`);
        
        const fallbackContent = `${article.title}\n\n${article.description || 'Sin descripciÃ³n disponible'}`;
        contentToAnalyze = fallbackContent;
        scrapedContentLength = 0; // Indicar que no se hizo scraping
        usedFallback = true;
      }
    } else {
        console.log(`   ðŸ“‚ Usando contenido existente en DB.`);
    }

    // 3.5. Extract image metadata if article doesn't have one (BEFORE Gemini analysis)
    if (!article.urlToImage) {
      console.log(`   ðŸ–¼ï¸  Extrayendo metadata de imagen (timeout 2s)...`);
      try {
        const metadata = await this.metadataExtractor.extractMetadata(article.url);
        const imageUrl = this.metadataExtractor.getBestImageUrl(metadata);
        
        if (imageUrl) {
          console.log(`   âœ… Imagen encontrada: ${imageUrl.substring(0, 60)}...`);
          // Update article with image URL
          const articleWithImage = article.withImage(imageUrl);
          await this.articleRepository.save(articleWithImage);
          // Update local reference for next steps
          article = articleWithImage;
        } else {
          console.log(`   âš ï¸  No se encontrÃ³ og:image en la pÃ¡gina.`);
        }
      } catch (metadataError) {
        console.warn(`   âš ï¸  Metadata extraction fallÃ³ (continuando sin imagen): ${metadataError instanceof Error ? metadataError.message : 'Error desconocido'}`);
        // Continue without image - not a critical error
      }
    } else {
      console.log(`   ðŸ–¼ï¸  ArtÃ­culo ya tiene imagen.`);
    }

    const rawAnalyzedContent = contentToAnalyze || '';
    const rssSnippetDetected = this.detectRssSnippet(rawAnalyzedContent);
    const cleanedContentForAnalysis = this.prepareContentForAnalysis(rawAnalyzedContent);
    const normalizedContentForAnalysis =
      cleanedContentForAnalysis.trim().length > 0
        ? cleanedContentForAnalysis
        : rawAnalyzedContent;

    // 4. Analyze with Gemini
    console.log(`   ðŸ¤– [NUEVA ANÃLISIS] Generando anÃ¡lisis con IA (este resultado se cachearÃ¡ globalmente)...`);

    // Si usamos fallback, ajustar el prompt
    let adjustedContent = normalizedContentForAnalysis;
    if (usedFallback) {
      adjustedContent = `ADVERTENCIA: No se pudo acceder al artÃ­culo completo. Realiza el anÃ¡lisis basÃ¡ndote ÃšNICAMENTE en el tÃ­tulo y el resumen disponibles. Indica explÃ­citamente en tu respuesta que el anÃ¡lisis es preliminar por falta de acceso a la fuente original.\n\n${normalizedContentForAnalysis}`;
    }
    
    const effectiveAnalysisMode = this.resolveEffectiveAnalysisMode({
      requestedMode: requestedAnalysisMode,
      scrapedContentLength,
      usedFallback,
    });

    let analysis: ArticleAnalysis;
    try {
      analysis = await this.geminiClient.analyzeArticle({
        title: article.title,
        content: adjustedContent,
        source: article.source,
        language: article.language,
        analysisMode: effectiveAnalysisMode,
      });
      analysis = this.normalizeAnalysis(analysis, {
        scrapedContentLength,
        usedFallback,
        analyzedText: normalizedContentForAnalysis,
        analysisModeUsed: effectiveAnalysisMode,
        articleCategory: article.category,
        articleTitle: article.title,
        rssSnippetDetected,
      });
      console.log(`   âœ… Gemini OK. Score: ${analysis.biasScore} | Summary: ${analysis.summary.substring(0, 30)}...`);
    } catch (error) {
      // Map Gemini errors for observability (AI_RULES.md compliance)
      const mappedError = GeminiErrorMapper.toExternalAPIError(error);
      console.error(`   âŒ Gemini analysis failed: ${mappedError.message}`);
      throw mappedError;
    }

    // 5. Update article with analysis (global cache)
    const analyzedArticle = article.withAnalysis(analysis);
    await this.articleRepository.save(analyzedArticle);

    // 5.1. Sprint 18.2: Auto-favorite WITH unlocked analysis (user triggered analysis)
    if (user?.id) {
      try {
        await this.articleRepository.addFavoriteForUser(user.id, article.id, true);
        console.log(`   [Auto-favorito] Usuario ${user.id.substring(0, 8)}... -> articulo ${article.id.substring(0, 8)}...`);
      } catch (favError) {
        // Non-blocking: don't fail the analysis if favorite fails
        console.warn(`   [Auto-favorito] Fallo (no critico): ${favError instanceof Error ? favError.message : 'Error'}`);
      }
    }

    // 6. Generate and store embedding in pgvector for semantic search
    try {
      console.log(`   ðŸ”— Generando embedding para bÃºsqueda semÃ¡ntica...`);

      // Combine relevant text for embedding
      const textToEmbed = `${article.title}. ${article.description || ''}. ${analysis.summary || ''}`;

      // Generate embedding with Gemini (wrapped with error mapping)
      let embedding: number[];
      try {
        embedding = await this.geminiClient.generateEmbedding(textToEmbed);
      } catch (error) {
        const mappedError = GeminiErrorMapper.toExternalAPIError(error);
        console.error(`   âŒ Gemini embedding failed: ${mappedError.message}`);
        throw mappedError;
      }

      // Upsert embedding to PostgreSQL using pgvector
      await this.vectorClient.upsertItem(
        article.id,
        embedding,
        {
          title: article.title,
          source: article.source,
          publishedAt: article.publishedAt.toISOString(),
          biasScore: analysis.biasScore,
        },
        textToEmbed
      );

      console.log(`   âœ… Embedding almacenado en pgvector OK`);
    } catch (indexError) {
      // Non-blocking: log error but don't fail the analysis
      console.warn(`   âš ï¸ Almacenamiento de embedding fallÃ³ (anÃ¡lisis completado): ${indexError instanceof Error ? indexError.message : 'Error desconocido'}`);
    }

    return {
      articleId: article.id,
      summary: analysis.summary,
      biasScore: analysis.biasScoreNormalized,
      analysis,
      scrapedContentLength,
    };
  }

  private normalizeAnalysis(
    analysis: ArticleAnalysis,
    context?: Partial<AnalysisNormalizationContext>
  ): ArticleAnalysis {
    const scrapedContentLength =
      typeof context?.scrapedContentLength === 'number'
        ? Math.max(0, context.scrapedContentLength)
        : Number.POSITIVE_INFINITY;
    const analysisModeUsed = this.resolveEffectiveAnalysisMode({
      requestedMode: this.normalizeAnalysisMode(
        context?.analysisModeUsed ?? analysis.analysisModeUsed
      ),
      scrapedContentLength: Number.isFinite(scrapedContentLength)
        ? scrapedContentLength
        : AUTO_LOW_COST_CONTENT_THRESHOLD,
      usedFallback: context?.usedFallback === true,
    });

    const rawCandidate =
      typeof analysis.biasRaw === 'number'
        ? analysis.biasRaw
        : typeof analysis.biasScore === 'number' && Math.abs(analysis.biasScore) > 1
          ? analysis.biasScore
          : 0;
    const parsedBiasRaw = this.clampNumber(rawCandidate, -10, 10, 0);
    const parsedBiasScoreNormalized =
      typeof analysis.biasScoreNormalized === 'number'
        ? this.clampNumber(analysis.biasScoreNormalized, 0, 1, Math.abs(parsedBiasRaw) / 10)
        : Math.abs(parsedBiasRaw) / 10;

    const maxBiasIndicators = analysisModeUsed === 'deep' ? 8 : 5;
    const maxClaims = analysisModeUsed === 'deep' ? 10 : 5;

    const modelBiasIndicators = Array.isArray(analysis.biasIndicators)
      ? analysis.biasIndicators
      : [];
    const modelCitedBiasIndicators = this.extractQuotedBiasIndicators(
      modelBiasIndicators,
      maxBiasIndicators
    );
    const rawBiasIndicators = this.withTitleBiasIndicator(
      modelBiasIndicators,
      context?.articleTitle
    );
    const citedBiasIndicators = this.extractQuotedBiasIndicators(
      rawBiasIndicators,
      maxBiasIndicators
    );
    const hasCalibratedBiasSignals = this.hasThreeQuotedBiasIndicators(modelBiasIndicators);
    const biasRaw = hasCalibratedBiasSignals ? parsedBiasRaw : 0;
    const biasScoreNormalized = hasCalibratedBiasSignals ? parsedBiasScoreNormalized : 0;
    const biasType = hasCalibratedBiasSignals ? analysis.biasType : 'ninguno';
    const biasIndicators = citedBiasIndicators;

    let reliabilityScore = this.clampNumber(analysis.reliabilityScore, 0, 100, 50);
    let traceabilityScore = this.clampNumber(
      analysis.traceabilityScore,
      0,
      100,
      reliabilityScore
    );
    const lengthCappedScores = this.applyLengthScoreCaps(
      scrapedContentLength,
      reliabilityScore,
      traceabilityScore
    );
    reliabilityScore = lengthCappedScores.reliabilityScore;
    traceabilityScore = lengthCappedScores.traceabilityScore;
    const shouldForceNoDeterminableFactuality =
      scrapedContentLength < 300 || context?.rssSnippetDetected === true;
    const factualityStatus: 'no_determinable' | 'plausible_but_unverified' =
      shouldForceNoDeterminableFactuality
        ? 'no_determinable'
        : (analysis.factualityStatus ?? 'no_determinable');
    const evidenceNeeded = Array.isArray(analysis.evidence_needed)
      ? analysis.evidence_needed.slice(0, 4)
      : [];
    const shouldKeepIndeterminateLeaning =
      scrapedContentLength < 300 ||
      context?.rssSnippetDetected === true ||
      context?.usedFallback === true;
    const shouldForceNeutralLowConfidence =
      scrapedContentLength >= 600 && modelCitedBiasIndicators.length < 2;
    const hasIdeologicalEvidence =
      hasCalibratedBiasSignals &&
      scrapedContentLength >= 800 &&
      traceabilityScore >= 40;
    const parsedArticleLeaning = this.normalizeArticleLeaning(
      analysis.articleLeaning ?? analysis.biasLeaning
    );
    let articleLeaning: 'progresista' | 'conservadora' | 'extremista' | 'neutral' | 'indeterminada';
    let leaningConfidence: 'baja' | 'media' | 'alta' | undefined;
    if (shouldKeepIndeterminateLeaning) {
      articleLeaning = 'indeterminada';
    } else if (shouldForceNeutralLowConfidence) {
      articleLeaning = 'neutral';
      leaningConfidence = 'baja';
    } else if (hasIdeologicalEvidence) {
      articleLeaning = this.enforceExtremistRule(
        parsedArticleLeaning ?? 'neutral',
        biasIndicators
      );
    } else {
      articleLeaning = 'neutral';
      leaningConfidence = 'baja';
    }
    if (!shouldKeepIndeterminateLeaning && articleLeaning === 'indeterminada') {
      articleLeaning = 'neutral';
      leaningConfidence = 'baja';
    }
    const biasComment = shouldForceNeutralLowConfidence
      ? NEUTRAL_LOW_CONFIDENCE_BIAS_COMMENT
      : this.buildBiasComment({
          shouldForceIndeterminateBias: shouldKeepIndeterminateLeaning,
          hasCalibratedBiasSignals,
          biasIndicators,
          articleLeaning,
        });

    const claims = Array.isArray(analysis.factCheck?.claims)
      ? analysis.factCheck.claims.slice(0, maxClaims)
      : [];
    const summaryContext = {
      scrapedContentLength,
      usedFallback: context?.usedFallback === true,
      rssSnippetDetected: context?.rssSnippetDetected === true,
    };
    const normalizedSummary = this.normalizeSummaryText(analysis.summary, summaryContext);
    const qualityNotice = this.buildQualityNotice(summaryContext);
    const forceInsufficientEvidenceVerdict = this.shouldForceInsufficientVerdict({
      scrapedContentLength,
      usedFallback: context?.usedFallback === true,
    });
    const factCheck = this.normalizeFactCheck({
      claims,
      verdict: analysis.factCheck?.verdict,
      reasoning: analysis.factCheck?.reasoning,
      forceInsufficientEvidenceVerdict,
    });
    reliabilityScore = this.alignReliabilityScoreWithVerdict({
      reliabilityScore,
      verdict: factCheck.verdict,
      factualityStatus,
      qualityNotice,
    });
    const clickbaitScore = this.clampNumber(analysis.clickbaitScore, 0, 100, 0);
    const inferredEscalation =
      traceabilityScore <= 25 &&
      reliabilityScore <= 45 &&
      claims.some((claim) => /\b(todo|siempre|nunca|100%|definitivo)\b/i.test(claim));
    const lowCostEscalation = this.shouldEscalateLowCostStrongClaims({
      scrapedContentLength,
      usedFallback: context?.usedFallback === true,
      claims,
      summary: normalizedSummary,
      analyzedText: context?.analyzedText ?? '',
    });
    const baseEscalation =
      (typeof analysis.should_escalate === 'boolean'
        ? analysis.should_escalate
        : inferredEscalation) || lowCostEscalation;
    const shouldEscalate = this.applyCategoryEscalationPolicy({
      currentValue: baseEscalation,
      category: context?.articleCategory ?? analysis.category,
      clickbaitScore,
      claims,
      summary: normalizedSummary,
      reliabilityScore,
      traceabilityScore,
    });
    const hasAttributionOrCitations = this.hasAttributionOrCitationEvidence({
      analyzedText: context?.analyzedText ?? '',
      biasIndicators: modelCitedBiasIndicators,
      traceabilityScore,
    });
    const reliabilityComment = this.buildReliabilityComment({
      reliabilityScore,
      traceabilityScore,
      factualityStatus,
      evidenceNeeded,
      scrapedContentLength,
      usedFallback: context?.usedFallback === true,
      factCheckVerdict: factCheck.verdict,
      hasAttributionOrCitations,
    });
    const explanation =
      biasRaw === 0 && !hasCalibratedBiasSignals
        ? 'No se detectaron indicios textuales suficientes de sesgo con evidencia citada.'
        : analysis.explanation;

    const normalizedResult: ArticleAnalysis = {
      ...analysis,
      summary: normalizedSummary,
      qualityNotice,
      biasRaw,
      biasScore: biasScoreNormalized,
      biasScoreNormalized,
      biasType,
      reliabilityScore,
      traceabilityScore,
      factualityStatus,
      evidence_needed: evidenceNeeded,
      should_escalate: shouldEscalate,
      biasIndicators,
      biasComment,
      articleLeaning,
      leaningConfidence,
      biasLeaning: this.toLegacyBiasLeaning(articleLeaning),
      reliabilityComment,
      explanation,
      analysisModeUsed,
      clickbaitScore,
      factCheck,
    };

    const enrichedResult =
      analysisModeUsed === 'deep'
        ? this.ensureDeepSections(normalizedResult, {
            scrapedContentLength,
            usedFallback: context?.usedFallback === true,
            rssSnippetDetected: context?.rssSnippetDetected === true,
            analyzedText: context?.analyzedText ?? '',
          })
        : normalizedResult;

    return this.sanitizeAnalysisTextFields(enrichedResult);
  }

  private applyLengthScoreCaps(
    scrapedContentLength: number,
    reliabilityScore: number,
    traceabilityScore: number
  ): { reliabilityScore: number; traceabilityScore: number } {
    if (scrapedContentLength < 300) {
      return {
        reliabilityScore: Math.min(reliabilityScore, 45),
        traceabilityScore: Math.min(traceabilityScore, 30),
      };
    }

    if (scrapedContentLength < 800) {
      return {
        reliabilityScore: Math.min(reliabilityScore, 55),
        traceabilityScore: Math.min(traceabilityScore, 40),
      };
    }

    return {
      reliabilityScore,
      traceabilityScore,
    };
  }

  private hasThreeQuotedBiasIndicators(indicators: string[]): boolean {
    return this.extractQuotedBiasIndicators(indicators).length >= 3;
  }

  private extractQuotedBiasIndicators(indicators: string[], maxItems: number = 5): string[] {
    return indicators
      .filter((indicator) => BIAS_INDICATOR_CITATION_PATTERN.test(indicator))
      .slice(0, maxItems);
  }

  private withTitleBiasIndicator(
    indicators: string[],
    articleTitle: string | undefined
  ): string[] {
    const normalizedIndicators = indicators
      .filter((indicator): indicator is string => typeof indicator === 'string')
      .map((indicator) => indicator.trim())
      .filter((indicator) => indicator.length > 0)
      .slice(0, 5);
    const titleIndicator = this.createTitleBiasIndicator(articleTitle);
    if (!titleIndicator) {
      return normalizedIndicators;
    }

    const hasEquivalent = normalizedIndicators.some((indicator) =>
      indicator.toLowerCase().includes(titleIndicator.toLowerCase().replace(/^titular:\s*/i, ''))
    );
    if (hasEquivalent) {
      return normalizedIndicators;
    }

    return [...normalizedIndicators, titleIndicator].slice(0, 5);
  }

  private createTitleBiasIndicator(articleTitle: string | undefined): string | undefined {
    if (typeof articleTitle !== 'string') {
      return undefined;
    }

    const cleanedTitle = this.prepareContentForAnalysis(articleTitle).replace(/\s+/g, ' ').trim();
    if (!cleanedTitle) {
      return undefined;
    }

    const snippet =
      cleanedTitle.length > 100
        ? `${cleanedTitle.slice(0, 97).trimEnd()}...`
        : cleanedTitle;
    return `Titular: "${snippet}"`;
  }

  private normalizeArticleLeaning(
    value: unknown
  ): 'progresista' | 'conservadora' | 'extremista' | 'neutral' | 'indeterminada' | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    const validValues = [
      'progresista',
      'conservadora',
      'extremista',
      'neutral',
      'indeterminada',
    ];

    if ((validValues as string[]).includes(normalized)) {
      return normalized as 'progresista' | 'conservadora' | 'extremista' | 'neutral' | 'indeterminada';
    }

    if (normalized === 'otra') {
      return 'indeterminada';
    }

    return undefined;
  }

  private toLegacyBiasLeaning(
    articleLeaning: 'progresista' | 'conservadora' | 'extremista' | 'neutral' | 'indeterminada'
  ): 'progresista' | 'conservadora' | 'neutral' | 'indeterminada' | 'otra' {
    if (articleLeaning === 'extremista') {
      return 'otra';
    }

    return articleLeaning;
  }

  private enforceExtremistRule(
    articleLeaning: 'progresista' | 'conservadora' | 'extremista' | 'neutral' | 'indeterminada',
    biasIndicators: string[]
  ): 'progresista' | 'conservadora' | 'extremista' | 'neutral' | 'indeterminada' {
    if (articleLeaning !== 'extremista') {
      return articleLeaning;
    }

    return this.hasExtremistEvidence(biasIndicators) ? 'extremista' : 'indeterminada';
  }

  private hasExtremistEvidence(biasIndicators: string[]): boolean {
    const extremistPattern =
      /\b(deshumaniza|deshumanizante|plaga|extermin|aniquil|eliminar|matar|violento|enemigo interno|limpieza|subhuman|vermin|kill|destroy|crush|siempre|nunca|sin excepcion)\b/i;

    return biasIndicators.some((indicator) => extremistPattern.test(indicator));
  }

  private buildBiasComment(params: {
    shouldForceIndeterminateBias: boolean;
    hasCalibratedBiasSignals: boolean;
    biasIndicators: string[];
    articleLeaning: 'progresista' | 'conservadora' | 'extremista' | 'neutral' | 'indeterminada';
  }): string {
    if (params.shouldForceIndeterminateBias) {
      return this.normalizeUiComment(
        'No hay suficientes se\u00f1ales citadas para inferir una tendencia ideol\u00f3gica y, con este nivel de evidencia interna, el sesgo se mantiene indeterminado'
      );
    }
    if (!params.hasCalibratedBiasSignals) {
      return this.normalizeUiComment(
        'No se observan indicios textuales solidos para atribuir una tendencia ideologica consistente con el texto disponible'
      );
    }

    const citedSignals = params.biasIndicators
      .slice(0, 3)
      .map((indicator) => this.summarizeIndicator(indicator))
      .join('; ');
    const leaningText =
      params.articleLeaning === 'indeterminada'
        ? 'sin tendencia ideologica concluyente'
        : `con tendencia ${params.articleLeaning}`;
    const generated = `El encuadre refleja ${leaningText} segun indicios textuales citados (${citedSignals}), evaluados solo desde el texto disponible y sin inferir hechos externos`;

    return this.normalizeUiComment(generated);
  }

  private buildReliabilityComment(params: {
    reliabilityScore: number;
    traceabilityScore: number;
    factualityStatus: 'no_determinable' | 'plausible_but_unverified';
    evidenceNeeded: string[];
    scrapedContentLength: number;
    usedFallback: boolean;
    factCheckVerdict: ArticleAnalysis['factCheck']['verdict'];
    hasAttributionOrCitations: boolean;
  }): string {
    const shortOrFallbackTemplate =
      'Fiabilidad baja: texto incompleto y sin atribuciones; no verificable con fuentes internas.';
    if (params.usedFallback || params.scrapedContentLength < 300) {
      return shortOrFallbackTemplate;
    }

    const genericMissingEvidence = this.selectGenericMissingEvidence(
      params.evidenceNeeded,
      2
    );
    const missingEvidenceText = this.joinGenericMissingEvidence(
      genericMissingEvidence.length > 0 ? genericMissingEvidence : ['citas', 'contexto']
    );
    const reliabilityBand =
      params.reliabilityScore >= 85
        ? 'muy alta'
        : params.reliabilityScore >= 70
          ? 'alta'
          : params.reliabilityScore >= 50
            ? 'media'
            : params.reliabilityScore >= 30
              ? 'baja'
              : 'muy baja';

    if (params.factCheckVerdict === 'SupportedByArticle') {
      const supportedTemplate = params.hasAttributionOrCitations
        ? `Fiabilidad ${reliabilityBand}: soportado por el articulo con evidencia interna trazable; sin verificacion externa independiente.`
        : `Fiabilidad ${reliabilityBand}: soportado por el articulo (sin verificacion externa) y con respaldo interno parcial.`;
      const compactSupportedTemplate = params.hasAttributionOrCitations
        ? 'Soportado por el articulo con evidencia interna trazable; sin verificacion externa independiente.'
        : 'Soportado por el articulo (sin verificacion externa).';
      return this.fitReliabilityCommentLength(
        supportedTemplate,
        compactSupportedTemplate,
        shortOrFallbackTemplate
      );
    }

    if (params.scrapedContentLength < 800) {
      const mediumTemplate =
        params.factualityStatus === 'no_determinable'
          ? `Fiabilidad media: soporte interno parcial; faltan ${missingEvidenceText} y no verificable con fuentes internas.`
          : `Fiabilidad media: soporte interno parcial; faltan ${missingEvidenceText} para mejorar trazabilidad.`;
      return this.fitReliabilityCommentLength(mediumTemplate, shortOrFallbackTemplate);
    }
    const traceabilityClause =
      params.traceabilityScore >= 70
        ? 'hay trazabilidad clara de citas y atribuciones'
        : params.traceabilityScore >= 40
          ? 'la trazabilidad es parcial'
          : 'la trazabilidad es debil';

    const longTemplate =
      params.factualityStatus === 'no_determinable'
        ? `Fiabilidad ${reliabilityBand}: ${traceabilityClause}; faltan ${missingEvidenceText} y no verificable con fuentes internas.`
        : `Fiabilidad ${reliabilityBand}: ${traceabilityClause}; faltan ${missingEvidenceText} para robustecer la evidencia interna.`;
    const compactLongTemplate =
      params.factualityStatus === 'no_determinable'
        ? `Fiabilidad ${reliabilityBand}: evidencia interna ${traceabilityClause}; no verificable con fuentes internas.`
        : `Fiabilidad ${reliabilityBand}: evidencia interna ${traceabilityClause} y soporte parcial.`;

    return this.fitReliabilityCommentLength(
      longTemplate,
      compactLongTemplate,
      shortOrFallbackTemplate
    );
  }

  private summarizeIndicator(indicator: string): string {
    const compact = indicator.replace(/\s+/g, ' ').trim();
    if (!compact) {
      return '"sin cita legible"';
    }

    if (compact.length <= 58) {
      return compact;
    }

    return `${compact.slice(0, 55).trimEnd()}...`;
  }

  private normalizeUiComment(comment: string): string {
    const normalizedBase = comment
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.!?]+$/, '');
    const withMinimumLength =
      normalizedBase.length < 140
        ? `${normalizedBase}, evaluado solo con evidencia interna y sin verificacion factual externa`
        : normalizedBase;

    if (withMinimumLength.length > 220) {
      return `${withMinimumLength.slice(0, 217).trimEnd()}...`;
    }

    return `${withMinimumLength}.`;
  }

  private joinAsNaturalList(items: string[]): string {
    if (items.length === 0) {
      return '';
    }
    if (items.length === 1) {
      return items[0];
    }
    return `${items[0]} y ${items[1]}`;
  }

  private selectGenericMissingEvidence(
    evidenceNeeded: string[],
    maxItems: number
  ): Array<'citas' | 'documento' | 'contexto'> {
    const detected = new Set<'citas' | 'documento' | 'contexto'>();

    for (const rawItem of evidenceNeeded) {
      const normalized = rawItem
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      if (
        /\b(cita|quote|fuente|atribucion|declaracion|testimonio)\b/.test(normalized)
      ) {
        detected.add('citas');
      }
      if (
        /\b(documento|informe|boletin|boe|pdf|registro|expediente|base de datos)\b/.test(
          normalized
        )
      ) {
        detected.add('documento');
      }
      if (
        /\b(contexto|metodologia|alcance|serie|fecha|antecedente|comparativa)\b/.test(
          normalized
        )
      ) {
        detected.add('contexto');
      }

      if (detected.size >= maxItems) {
        break;
      }
    }

    return Array.from(detected).slice(0, maxItems);
  }

  private joinGenericMissingEvidence(
    evidence: Array<'citas' | 'documento' | 'contexto'>
  ): string {
    const labels: Record<'citas' | 'documento' | 'contexto', string> = {
      citas: 'citas',
      documento: 'documento',
      contexto: 'contexto',
    };

    return this.joinAsNaturalList(evidence.map((item) => labels[item]));
  }

  private hasAttributionOrCitationEvidence(params: {
    analyzedText: string;
    biasIndicators: string[];
    traceabilityScore: number;
  }): boolean {
    const attributionPattern =
      /\b(segun|according to|de acuerdo con|afirmo|informo|reporto|ministerio|universidad|instituto|documento|informe|fuente)\b|https?:\/\/\S+|www\.\S+/i;
    const hasAttributionInContent = attributionPattern.test(params.analyzedText);
    const hasQuotedIndicators = this.extractQuotedBiasIndicators(params.biasIndicators).length > 0;

    return hasAttributionInContent || hasQuotedIndicators || params.traceabilityScore >= 55;
  }

  private fitReliabilityCommentLength(...candidates: string[]): string {
    for (const candidate of candidates) {
      const compact = candidate.replace(/\s+/g, ' ').trim();
      if (compact.length <= 220) {
        return compact;
      }
    }

    return 'Fiabilidad interna limitada por evidencia textual insuficiente.';
  }

  private shouldForceInsufficientVerdict(params: {
    scrapedContentLength: number;
    usedFallback: boolean;
  }): boolean {
    return (
      params.usedFallback ||
      params.scrapedContentLength === 0 ||
      params.scrapedContentLength < 300
    );
  }

  private normalizeFactCheck(params: {
    claims: string[];
    verdict: ArticleAnalysis['factCheck']['verdict'] | undefined;
    reasoning: string | undefined;
    forceInsufficientEvidenceVerdict: boolean;
  }): ArticleAnalysis['factCheck'] {
    let verdict =
      params.forceInsufficientEvidenceVerdict || params.claims.length === 0
        ? 'InsufficientEvidenceInArticle'
        : this.normalizeFactCheckVerdict(params.verdict);
    let reasoning =
      typeof params.reasoning === 'string' && params.reasoning.trim().length > 0
        ? params.reasoning.trim()
        : 'Sin informacion suficiente para verificar.';

    if (this.reasoningIndicatesInsufficientEvidence(reasoning)) {
      verdict = 'InsufficientEvidenceInArticle';
    }

    if (verdict === 'SupportedByArticle') {
      reasoning =
        'Aparece explicitamente en el texto (soportado por el articulo), no verificado externamente.';
    } else if (verdict === 'InsufficientEvidenceInArticle' && !this.reasoningIndicatesInsufficientEvidence(reasoning)) {
      reasoning =
        'La evidencia interna es insuficiente en el texto; no verificable con fuentes internas.';
    }

    return {
      claims: params.claims,
      verdict,
      reasoning,
    };
  }

  private normalizeFactCheckVerdict(
    verdict: ArticleAnalysis['factCheck']['verdict'] | undefined
  ): 'SupportedByArticle' | 'NotSupportedByArticle' | 'InsufficientEvidenceInArticle' {
    if (
      verdict === 'SupportedByArticle' ||
      verdict === 'NotSupportedByArticle' ||
      verdict === 'InsufficientEvidenceInArticle'
    ) {
      return verdict;
    }
    return 'InsufficientEvidenceInArticle';
  }

  private reasoningIndicatesInsufficientEvidence(reasoning: string): boolean {
    const normalized = reasoning
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return /\b(insuficiente|insuficientes|sin evidencia|sin pruebas|no verificable|no verificable con fuentes internas|falta evidencia|no se puede verificar|no hay evidencia suficiente|evidencia insuficiente)\b/.test(
      normalized
    );
  }

  private applyCategoryEscalationPolicy(params: {
    currentValue: boolean;
    category?: string | null;
    clickbaitScore: number;
    claims: string[];
    summary: string;
    reliabilityScore: number;
    traceabilityScore: number;
  }): boolean {
    const normalizedCategory = this.normalizeCategoryForEscalation(params.category);
    const claimsCorpus = [...params.claims, params.summary].join(' ');
    const hasHighRiskClaim = this.hasHighRiskClaim(claimsCorpus);
    const hasStrongClaim = this.hasStrongClaim(claimsCorpus) || hasHighRiskClaim;

    if (
      this.isLowRiskCategory(normalizedCategory) &&
      params.clickbaitScore < 30 &&
      !hasHighRiskClaim
    ) {
      return false;
    }

    if (
      this.isHighRiskCategory(normalizedCategory) &&
      params.traceabilityScore <= 40 &&
      params.reliabilityScore <= 55 &&
      hasStrongClaim
    ) {
      return true;
    }

    return params.currentValue;
  }

  private normalizeCategoryForEscalation(category?: string | null): string {
    if (!category) {
      return '';
    }

    return category
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private isLowRiskCategory(category: string): boolean {
    return category === 'deportes' || category === 'cultura';
  }

  private isHighRiskCategory(category: string): boolean {
    return (
      category === 'politica' ||
      category === 'economia' ||
      category === 'sociedad' ||
      category === 'mundo' ||
      category === 'internacional'
    );
  }

  private hasStrongClaim(text: string): boolean {
    return /\b(siempre|nunca|todo esta|todo estÃ¡|demuestra|100%|sin duda|definitivo|inminente)\b/i.test(
      text
    );
  }

  private hasHighRiskClaim(text: string): boolean {
    return /\b(cura|tratamiento definitivo|fraude electoral|colapso bancario|quiebra|ataque terrorista|amenaza inminente|murio|murieron|fallecio|fallecieron|guerra|violencia)\b/i.test(
      text
    );
  }

  private detectRssSnippet(content: string): boolean {
    if (!content) {
      return false;
    }

    return /\bleer\b/i.test(content) && /<a\s+[^>]*href\s*=/i.test(content);
  }

  private prepareContentForAnalysis(content: string): string {
    if (!content) {
      return '';
    }

    const withAnchorUrls = content.replace(
      /<a\b[^>]*href\s*=\s*['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi,
      (_match, href: string, anchorText: string) => {
        const decodedAnchorText = this.decodeHtmlEntities(anchorText)
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return decodedAnchorText
          ? `${decodedAnchorText} (${href})`
          : href;
      }
    );

    const withoutTags = this.stripHtmlTags(withAnchorUrls);
    const decoded = this.decodeHtmlEntities(withoutTags);
    return decoded
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .trim();
  }

  private stripHtmlTags(content: string): string {
    return content.replace(/<[^>]+>/g, ' ');
  }

  private decodeHtmlEntities(content: string): string {
    const namedEntities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
      '&aacute;': '\u00e1',
      '&eacute;': '\u00e9',
      '&iacute;': '\u00ed',
      '&oacute;': '\u00f3',
      '&uacute;': '\u00fa',
      '&Aacute;': '\u00c1',
      '&Eacute;': '\u00c9',
      '&Iacute;': '\u00cd',
      '&Oacute;': '\u00d3',
      '&Uacute;': '\u00da',
      '&ntilde;': '\u00f1',
      '&Ntilde;': '\u00d1',
      '&uuml;': '\u00fc',
      '&Uuml;': '\u00dc',
      '&ldquo;': '"',
      '&rdquo;': '"',
      '&lsquo;': "'",
      '&rsquo;': "'",
    };

    let decoded = content.replace(
      /&(amp|lt|gt|quot|nbsp|aacute|eacute|iacute|oacute|uacute|Aacute|Eacute|Iacute|Oacute|Uacute|ntilde|Ntilde|uuml|Uuml|ldquo|rdquo|lsquo|rsquo|#39);/g,
      (match) => namedEntities[match] ?? match
    );

    decoded = decoded.replace(/&#(\d+);/g, (_match, decimalCode) => {
      const parsedCode = Number.parseInt(decimalCode, 10);
      return Number.isNaN(parsedCode) ? _match : String.fromCodePoint(parsedCode);
    });
    decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_match, hexCode) => {
      const parsedCode = Number.parseInt(hexCode, 16);
      return Number.isNaN(parsedCode) ? _match : String.fromCodePoint(parsedCode);
    });

    return decoded;
  }

  private shouldEscalateLowCostStrongClaims(params: {
    scrapedContentLength: number;
    usedFallback: boolean;
    claims: string[];
    summary: string;
    analyzedText: string;
  }): boolean {
    const isLowCostContext =
      params.usedFallback || params.scrapedContentLength < AUTO_LOW_COST_CONTENT_THRESHOLD;
    if (!isLowCostContext) {
      return false;
    }

    const claimsText = [...params.claims, params.summary].join(' ');
    const hasStrongClaim = /\b(siempre|nunca|todo esta|todo estÃ¡|demuestra|100%|sin duda|definitivo|urgente|esc[Ã¡a]ndalo|bomba|inminente)\b/i.test(
      claimsText
    );
    if (!hasStrongClaim) {
      return false;
    }

    const hasAttribution = /\b(seg[uÃº]n|according to|de acuerdo con|afirm[oÃ³]|inform[oÃ³]|report[oÃ³]|ministerio|universidad|instituto|documento|informe)\b|https?:\/\/\S+|www\.\S+/i.test(
      params.analyzedText
    );
    return !hasAttribution;
  }

  private normalizeAnalysisMode(value: unknown): AnalysisMode {
    if (value === 'moderate' || value === 'standard' || value === 'low_cost' || value === 'deep') {
      return value;
    }

    return 'low_cost';
  }

  private normalizeRequestedMode(value: unknown): 'standard' | 'deep' {
    return value === 'deep' ? 'deep' : 'standard';
  }

  private resolveEffectiveAnalysisMode(params: {
    requestedMode: AnalysisMode;
    scrapedContentLength: number;
    usedFallback: boolean;
  }): AnalysisMode {
    if (params.requestedMode === 'deep') {
      return 'deep';
    }

    if (params.usedFallback || params.scrapedContentLength < AUTO_LOW_COST_CONTENT_THRESHOLD) {
      return 'low_cost';
    }

    return params.requestedMode;
  }

  private requiresAnalysisUpgrade(
    existingAnalysis: ArticleAnalysis,
    requestedMode: AnalysisMode
  ): boolean {
    const cachedMode = this.normalizeAnalysisMode(existingAnalysis.analysisModeUsed);
    return this.getAnalysisModeRank(cachedMode) < this.getAnalysisModeRank(requestedMode);
  }

  private hasDeepSections(analysis: ArticleAnalysis): boolean {
    const sections = analysis.deep?.sections;
    if (!sections) {
      return false;
    }

    return (
      Array.isArray(sections.known) &&
      Array.isArray(sections.unknown) &&
      Array.isArray(sections.quotes) &&
      Array.isArray(sections.risks) &&
      sections.known.length > 0 &&
      sections.unknown.length > 0 &&
      sections.quotes.length > 0 &&
      sections.risks.length > 0
    );
  }

  private shouldRegenerateCachedSummary(summary: string | null | undefined): boolean {
    if (typeof summary !== 'string') {
      return true;
    }

    const normalized = summary.trim();
    if (!normalized) {
      return true;
    }

    if (normalized.length < SUMMARY_MIN_LENGTH_FOR_CACHE) {
      return true;
    }

    if (this.isLegacySummary(normalized)) {
      return true;
    }

    if (/^resumen no disponible:/i.test(normalized)) {
      return true;
    }

    return false;
  }

  private normalizeSummaryText(
    summary: string,
    context: {
      scrapedContentLength: number;
      usedFallback: boolean;
      rssSnippetDetected: boolean;
    }
  ): string {
    let normalized = typeof summary === 'string' ? summary : '';
    normalized = normalized.replace(/\s+/g, ' ').trim();
    normalized = this.removeLegacySummaryPrefix(normalized);
    normalized = this.removeBannedSummaryPhrases(normalized);

    const isLowQualityInput =
      context.usedFallback ||
      context.rssSnippetDetected ||
      context.scrapedContentLength < 300;

    if (isLowQualityInput) {
      normalized = this.takeFirstSentences(normalized, 2);
      normalized = this.limitSummaryWords(normalized, SUMMARY_MAX_WORDS_LOW_QUALITY);
      normalized = this.removeBannedSummaryPhrases(normalized);
      return normalized || 'El extracto disponible describe el hecho principal sin contexto adicional suficiente.';
    }

    normalized = this.takeFirstSentences(normalized, 5);
    normalized = this.limitSummaryWords(normalized, SUMMARY_MAX_WORDS_FULL);
    normalized = this.removeBannedSummaryPhrases(normalized);
    return normalized || 'No hay evidencia suficiente para un resumen editorial.';
  }

  private buildQualityNotice(context: {
    scrapedContentLength: number;
    usedFallback: boolean;
    rssSnippetDetected: boolean;
  }): string | undefined {
    const isLowQualityInput =
      context.usedFallback ||
      context.rssSnippetDetected ||
      context.scrapedContentLength < 300;

    return isLowQualityInput ? SUMMARY_LOW_QUALITY_NOTICE : undefined;
  }

  private removeLegacySummaryPrefix(summary: string): string {
    if (!summary) {
      return summary;
    }

    return summary.replace(/^resumen provisional basado en contenido interno:\s*/i, '').trim();
  }

  private isLegacySummary(summary: string): boolean {
    return summary.trim().toLowerCase().startsWith(LEGACY_SUMMARY_PREFIX);
  }

  private removeBannedSummaryPhrases(summary: string): string {
    if (!summary) {
      return summary;
    }

    const bannedPatterns = [
      /\bno es una novedad\b[:,]?\s*/gi,
      /\bcabe destacar\b[:,]?\s*/gi,
      /\ben este contexto\b[:,]?\s*/gi,
      /\bseg(?:u|\u00fa)n\s+se\s+desprende\b[:,]?\s*/gi,
      /\bfalta\s+el\s+texto\s+completo\s+para\s+confirmar\s+detalles\b[:,.]?\s*/gi,
      /\bresumen\s+provisional(?:\s+basado\s+en\s+contenido\s+interno)?\b[:,.]?\s*/gi,
      /\bno\s+se\s+puede\s+confirmar\s+detalles\b[:,.]?\s*/gi,
    ];

    let cleaned = summary;
    for (const pattern of bannedPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    return cleaned
      .replace(/\s{2,}/g, ' ')
      .replace(/^[,;:\-]+\s*/g, '')
      .trim();
  }

  private takeFirstSentences(summary: string, maxSentences: number): string {
    if (!summary) {
      return summary;
    }

    const sentences = summary
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);

    if (sentences.length <= maxSentences) {
      return summary.trim();
    }

    return sentences.slice(0, maxSentences).join(' ').trim();
  }

  private limitSummaryWords(summary: string, maxWords: number): string {
    if (!summary) {
      return summary;
    }

    const words = summary.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) {
      return summary.trim();
    }

    return words.slice(0, maxWords).join(' ').trim();
  }

  private alignReliabilityScoreWithVerdict(params: {
    reliabilityScore: number;
    verdict: ArticleAnalysis['factCheck']['verdict'];
    factualityStatus: 'no_determinable' | 'plausible_but_unverified';
    qualityNotice?: string;
  }): number {
    if (params.verdict === 'SupportedByArticle') {
      return this.clampNumber(params.reliabilityScore, 45, 65, 55);
    }

    if (
      params.verdict === 'InsufficientEvidenceInArticle' ||
      params.factualityStatus === 'no_determinable' ||
      typeof params.qualityNotice === 'string'
    ) {
      return this.clampNumber(params.reliabilityScore, 20, 45, 35);
    }

    return this.clampNumber(params.reliabilityScore, 20, 60, 45);
  }

  private ensureDeepSections(
    analysis: ArticleAnalysis,
    context: {
      scrapedContentLength: number;
      usedFallback: boolean;
      rssSnippetDetected: boolean;
      analyzedText: string;
    }
  ): ArticleAnalysis {
    const existingSections = analysis.deep?.sections;
    const known = this.normalizeDeepSectionArray(existingSections?.known, 10);
    const unknown = this.normalizeDeepSectionArray(existingSections?.unknown, 10);
    const risks = this.normalizeDeepSectionArray(existingSections?.risks, 4);
    const quotes = this.normalizeDeepQuotes(
      existingSections?.quotes,
      context.analyzedText,
      analysis.factCheck?.claims ?? []
    );

    if (known.length === 0) {
      known.push(...(analysis.factCheck?.claims ?? []).slice(0, 8));
      if (known.length === 0 && typeof analysis.summary === 'string') {
        known.push(this.limitSummaryWords(analysis.summary, 24));
      }
    }

    const lowQualityInput =
      context.usedFallback ||
      context.rssSnippetDetected ||
      context.scrapedContentLength < 300;
    if (lowQualityInput) {
      unknown.unshift(
        'El contenido disponible es insuficiente (snippet/paywall o texto incompleto), por lo que faltan detalles para confirmar el contexto completo.'
      );
    }
    if (unknown.length === 0) {
      unknown.push('No hay verificacion externa independiente en este analisis.');
    }

    if (risks.length === 0) {
      if (analysis.factualityStatus === 'no_determinable') {
        risks.push('La evidencia interna no permite verificar hechos externos de forma concluyente.');
      }
      if ((analysis.biasIndicators ?? []).length < 2) {
        risks.push('La lectura de sesgo tiene confianza baja por pocos indicios textuales citados.');
      }
      if (risks.length === 0) {
        risks.push('El encuadre puede cambiar con contexto adicional o documentos primarios no incluidos.');
      }
    }

    return {
      ...analysis,
      deep: {
        sections: {
          known: known.slice(0, 10),
          unknown: unknown.slice(0, 10),
          quotes: quotes.slice(0, 4),
          risks: risks.slice(0, 4),
        },
      },
    };
  }

  private normalizeDeepSectionArray(
    items: string[] | undefined,
    maxItems: number,
    maxWords: number = 35
  ): string[] {
    if (!Array.isArray(items)) {
      return [];
    }

    const unique = new Set<string>();
    for (const item of items) {
      if (typeof item !== 'string') {
        continue;
      }
      const compact = item.replace(/\s+/g, ' ').trim();
      if (!compact) {
        continue;
      }
      unique.add(this.limitSummaryWords(compact, maxWords));
      if (unique.size >= maxItems) {
        break;
      }
    }

    return Array.from(unique);
  }

  private normalizeDeepQuotes(
    quotes: string[] | undefined,
    analyzedText: string,
    claims: string[]
  ): string[] {
    const normalizedQuotes = this.normalizeDeepSectionArray(quotes, 4, 24);
    if (normalizedQuotes.length >= 2) {
      return normalizedQuotes;
    }

    const extractedFromText = this.extractCandidateQuotes(analyzedText);
    const extractedFromClaims = this.normalizeDeepSectionArray(claims, 4, 24).map(
      (claim) => `"${claim}"`
    );
    const merged = [...normalizedQuotes, ...extractedFromText, ...extractedFromClaims];
    const unique = new Set<string>();
    for (const quote of merged) {
      const compact = quote.replace(/\s+/g, ' ').trim();
      if (!compact) {
        continue;
      }
      unique.add(this.limitSummaryWords(compact, 24));
      if (unique.size >= 4) {
        break;
      }
    }

    return Array.from(unique);
  }

  private extractCandidateQuotes(text: string): string[] {
    if (!text) {
      return [];
    }

    const matches = text.match(/["'“”][^"'“”]{8,180}["'“”]/g) ?? [];
    const unique = new Set<string>();
    for (const rawMatch of matches) {
      const compact = rawMatch.replace(/\s+/g, ' ').trim();
      if (!compact) {
        continue;
      }
      unique.add(this.limitSummaryWords(compact, 24));
      if (unique.size >= 4) {
        break;
      }
    }

    return Array.from(unique);
  }

  private sanitizeAnalysisTextFields(analysis: ArticleAnalysis): ArticleAnalysis {
    const sanitizeValue = (value: unknown): unknown => {
      if (typeof value === 'string') {
        return this.sanitizePotentialMojibake(value);
      }

      if (Array.isArray(value)) {
        return value.map((entry) => sanitizeValue(entry));
      }

      if (value && typeof value === 'object') {
        const sanitizedRecord: Record<string, unknown> = {};
        for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
          sanitizedRecord[key] = sanitizeValue(nestedValue);
        }
        return sanitizedRecord;
      }

      return value;
    };

    return sanitizeValue(analysis) as ArticleAnalysis;
  }

  private sanitizePotentialMojibake(text: string): string {
    const compact = text.replace(/\s+/g, ' ').trim();
    if (!compact || !/[ÃÂâ]/.test(compact)) {
      return compact;
    }

    try {
      let repaired = compact;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (!/[ÃÂâ]/.test(repaired)) {
          break;
        }
        repaired = Buffer.from(repaired, 'latin1').toString('utf8').trim();
      }

      const replacementMap: Record<string, string> = {
        'Ã¡': '\u00e1',
        'Ã©': '\u00e9',
        'Ã­': '\u00ed',
        'Ã³': '\u00f3',
        'Ãº': '\u00fa',
        'Ã±': '\u00f1',
        'Ã': '\u00c1',
        'Ã‰': '\u00c9',
        'Ã': '\u00cd',
        'Ã“': '\u00d3',
        'Ãš': '\u00da',
        'Ã‘': '\u00d1',
        'Ã¼': '\u00fc',
        'Ãœ': '\u00dc',
      };
      for (const [broken, fixed] of Object.entries(replacementMap)) {
        repaired = repaired.split(broken).join(fixed);
      }

      if (repaired && !repaired.includes('Ã')) {
        return repaired;
      }
    } catch {
      return compact;
    }

    return compact.replace(/Ã/g, '');
  }

  private getAnalysisModeRank(mode: AnalysisMode): number {
    switch (mode) {
      case 'deep':
        return 4;
      case 'standard':
        return 3;
      case 'moderate':
        return 2;
      case 'low_cost':
      default:
        return 1;
    }
  }

  private clampNumber(
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

  /**
   * Analyze multiple unanalyzed articles in batch
   *
   * COST OPTIMIZATION: LÃ­mites defensivos
   * - MÃ¡ximo MAX_BATCH_LIMIT artÃ­culos por lote
   * - Solo procesa artÃ­culos NO analizados (findUnanalyzed)
   * - Cada artÃ­culo individual tiene su propio cachÃ© check
   */
  async executeBatch(input: AnalyzeBatchInput): Promise<AnalyzeBatchOutput> {
    const { limit } = input;

    // COST OPTIMIZATION: LÃ­mite defensivo para evitar costes inesperados
    if (limit <= 0 || limit > MAX_BATCH_LIMIT) {
      throw new ValidationError('Batch limit must be between 1 and 100');
    }

    const unanalyzedArticles = await this.articleRepository.findUnanalyzed(limit);
    console.log(`ðŸ“‹ [Batch] Encontradas ${unanalyzedArticles.length} noticias pendientes.`);

    const results: AnalyzeBatchOutput['results'] = [];
    let successful = 0;
    let failed = 0;

    for (const article of unanalyzedArticles) {
      try {
        await this.execute({ articleId: article.id });
        results.push({ articleId: article.id, success: true });
        successful++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // --- AQUÃ ESTÃ EL CAMBIO CLAVE ---
        console.error(`âŒ [ERROR] FallÃ³ la noticia ID ${article.id}:`);
        console.error(`   ðŸ‘‰ Causa: ${errorMessage}`);
        // ---------------------------------

        // Si el error es de Rate Limit, avisamos
        if (errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
            console.warn(`   âš ï¸ ALERTA: Gemini estÃ¡ saturado. Aumentando tiempo de espera...`);
        }


        results.push({ articleId: article.id, success: false, error: errorMessage });
        failed++;
      }
    }

    return {
      processed: unanalyzedArticles.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Get analysis statistics
   */
  async getStats(): Promise<{
    total: number;
    analyzed: number;
    pending: number;
    percentAnalyzed: number;
    biasDistribution: { left: number; neutral: number; right: number };
  }> {
    const total = await this.articleRepository.count();
    const analyzed = await this.articleRepository.countAnalyzed();
    const pending = total - analyzed;
    const percentAnalyzed = total > 0 ? Math.round((analyzed / total) * 100) : 0;
    const biasDistribution = await this.articleRepository.getBiasDistribution();

    return { total, analyzed, pending, percentAnalyzed, biasDistribution };
  }
}
