/**
 * Analyze Controller (Infrastructure/Presentation Layer)
 * Handles HTTP requests for article analysis
 *
 * DEUDA TÉCNICA #7 (Sprint 14): Error handling centralizado
 * - ✅ Eliminados try-catch redundantes (capturados por asyncHandler)
 * - ✅ Removido handleError privado (duplicado del middleware global errorHandler)
 * - ✅ Los errores se propagan automáticamente al middleware errorHandler
 * - ✅ Implementación más limpia y mantenible
 */

import { Request, Response } from 'express';
import { AnalyzeArticleUseCase } from '../../../application/use-cases/analyze-article.usecase';
import { analyzeArticleSchema, analyzeBatchSchema } from '../schemas/analyze.schema';
import { UserStatsTracker } from '../../monitoring/user-stats-tracker';

export class AnalyzeController {
  constructor(private readonly analyzeArticleUseCase: AnalyzeArticleUseCase) {}

  /**
   * POST /api/analyze/article
   * Analyze a single article by ID
   *
   * Los errores se propagan automáticamente al middleware errorHandler:
   * - ZodError (invalid input) → 400 Bad Request
   * - EntityNotFoundError (article not found) → 404 Not Found
   * - ValidationError → 400 Bad Request
   * - ExternalAPIError (Gemini, etc.) → 503 Service Unavailable
   * - QuotaExceededError → 429 Too Many Requests (Sprint 14)
   * - Otros DomainErrors → según su httpStatusCode
   * - Unknown errors → 500 Internal Server Error
   */
  async analyzeArticle(req: Request, res: Response): Promise<void> {
    console.log(`\n[AnalyzeController] 🟣 POST /api/analyze/article received`);
    console.log(`[AnalyzeController]    Body:`, req.body);
    console.log(`[AnalyzeController]    User: ${req.user?.email || 'anonymous'} (uid: ${req.user?.uid?.substring(0, 8) || 'N/A'}...)`);

    // Validate request body with Zod (Shift Left Security)
    // Si hay error, Zod lanza ZodError que captura asyncHandler → errorHandler
    const validatedInput = analyzeArticleSchema.parse(req.body);
    console.log(`[AnalyzeController]    ✅ Validation passed`);

    // Sprint 14: Pass user to use case for quota enforcement
    const input = {
      ...validatedInput,
      user: req.user
        ? {
            id: req.user.uid,
            plan: req.user.plan,
            usageStats: req.user.usageStats
              ? {
                  articlesAnalyzed: req.user.usageStats.currentMonthUsage,
                  chatMessages: 0, // No disponible en auth middleware
                  searchesPerformed: 0, // No disponible en auth middleware
                }
              : null,
          }
        : undefined,
    };

    console.log(`[AnalyzeController]    📞 Calling use case for article: ${input.articleId.substring(0, 8)}...`);

    // Execute use case
    // Cualquier error (EntityNotFoundError, ExternalAPIError, QuotaExceededError, etc.) se propaga
    const result = await this.analyzeArticleUseCase.execute(input);
    console.log(`[AnalyzeController]    ✅ Use case returned result:`, {
      articleId: result.articleId.substring(0, 8),
      summary: result.summary?.substring(0, 40),
      biasScore: result.biasScore,
    });

    // Track user stats (if authenticated, non-blocking)
    if (req.user?.uid) {
      UserStatsTracker.incrementArticlesAnalyzed(req.user.uid, 1).catch(err =>
        console.error('[AnalyzeController] Failed to track article analysis:', err)
      );
    }

    // Exclude internal_reasoning from analysis object (AI_RULES.md: XAI auditing only)
    const { internal_reasoning, ...publicAnalysis } = result.analysis;

    console.log(`[AnalyzeController]    📤 Sending response (200 OK)`);

    res.status(200).json({
      success: true,
      data: {
        ...result,
        analysis: publicAnalysis,
      },
      message: 'Article analyzed successfully',
    });
  }

  /**
   * POST /api/analyze/batch
   * Analyze multiple unanalyzed articles
   */
  async analyzeBatch(req: Request, res: Response): Promise<void> {
    // Validate request body with Zod
    const validatedInput = analyzeBatchSchema.parse(req.body);

    // Execute use case
    const result = await this.analyzeArticleUseCase.executeBatch(validatedInput);

    // Track user stats (if authenticated, non-blocking)
    if (req.user?.uid && result.successful > 0) {
      UserStatsTracker.incrementArticlesAnalyzed(req.user.uid, result.successful).catch(err =>
        console.error('[AnalyzeController] Failed to track batch analysis:', err)
      );
    }

    res.status(200).json({
      success: true,
      data: result,
      message: `Processed ${result.processed} articles: ${result.successful} successful, ${result.failed} failed`,
    });
  }

  /**
   * GET /api/analyze/stats
   * Get analysis statistics
   */
  async getStats(_req: Request, res: Response): Promise<void> {
    const stats = await this.analyzeArticleUseCase.getStats();

    res.status(200).json({
      success: true,
      data: stats,
      message: `${stats.percentAnalyzed}% of articles analyzed`,
    });
  }
}
