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
import { IGeminiClient } from '../../domain/services/gemini-client.interface';
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


export interface AnalyzeArticleInput {
  articleId: string;
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
        const normalizedAnalysis = this.normalizeAnalysis(existingAnalysis, {
          scrapedContentLength: article.content?.length || 0,
          usedFallback: false,
          analyzedText: article.content || '',
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
    
    let analysis: ArticleAnalysis;
    try {
      analysis = await this.geminiClient.analyzeArticle({
        title: article.title,
        content: adjustedContent,
        source: article.source,
        language: article.language,
      });
      analysis = this.normalizeAnalysis(analysis, {
        scrapedContentLength,
        usedFallback,
        analyzedText: contentToAnalyze || '',
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
      ? analysis.evidence_needed
      : [];
    const shouldForceIndeterminateBias =
      !hasCalibratedBiasSignals || scrapedContentLength < 800;
    const parsedBiasLeaning = this.normalizeBiasLeaning(analysis.biasLeaning);
    const biasLeaning = shouldForceIndeterminateBias
      ? 'indeterminada'
      : (parsedBiasLeaning ?? 'indeterminada');
    const biasComment = this.buildBiasComment({
      shouldForceIndeterminateBias,
      biasIndicators,
      biasLeaning,
    });
    const reliabilityComment = this.buildReliabilityComment({
      reliabilityScore,
      traceabilityScore,
      factualityStatus,
      evidenceNeeded,
    });

    const claims = Array.isArray(analysis.factCheck?.claims) ? analysis.factCheck.claims : [];
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
    const shouldEscalate =
      (typeof analysis.should_escalate === 'boolean'
        ? analysis.should_escalate
        : inferredEscalation) || lowCostEscalation;
    const explanation =
      biasRaw === 0 && biasIndicators.length === 0
        ? 'No se detectaron señales suficientes de sesgo con evidencia citada.'
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
      biasLeaning,
      reliabilityComment,
      explanation,
      clickbaitScore: this.clampNumber(analysis.clickbaitScore, 0, 100, 0),
      factCheck: {
        claims,
        verdict: analysis.factCheck?.verdict ?? 'InsufficientEvidenceInArticle',
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

  private normalizeBiasLeaning(
    value: unknown
  ): 'progresista' | 'conservadora' | 'neutral' | 'indeterminada' | 'otra' | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    const validValues = [
      'progresista',
      'conservadora',
      'neutral',
      'indeterminada',
      'otra',
    ];

    if ((validValues as string[]).includes(normalized)) {
      return normalized as 'progresista' | 'conservadora' | 'neutral' | 'indeterminada' | 'otra';
    }

    return undefined;
  }

  private buildBiasComment(params: {
    shouldForceIndeterminateBias: boolean;
    biasIndicators: string[];
    biasLeaning: 'progresista' | 'conservadora' | 'neutral' | 'indeterminada' | 'otra';
  }): string {
    if (params.shouldForceIndeterminateBias) {
      return this.normalizeUiComment(
        'No hay suficientes senales citadas para inferir una tendencia ideologica y, con este nivel de evidencia interna, el sesgo se mantiene indeterminado'
      );
    }

    const citedSignals = params.biasIndicators
      .slice(0, 3)
      .map((indicator) => this.summarizeIndicator(indicator))
      .join('; ');
    const leaningText =
      params.biasLeaning === 'indeterminada'
        ? 'sin tendencia ideologica concluyente'
        : `con tendencia ${params.biasLeaning}`;
    const generated = `El encuadre refleja ${leaningText} segun senales citadas (${citedSignals}), evaluadas solo desde el texto disponible y sin inferir hechos externos`;

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
        ? 'hay buena trazabilidad de citas, fuentes y contexto'
        : params.traceabilityScore >= 40
          ? 'la trazabilidad es parcial y con atribuciones limitadas'
          : 'la trazabilidad interna es debil por falta de atribuciones claras';
    const missingEvidence = params.evidenceNeeded.slice(0, 2);
    const missingEvidenceText =
      missingEvidence.length > 0 ? `; faltan ${missingEvidence.join(' y ')}` : '';
    const factualityText =
      params.factualityStatus === 'no_determinable'
        ? '; no verificable con fuentes internas'
        : '';
    const generated = `La fiabilidad interna es ${reliabilityBand} porque ${traceabilityText}${factualityText}${missingEvidenceText}, considerando solo citas, datos y atribuciones presentes en el articulo`;

    return this.normalizeUiComment(generated);
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

  private shouldEscalateLowCostStrongClaims(params: {
    scrapedContentLength: number;
    usedFallback: boolean;
    claims: string[];
    summary: string;
    analyzedText: string;
  }): boolean {
    const isLowCostContext =
      params.usedFallback || params.scrapedContentLength < 800;
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
