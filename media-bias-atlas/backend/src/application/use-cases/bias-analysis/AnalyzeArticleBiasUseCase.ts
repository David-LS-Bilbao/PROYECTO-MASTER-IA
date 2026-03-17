import { ArticleBiasAnalysis, BiasAnalysisStatus } from '../../../domain/entities/ArticleBiasAnalysis';
import { IArticleRepository } from '../../../domain/repositories/IArticleRepository';
import { IArticleBiasAnalysisRepository } from '../../../domain/repositories/IArticleBiasAnalysisRepository';
import { IArticleBiasAIProvider } from '../../contracts/IArticleBiasAIProvider';
import { ArticleBiasJsonParser } from '../../parsers/ArticleBiasJsonParser';

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
    private readonly articleBiasJsonParser: ArticleBiasJsonParser
  ) {}

  async execute(articleId: string): Promise<AnalyzeArticleBiasResult> {
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

    try {
      const providerResponse = await this.articleBiasAIProvider.analyzeArticle({
        articleId: article.id,
        title: article.title.trim(),
        url: article.url,
        publishedAt: article.publishedAt.toISOString(),
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

        return {
          analysis: completedAnalysis,
          reusedExisting: false,
          invokedAI: true,
        };
      } catch (error) {
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
}
