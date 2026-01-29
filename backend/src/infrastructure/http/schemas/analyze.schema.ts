/**
 * Zod Schemas for Analysis API (Shift Left Security)
 * All external input is validated here before reaching the use case
 */

import { z } from 'zod';

/**
 * Schema for single article analysis request
 */
export const analyzeArticleSchema = z.object({
  articleId: z
    .string()
    .uuid('articleId must be a valid UUID'),
});

/**
 * Schema for batch analysis request
 */
export const analyzeBatchSchema = z.object({
  limit: z
    .number()
    .int('limit must be an integer')
    .min(1, 'limit must be at least 1')
    .max(100, 'limit cannot exceed 100')
    .optional()
    .default(10),
});

// Type exports for use in controllers
export type AnalyzeArticleInput = z.infer<typeof analyzeArticleSchema>;
export type AnalyzeBatchInput = z.infer<typeof analyzeBatchSchema>;
