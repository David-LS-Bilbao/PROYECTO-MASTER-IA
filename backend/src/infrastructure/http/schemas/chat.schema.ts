/**
 * Zod Schemas for Chat API (Shift Left Security)
 * Validates chat requests before reaching the use case
 *
 * === COST OPTIMIZATION (Sprint 8) ===
 * - messages.max(50): Límite de validación para evitar payloads enormes
 * - content.max(5000): Límite por mensaje individual
 *
 * NOTA: Aunque el schema acepta hasta 50 mensajes, GeminiClient solo
 * envía los últimos 6 a la API (ventana deslizante) para optimizar costes.
 * El historial completo puede guardarse en BD para UX, pero no se paga
 * por él en cada llamada a Gemini.
 */

import { z } from 'zod';

/**
 * Schema for chat message
 */
const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant'], {
    error: 'role must be "user" or "assistant"',
  }),
  content: z
    .string()
    .min(1, 'message content cannot be empty')
    .max(5000, 'message content cannot exceed 5000 characters'), // COST LIMIT
});

/**
 * Schema for chat article request
 *
 * COST OPTIMIZATION: max 50 mensajes en validación, pero solo 6 se envían a Gemini.
 */
export const chatArticleSchema = z.object({
  articleId: z
    .string()
    .uuid('articleId must be a valid UUID'),
  messages: z
    .array(chatMessageSchema)
    .min(1, 'at least one message is required')
    .max(50, 'cannot exceed 50 messages in conversation'), // Validation limit
});

// Type exports for use in controllers
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ChatArticleInput = z.infer<typeof chatArticleSchema>;
