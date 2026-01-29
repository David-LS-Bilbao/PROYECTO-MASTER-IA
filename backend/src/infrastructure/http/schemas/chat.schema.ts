/**
 * Zod Schemas for Chat API (Shift Left Security)
 * Validates chat requests before reaching the use case
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
    .max(5000, 'message content cannot exceed 5000 characters'),
});

/**
 * Schema for chat article request
 */
export const chatArticleSchema = z.object({
  articleId: z
    .string()
    .uuid('articleId must be a valid UUID'),
  messages: z
    .array(chatMessageSchema)
    .min(1, 'at least one message is required')
    .max(50, 'cannot exceed 50 messages in conversation'),
});

// Type exports for use in controllers
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ChatArticleInput = z.infer<typeof chatArticleSchema>;
