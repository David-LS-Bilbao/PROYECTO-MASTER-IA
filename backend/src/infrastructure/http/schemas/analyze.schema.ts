/**
 * Zod Schemas for Analysis API (Shift Left Security)
 * All external input is validated here before reaching the use case
 *
 * === COST OPTIMIZATION (Sprint 8) ===
 * - batch.limit.max(100): Límite defensivo contra costes inesperados
 * - Cada artículo individual verifica caché antes de llamar a Gemini
 * - Solo artículos NO analizados se procesan (findUnanalyzed)
 */

import { z } from 'zod';

/**
 * Schema for single article analysis request
 */
export const analyzeArticleSchema = z.object({
  articleId: z
    .string()
    .uuid('articleId must be a valid UUID'),
  analysisMode: z
    .enum(['low_cost', 'moderate', 'standard'])
    .optional(),
});

/**
 * Schema for batch analysis request
 *
 * COST OPTIMIZATION: Límite máximo de 100 artículos por lote.
 * Cada artículo verifica caché antes de llamar a Gemini.
 */
export const analyzeBatchSchema = z.object({
  limit: z
    .number()
    .int('limit must be an integer')
    .min(1, 'limit must be at least 1')
    .max(100, 'limit cannot exceed 100') // COST LIMIT
    .optional()
    .default(10),
});

// Type exports for use in controllers
export type AnalyzeArticleInput = z.infer<typeof analyzeArticleSchema>;
export type AnalyzeBatchInput = z.infer<typeof analyzeBatchSchema>;
