/**
 * AnalyzeArticleUseCase (Application Layer)
 * Analiza artículos con Gemini AI para detectar sesgo, veracidad y generar resúmenes.
 *
 * === COST OPTIMIZATION (Sprint 8) ===
 *
 * CACHÉ DE ANÁLISIS (ya implementado):
 * - Los análisis se persisten en PostgreSQL (campos: summary, biasScore, analysis, analyzedAt)
 * - Si article.isAnalyzed === true, se devuelve el análisis cacheado SIN llamar a Gemini
 * - Ubicación del caché: líneas 70-83 (check isAnalyzed → return cached)
 *
 * LÍMITES DEFENSIVOS:
 * - Batch limit: máximo 100 artículos por lote (línea 234)
 * - No hay llamadas a Gemini dentro de bucles sin control
 * - El bucle de batch solo procesa artículos NO analizados (findUnanalyzed)
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
 * Máximo de artículos por lote en análisis batch.
 * Límite defensivo para evitar costes inesperados.
 */
const MAX_BATCH_LIMIT = 100;

/**
 * Mínimo de caracteres para considerar contenido válido.
 * Contenido muy corto no justifica una llamada a Gemini.
 */
const MIN_CONTENT_LENGTH = 100;
const AUTO_LOW_COST_CONTENT_THRESHOLD = 800;


export interface AnalyzeArticleInput {
  articleId: string;
  analysisMode?: AnalysisMode;
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
    const requestedAnalysisMode = this.normalizeAnalysisMode(input.analysisMode);

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

    console.log(`\n🔍 [Análisis] Iniciando noticia: "${article.title}"`);

