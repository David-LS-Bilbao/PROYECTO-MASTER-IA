/**
 * Zod Validation Schemas for Ingest Endpoints
 * Security: Validate ALL inputs before reaching UseCase (Shift Left Security)
 */

import { z } from 'zod';

const validCategories = [
  'business',
  'entertainment',
  'general',
  'health',
  'science',
  'sports',
  'technology',
] as const;

export const ingestNewsSchema = z.object({
  category: z
    .enum(validCategories)
    .optional()
    .describe('News category to fetch'),

  language: z
    .string()
    .length(2)
    .regex(/^[a-z]{2}$/, 'Language must be a 2-letter ISO code')
    .optional()
    .default('es')
    .describe('Language code (ISO 639-1)'),

  query: z
    .string()
    .min(1)
    .max(500)
    .optional()
    .describe('Search query for filtering news'),

  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe('Number of articles to fetch (1-100)'),
});

export type IngestNewsInput = z.infer<typeof ingestNewsSchema>;
