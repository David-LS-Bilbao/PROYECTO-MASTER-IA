/**
 * AnalyzeArticleUseCase (DEBUG VERSION)
 * Con logs detallados para encontrar el fallo.
 */

import { ArticleAnalysis } from '../../domain/entities/news-article.entity';
import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
import { IGeminiClient } from '../../domain/services/gemini-client.interface';
import { IJinaReaderClient } from '../../domain/services/jina-reader-client.interface';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/domain.error';
import { ExternalAPIError } from '../../domain/errors/infrastructure.error';



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
    private readonly jinaReaderClient: IJinaReaderClient
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
    const article = await this.articleRepository.findById(articleId);
    if (!article) {
      throw new EntityNotFoundError('Article', articleId);
    }

    console.log(`\n🔍 [Análisis] Iniciando noticia: "${article.title}"`);

    // 2. Check if already analyzed
    if (article.isAnalyzed) {
      const existingAnalysis = article.getParsedAnalysis();
      if (existingAnalysis) {
        console.log(`   ⏭️ Ya analizada previamente. Saltando.`);
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

    if (!contentToAnalyze || contentToAnalyze.length < 100) {
      console.log(`   🌐 Scraping contenido con Jina Reader (URL: ${article.url})...`);
      const scrapedContent = await this.scrapeArticleContent(article.url);
      
      if (!scrapedContent) throw new Error("Jina devolvió contenido vacío");
      
      contentToAnalyze = scrapedContent;
      scrapedContentLength = scrapedContent.length;
      console.log(`   ✅ Scraping OK (${scrapedContentLength} caracteres).`);

      // Update article with scraped content
      const articleWithContent = article.withFullContent(scrapedContent);
      await this.articleRepository.save(articleWithContent);
    } else {
        console.log(`   📂 Usando contenido existente en DB.`);
    }

    // 4. Analyze with Gemini
    console.log(`   🧠 Enviando a Gemini para análisis de sesgo...`);
    const analysis = await this.geminiClient.analyzeArticle({
      title: article.title,
      content: contentToAnalyze,
      source: article.source,
      language: article.language,
    });
    console.log(`   ✅ Gemini OK. Score: ${analysis.biasScore} | Summary: ${analysis.summary.substring(0, 30)}...`);

    // 5. Update article with analysis
    const analyzedArticle = article.withAnalysis(analysis);
    await this.articleRepository.save(analyzedArticle);

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
   */
  async executeBatch(input: AnalyzeBatchInput): Promise<AnalyzeBatchOutput> {
    const { limit } = input;

    if (limit <= 0 || limit > 100) {
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

  /**
   * Scrape article content using Jina Reader
   */
  private async scrapeArticleContent(url: string): Promise<string> {
    try {
      const scraped = await this.jinaReaderClient.scrapeUrl(url);
      return scraped.content;
    } catch (error) {
      if (error instanceof ExternalAPIError) {
        throw error;
      }
      throw new ExternalAPIError(
        'JinaReader',
        `Failed to scrape URL: ${url}`,
        500,
        error as Error
      );
    }
  }
}