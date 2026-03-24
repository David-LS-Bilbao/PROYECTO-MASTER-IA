import { NextFunction, Request, Response } from 'express';
import { ArticleBiasJsonParser } from '../../../application/parsers/ArticleBiasJsonParser';
import { AnalyzeArticleBiasUseCase } from '../../../application/use-cases/bias-analysis/AnalyzeArticleBiasUseCase';
import { AnalyzeFeedBiasUseCase } from '../../../application/use-cases/bias-analysis/AnalyzeFeedBiasUseCase';
import { GetFeedBiasSummaryUseCase } from '../../../application/use-cases/bias-analysis/GetFeedBiasSummaryUseCase';
import { createArticleBiasAIProvider } from '../../ai/createArticleBiasAIProvider';
import { PrismaArticleBiasAnalysisRepository } from '../../database/PrismaArticleBiasAnalysisRepository';
import { PrismaArticleRepository } from '../../database/PrismaArticleRepository';
import { prisma } from '../../database/prismaClient';
import { aiObservabilityService, promptRegistryService, tokenAndCostService } from '../../observability';

const articleRepository = new PrismaArticleRepository(prisma);
const articleBiasAnalysisRepository = new PrismaArticleBiasAnalysisRepository(prisma);
const articleBiasAIProvider = createArticleBiasAIProvider();
const articleBiasJsonParser = new ArticleBiasJsonParser();

const analyzeArticleBiasUseCase = new AnalyzeArticleBiasUseCase(
  articleRepository,
  articleBiasAnalysisRepository,
  articleBiasAIProvider,
  articleBiasJsonParser,
  aiObservabilityService,
  promptRegistryService,
  tokenAndCostService
);

const analyzeFeedBiasUseCase = new AnalyzeFeedBiasUseCase(
  articleRepository,
  analyzeArticleBiasUseCase
);
const getFeedBiasSummaryUseCase = new GetFeedBiasSummaryUseCase(articleRepository);

export class BiasAnalysisController {
  static async analyzeArticle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { articleId } = req.params;
      const requestId = BiasAnalysisController.resolveRequestId(req);
      const result = await analyzeArticleBiasUseCase.execute(articleId, {
        requestId,
        correlationId: BiasAnalysisController.resolveCorrelationId(req, requestId),
        endpoint: `${req.method} ${req.originalUrl}`,
        entityType: 'article',
        entityId: articleId,
        metadata: {
          trigger: 'article_bias_endpoint',
        },
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async analyzeFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { feedId } = req.params;
      const requestId = BiasAnalysisController.resolveRequestId(req);
      const result = await analyzeFeedBiasUseCase.execute(feedId, {
        requestId,
        correlationId: BiasAnalysisController.resolveCorrelationId(req, requestId),
        endpoint: `${req.method} ${req.originalUrl}`,
        entityType: 'feed',
        entityId: feedId,
        metadata: {
          trigger: 'feed_bias_endpoint',
        },
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getArticleBiasAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { articleId } = req.params;
      const analysis = await articleBiasAnalysisRepository.findByArticleId(articleId);

      if (!analysis) {
        res.status(404).json({
          error: 'Domain Error',
          message: `Bias analysis for article ${articleId} not found`,
        });
        return;
      }

      res.json(analysis);
    } catch (error) {
      next(error);
    }
  }

  static async getFeedBiasSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { feedId } = req.params;
      const summary = await getFeedBiasSummaryUseCase.execute(feedId);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }

  private static resolveRequestId(req: Request): string {
    const headerRequestId = req.header('x-request-id');
    if (headerRequestId && headerRequestId.trim().length > 0) {
      return headerRequestId.trim();
    }

    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private static resolveCorrelationId(req: Request, fallbackRequestId?: string): string {
    const headerCorrelationId = req.header('x-correlation-id');
    if (headerCorrelationId && headerCorrelationId.trim().length > 0) {
      return headerCorrelationId.trim();
    }

    return fallbackRequestId ?? this.resolveRequestId(req);
  }
}
