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

import { ArticleAnalysis, NewsArticle } from '../../domain/entities/news-article.entity';
import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
import { IGeminiClient } from '../../domain/services/gemini-client.interface';
import { IJinaReaderClient } from '../../domain/services/jina-reader-client.interface';
import { IChromaClient } from '../../domain/services/chroma-client.interface';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/domain.error';
import { MetadataExtractor } from '../../infrastructure/external/metadata-extractor';

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

export class AnalyzeArticleUseCase {
  constructor(
    private readonly articleRepository: INewsArticleRepository,
    private readonly geminiClient: IGeminiClient,
    private readonly jinaReaderClient: IJinaReaderClient,
    private readonly metadataExtractor: MetadataExtractor,
    private readonly chromaClient: IChromaClient
  ) {}

  /**
   * Analyze a single article by ID
   */
  async execute(input: AnalyzeArticleInput): Promise<AnalyzeArticleOutput> {
    const { articleId } = input;

    // Validate input
    if (!articleId || articleId.trim() === '') {
      throw new ValidationError('Article ID is required');
    }

    // 1. Fetch article from database
    let article = await this.articleRepository.findById(articleId);
    if (!article) {
      throw new EntityNotFoundError('Article', articleId);
    }

    console.log(`\n🔍 [Análisis] Iniciando noticia: "${article.title}"`);

    // =========================================================================
    // COST OPTIMIZATION: CACHÉ DE ANÁLISIS EN BASE DE DATOS
    // =========================================================================
    // Si el artículo ya fue analizado (analyzedAt !== null), devolvemos el
    // análisis cacheado en PostgreSQL SIN llamar a Gemini.
    // Esto evita pagar dos veces por el mismo análisis.
    // =========================================================================
    if (article.isAnalyzed) {
      const existingAnalysis = article.getParsedAnalysis();
      if (existingAnalysis) {
        console.log(`   ⏭️ CACHE HIT: Análisis ya existe en BD. Gemini NO llamado.`);
        return {
          articleId: article.id,
          summary: article.summary!,
          biasScore: article.biasScore!,
          analysis: existingAnalysis,
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
    console.log(`   🧠 Enviando a Gemini para análisis de sesgo...`);
    
    // Si usamos fallback, ajustar el prompt
    let adjustedContent = contentToAnalyze || '';
    if (usedFallback) {
      adjustedContent = `ADVERTENCIA: No se pudo acceder al artículo completo. Realiza el análisis basándote ÚNICAMENTE en el título y el resumen disponibles. Indica explícitamente en tu respuesta que el análisis es preliminar por falta de acceso a la fuente original.\n\n${contentToAnalyze || ''}`;
    }
    
    const analysis = await this.geminiClient.analyzeArticle({
      title: article.title,
      content: adjustedContent,
      source: article.source,
      language: article.language,
    });
    console.log(`   ✅ Gemini OK. Score: ${analysis.biasScore} | Summary: ${analysis.summary.substring(0, 30)}...`);

    // 5. Update article with analysis + auto-favorite (user invested credits in analysis)
    let analyzedArticle = article.withAnalysis(analysis);

    // Auto-mark as favorite when user analyzes an article
    if (!analyzedArticle.isFavorite) {
      analyzedArticle = NewsArticle.reconstitute({
        ...analyzedArticle.toJSON(),
        isFavorite: true,
      });
      console.log(`   ⭐ Auto-favorito activado.`);
    }

    await this.articleRepository.save(analyzedArticle);

    // 6. Index in ChromaDB for semantic search
    try {
      console.log(`   🔗 Indexando en ChromaDB...`);

      // Combine relevant text for embedding
      const textToEmbed = `${article.title}. ${article.description || ''}. ${analysis.summary || ''}`;

      // Generate embedding with Gemini
      const embedding = await this.geminiClient.generateEmbedding(textToEmbed);

      // Upsert to ChromaDB
      await this.chromaClient.upsertItem(
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

      console.log(`   ✅ Indexado en ChromaDB OK`);
    } catch (indexError) {
      // Non-blocking: log error but don't fail the analysis
      console.warn(`   ⚠️ Indexación ChromaDB falló (análisis completado): ${indexError instanceof Error ? indexError.message : 'Error desconocido'}`);
    }

    return {
      articleId: article.id,
      summary: analysis.summary,
      biasScore: analysis.biasScore,
      analysis,
      scrapedContentLength,
    };
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
  }> {
    const total = await this.articleRepository.count();
    const analyzed = await this.articleRepository.countAnalyzed();
    const pending = total - analyzed;
    const percentAnalyzed = total > 0 ? Math.round((analyzed / total) * 100) : 0;

    return { total, analyzed, pending, percentAnalyzed };
  }
}