    // =========================================================================
    // SPRINT 17: COST OPTIMIZATION - CACHÉ GLOBAL DE ANÁLISIS
    // =========================================================================
    // Si el artículo ya fue analizado por CUALQUIER usuario, devolvemos el
    // análisis cacheado en PostgreSQL SIN llamar a Gemini.
    //
    // BENEFICIO: Si 100 usuarios piden análisis del mismo artículo:
    // - Primera petición: 1 llamada a Gemini ✅
    // - Siguientes 99: 0 llamadas a Gemini → 99% ahorro 💰
    //
    // El caché es GLOBAL (no por usuario) porque el análisis es objetivo
    // sobre el contenido de la noticia, no subjetivo al perfil del usuario.
    // =========================================================================
    if (article.isAnalyzed) {
      const existingAnalysis = article.getParsedAnalysis();
      if (existingAnalysis) {
        const cachedContentLength = article.content?.length || 0;
        const requiredModeForCache = cachedContentLength < AUTO_LOW_COST_CONTENT_THRESHOLD
          ? 'low_cost'
          : requestedAnalysisMode;
        const shouldUpgradeCachedAnalysis = this.requiresAnalysisUpgrade(
          existingAnalysis,
          requiredModeForCache
        );

        if (!shouldUpgradeCachedAnalysis) {
          const normalizedAnalysis = this.normalizeAnalysis(existingAnalysis, {
            scrapedContentLength: article.content?.length || 0,
            usedFallback: false,
            analyzedText: article.content || '',
            analysisModeUsed: this.normalizeAnalysisMode(existingAnalysis.analysisModeUsed),
            articleCategory: article.category,
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
            summary: article.summary ?? normalizedAnalysis.summary,
            biasScore: normalizedAnalysis.biasScoreNormalized,
            analysis: normalizedAnalysis,
            scrapedContentLength: article.content?.length || 0,
          };
        }

        console.log(
          `   [CACHE GLOBAL] Se fuerza re-analisis por upgrade de modo (${requiredModeForCache}).`
        );
      }
    }

    // 3. Scrape full content if needed
    let contentToAnalyze = article.content;
    let scrapedContentLength = contentToAnalyze?.length || 0;
    let usedFallback = false;

    // COST OPTIMIZATION: Verificar si el contenido justifica una llamada a Gemini
    // Contenido muy corto (<MIN_CONTENT_LENGTH chars) no vale la pena analizar
    const isContentInvalid =
      !contentToAnalyze ||
      contentToAnalyze.length < MIN_CONTENT_LENGTH ||
      contentToAnalyze.includes('JinaReader API Error');

    if (isContentInvalid) {
      console.log(`   🌐 Scraping contenido con Jina Reader (URL: ${article.url})...`);
      
      try {
        const scrapedData = await this.jinaReaderClient.scrapeUrl(article.url);
        
        if (scrapedData.content && scrapedData.content.length >= MIN_CONTENT_LENGTH) {
          contentToAnalyze = scrapedData.content;
          scrapedContentLength = scrapedData.content.length;
          console.log(`   ✅ Scraping OK (${scrapedContentLength} caracteres).`);

          // Update article with scraped content
          let articleWithContent = article.withFullContent(scrapedData.content);
          
          // Enrich with image URL if article doesn't have one
          if (!article.urlToImage && scrapedData.imageUrl) {
            console.log(`   🖼️  Imagen detectada: ${scrapedData.imageUrl}`);
            articleWithContent = articleWithContent.withImage(scrapedData.imageUrl);
          }
          
          await this.articleRepository.save(articleWithContent);
        } else {
          throw new Error('Contenido scrapeado vacío o muy corto');
        }
      } catch (scrapingError) {
        // FALLBACK: Usar título + descripción
        console.warn(`   ⚠️ Scraping falló. Usando FALLBACK (título + descripción).`);
        console.warn(`   👉 Razón: ${scrapingError instanceof Error ? scrapingError.message : 'Error desconocido'}`);
        
        const fallbackContent = `${article.title}\n\n${article.description || 'Sin descripción disponible'}`;
        contentToAnalyze = fallbackContent;
        scrapedContentLength = 0; // Indicar que no se hizo scraping
        usedFallback = true;
      }
    } else {
        console.log(`   📂 Usando contenido existente en DB.`);
    }

    // 3.5. Extract image metadata if article doesn't have one (BEFORE Gemini analysis)
    if (!article.urlToImage) {
      console.log(`   🖼️  Extrayendo metadata de imagen (timeout 2s)...`);
      try {
        const metadata = await this.metadataExtractor.extractMetadata(article.url);
        const imageUrl = this.metadataExtractor.getBestImageUrl(metadata);
        
        if (imageUrl) {
          console.log(`   ✅ Imagen encontrada: ${imageUrl.substring(0, 60)}...`);
          // Update article with image URL
          const articleWithImage = article.withImage(imageUrl);
          await this.articleRepository.save(articleWithImage);
          // Update local reference for next steps
          article = articleWithImage;
        } else {
          console.log(`   ⚠️  No se encontró og:image en la página.`);
        }
      } catch (metadataError) {
        console.warn(`   ⚠️  Metadata extraction falló (continuando sin imagen): ${metadataError instanceof Error ? metadataError.message : 'Error desconocido'}`);
        // Continue without image - not a critical error
      }
    } else {
      console.log(`   🖼️  Artículo ya tiene imagen.`);
    }

    // 4. Analyze with Gemini
    console.log(`   🤖 [NUEVA ANÁLISIS] Generando análisis con IA (este resultado se cacheará globalmente)...`);
    
    // Si usamos fallback, ajustar el prompt
    let adjustedContent = contentToAnalyze || '';
    if (usedFallback) {
      adjustedContent = `ADVERTENCIA: No se pudo acceder al artículo completo. Realiza el análisis basándote ÚNICAMENTE en el título y el resumen disponibles. Indica explícitamente en tu respuesta que el análisis es preliminar por falta de acceso a la fuente original.\n\n${contentToAnalyze || ''}`;
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
        analyzedText: contentToAnalyze || '',
        analysisModeUsed: effectiveAnalysisMode,
        articleCategory: article.category,
      });
      console.log(`   ✅ Gemini OK. Score: ${analysis.biasScore} | Summary: ${analysis.summary.substring(0, 30)}...`);
    } catch (error) {
      // Map Gemini errors for observability (AI_RULES.md compliance)
      const mappedError = GeminiErrorMapper.toExternalAPIError(error);
      console.error(`   ❌ Gemini analysis failed: ${mappedError.message}`);
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
      console.log(`   🔗 Generando embedding para búsqueda semántica...`);

      // Combine relevant text for embedding
      const textToEmbed = `${article.title}. ${article.description || ''}. ${analysis.summary || ''}`;

      // Generate embedding with Gemini (wrapped with error mapping)
      let embedding: number[];
      try {
        embedding = await this.geminiClient.generateEmbedding(textToEmbed);
      } catch (error) {
        const mappedError = GeminiErrorMapper.toExternalAPIError(error);
        console.error(`   ❌ Gemini embedding failed: ${mappedError.message}`);
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

      console.log(`   ✅ Embedding almacenado en pgvector OK`);
    } catch (indexError) {
      // Non-blocking: log error but don't fail the analysis
      console.warn(`   ⚠️ Almacenamiento de embedding falló (análisis completado): ${indexError instanceof Error ? indexError.message : 'Error desconocido'}`);
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

    const rawBiasIndicators = Array.isArray(analysis.biasIndicators)
      ? analysis.biasIndicators
      : [];
    const hasCalibratedBiasSignals = this.hasThreeQuotedBiasIndicators(rawBiasIndicators);
    const biasRaw = hasCalibratedBiasSignals ? parsedBiasRaw : 0;
    const biasScoreNormalized = hasCalibratedBiasSignals ? parsedBiasScoreNormalized : 0;
    const biasType = hasCalibratedBiasSignals ? analysis.biasType : 'ninguno';
    const biasIndicators = hasCalibratedBiasSignals ? rawBiasIndicators : [];

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
    const factualityStatus = analysis.factualityStatus ?? 'no_determinable';
    const evidenceNeeded = Array.isArray(analysis.evidence_needed)
      ? analysis.evidence_needed.slice(0, 4)
      : [];
    const hasIdeologicalEvidence =
      hasCalibratedBiasSignals &&
      scrapedContentLength >= 800 &&
      biasIndicators.length >= 3 &&
      traceabilityScore >= 40;
    const parsedArticleLeaning = this.normalizeArticleLeaning(
      analysis.articleLeaning ?? analysis.biasLeaning
    );
    const articleLeaning = hasIdeologicalEvidence
      ? this.enforceExtremistRule(
          parsedArticleLeaning ?? 'indeterminada',
          biasIndicators
        )
      : 'indeterminada';
    const biasComment = this.buildBiasComment({
      shouldForceIndeterminateBias: !hasIdeologicalEvidence,
      biasIndicators,
      articleLeaning,
    });
    const reliabilityComment = this.buildReliabilityComment({
      reliabilityScore,
      traceabilityScore,
      factualityStatus,
      evidenceNeeded,
    });

    const claims = Array.isArray(analysis.factCheck?.claims)
      ? analysis.factCheck.claims.slice(0, 5)
      : [];
    const clickbaitScore = this.clampNumber(analysis.clickbaitScore, 0, 100, 0);
    const inferredEscalation =
      traceabilityScore <= 25 &&
      reliabilityScore <= 45 &&
      claims.some((claim) => /\b(todo|siempre|nunca|100%|definitivo)\b/i.test(claim));
    const lowCostEscalation = this.shouldEscalateLowCostStrongClaims({
      scrapedContentLength,
      usedFallback: context?.usedFallback === true,
      claims,
      summary: analysis.summary,
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
      summary: analysis.summary,
      reliabilityScore,
      traceabilityScore,
    });
    const forceInsufficientEvidenceVerdict = this.shouldForceInsufficientVerdict({
      scrapedContentLength,
      usedFallback: context?.usedFallback === true,
    });
    const explanation =
      biasRaw === 0 && biasIndicators.length === 0
        ? 'No se detectaron senales suficientes de sesgo con evidencia citada.'
        : analysis.explanation;

    return {
      ...analysis,
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
      biasLeaning: this.toLegacyBiasLeaning(articleLeaning),
      reliabilityComment,
      explanation,
      analysisModeUsed,
      clickbaitScore,
      factCheck: {
        claims,
        verdict:
          forceInsufficientEvidenceVerdict || claims.length === 0
            ? 'InsufficientEvidenceInArticle'
            : this.normalizeFactCheckVerdict(analysis.factCheck?.verdict),
        reasoning:
          typeof analysis.factCheck?.reasoning === 'string'
            ? analysis.factCheck.reasoning
            : 'Sin informacion suficiente para verificar',
      },
    };
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
    if (indicators.length < 3) {
      return false;
    }

    const citationPattern = /["'`][^"'`]{3,140}["'`]|\([^()]{3,120}\)|\[[^\[\]]{3,120}\]/;
    return indicators.slice(0, 3).every((indicator) => citationPattern.test(indicator));
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
    biasIndicators: string[];
    articleLeaning: 'progresista' | 'conservadora' | 'extremista' | 'neutral' | 'indeterminada';
  }): string {
    if (params.shouldForceIndeterminateBias) {
      return this.normalizeUiComment(
        'No hay suficientes señales citadas para inferir una tendencia ideológica y, con este nivel de evidencia interna, el sesgo se mantiene indeterminado'
      );
    }

    const citedSignals = params.biasIndicators
      .slice(0, 3)
      .map((indicator) => this.summarizeIndicator(indicator))
      .join('; ');
    const leaningText =
      params.articleLeaning === 'indeterminada'
        ? 'sin tendencia ideológica concluyente'
        : `con tendencia ${params.articleLeaning}`;
    const generated = `El encuadre refleja ${leaningText} según señales citadas (${citedSignals}), evaluadas solo desde el texto disponible y sin inferir hechos externos`;

    return this.normalizeUiComment(generated);
  }

  private buildReliabilityComment(params: {
    reliabilityScore: number;
    traceabilityScore: number;
    factualityStatus: 'no_determinable' | 'plausible_but_unverified';
    evidenceNeeded: string[];
  }): string {
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
    const traceabilityText =
      params.traceabilityScore >= 70
        ? 'hay trazabilidad clara de citas, fuentes y contexto'
        : params.traceabilityScore >= 40
          ? 'la trazabilidad es parcial y la atribución es limitada'
          : 'la trazabilidad interna es débil por falta de atribuciones claras';
    const summarizedEvidence = this.summarizeEvidenceNeeded(params.evidenceNeeded);
    const noteParts: string[] = [];
    if (params.factualityStatus === 'no_determinable') {
      noteParts.push('no verificable con fuentes internas');
    }
    if (summarizedEvidence.length > 0) {
      noteParts.push(`faltan ${this.joinAsNaturalList(summarizedEvidence)}`);
    }

    const sentenceOne = `La fiabilidad interna es ${reliabilityBand} porque ${traceabilityText}.`;
    const sentenceTwo =
      noteParts.length > 0 ? `Nota: ${noteParts.join('; ')}.` : '';
    const generated = sentenceTwo ? `${sentenceOne} ${sentenceTwo}` : sentenceOne;
    if (generated.length <= 220) {
      return generated;
    }

    const compactSentenceOne =
      params.traceabilityScore >= 70
        ? `Fiabilidad interna ${reliabilityBand} por citas y atribuciones claras.`
        : params.traceabilityScore >= 40
          ? `Fiabilidad interna ${reliabilityBand} por atribución parcial.`
          : `Fiabilidad interna ${reliabilityBand} por atribución débil.`;
    const compactNoteParts: string[] = [];
    if (params.factualityStatus === 'no_determinable') {
      compactNoteParts.push('no verificable con fuentes internas');
    }
    if (summarizedEvidence.length > 0) {
      compactNoteParts.push(`faltan ${this.joinAsNaturalList(summarizedEvidence)}`);
    }
    const compactSentenceTwo =
      compactNoteParts.length > 0
        ? `Nota: ${compactNoteParts.join('; ')}.`
        : '';
    const compactComment = compactSentenceTwo
      ? `${compactSentenceOne} ${compactSentenceTwo}`
      : compactSentenceOne;
    if (compactComment.length <= 220) {
      return compactComment;
    }

    if (params.factualityStatus === 'no_determinable') {
      return 'Fiabilidad interna limitada; no verificable con fuentes internas.';
    }

    return compactSentenceOne.length <= 220
      ? compactSentenceOne
      : 'Fiabilidad interna limitada por evidencia textual insuficiente.';
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

  private summarizeEvidenceNeeded(evidenceNeeded: string[]): string[] {
    const summarized: string[] = [];
    const seen = new Set<string>();

    for (const rawItem of evidenceNeeded.slice(0, 2)) {
      const normalized = rawItem
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[;:,.]+$/g, '')
        .replace(/[()[\]{}]/g, '');
      if (!normalized) {
        continue;
      }

      const words = normalized.split(' ').filter(Boolean);
      const compact =
        words.length <= 4 && normalized.length <= 44
          ? normalized
          : words.slice(0, 4).join(' ');
      const dedupeKey = compact.toLowerCase();
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      summarized.push(compact);
    }

    return summarized;
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
    return /\b(siempre|nunca|todo esta|todo está|demuestra|100%|sin duda|definitivo|inminente)\b/i.test(
      text
    );
  }

  private hasHighRiskClaim(text: string): boolean {
    return /\b(cura|tratamiento definitivo|fraude electoral|colapso bancario|quiebra|ataque terrorista|amenaza inminente|murio|murieron|fallecio|fallecieron|guerra|violencia)\b/i.test(
      text
    );
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
    const hasStrongClaim = /\b(siempre|nunca|todo esta|todo está|demuestra|100%|sin duda|definitivo|urgente|esc[áa]ndalo|bomba|inminente)\b/i.test(
      claimsText
    );
    if (!hasStrongClaim) {
      return false;
    }

    const hasAttribution = /\b(seg[uú]n|according to|de acuerdo con|afirm[oó]|inform[oó]|report[oó]|ministerio|universidad|instituto|documento|informe)\b|https?:\/\/\S+|www\.\S+/i.test(
      params.analyzedText
    );
    return !hasAttribution;
  }

  private normalizeAnalysisMode(value: unknown): AnalysisMode {
    if (value === 'moderate' || value === 'standard' || value === 'low_cost') {
      return value;
    }

    return 'low_cost';
  }

  private resolveEffectiveAnalysisMode(params: {
    requestedMode: AnalysisMode;
    scrapedContentLength: number;
    usedFallback: boolean;
  }): AnalysisMode {
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

  private getAnalysisModeRank(mode: AnalysisMode): number {
    switch (mode) {
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
   * COST OPTIMIZATION: Límites defensivos
   * - Máximo MAX_BATCH_LIMIT artículos por lote
   * - Solo procesa artículos NO analizados (findUnanalyzed)
   * - Cada artículo individual tiene su propio caché check
   */
  async executeBatch(input: AnalyzeBatchInput): Promise<AnalyzeBatchOutput> {
    const { limit } = input;

    // COST OPTIMIZATION: Límite defensivo para evitar costes inesperados
    if (limit <= 0 || limit > MAX_BATCH_LIMIT) {
      throw new ValidationError('Batch limit must be between 1 and 100');
    }

    const unanalyzedArticles = await this.articleRepository.findUnanalyzed(limit);
    console.log(`📋 [Batch] Encontradas ${unanalyzedArticles.length} noticias pendientes.`);

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
        
        // --- AQUÍ ESTÁ EL CAMBIO CLAVE ---
        console.error(`❌ [ERROR] Falló la noticia ID ${article.id}:`);
        console.error(`   👉 Causa: ${errorMessage}`);
        // ---------------------------------

        // Si el error es de Rate Limit, avisamos
        if (errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
            console.warn(`   ⚠️ ALERTA: Gemini está saturado. Aumentando tiempo de espera...`);
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
