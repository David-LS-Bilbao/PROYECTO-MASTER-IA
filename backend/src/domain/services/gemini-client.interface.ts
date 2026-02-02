/**
 * IGeminiClient Interface (Domain Layer)
 * Contract for AI analysis service - NO implementation details
 */

import { ArticleAnalysis } from '../entities/news-article.entity';

export interface AnalyzeContentInput {
  title: string;
  content: string;
  source: string;
  language: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatWithContextInput {
  systemContext: string;
  messages: ChatMessage[];
}

export interface ChatResponse {
  message: string;
}

export interface IGeminiClient {
  /**
   * Analyze article content for summary, bias, and sentiment
   * @throws ExternalAPIError if API call fails
   */
  analyzeArticle(input: AnalyzeContentInput): Promise<ArticleAnalysis>;

  /**
   * Chat with context injection (for article Q&A)
   * @throws ExternalAPIError if API call fails
   */
  chatWithContext(input: ChatWithContextInput): Promise<ChatResponse>;

  /**
   * Generate a chat response using RAG context (Retrieval-Augmented Generation)
   * Uses a focused system prompt that only answers from provided context
   * @param context The retrieved context from ChromaDB
   * @param question The user's question
   * @returns The AI-generated response
   * @throws ExternalAPIError if API call fails
   */
  generateChatResponse(context: string, question: string): Promise<string>;

  /**
   * Generate embedding vector for text using text-embedding-004
   * @param text The text to embed
   * @returns Array of numbers representing the embedding vector
   * @throws ExternalAPIError if API call fails
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Check if the service is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Auto-discover RSS URL for a given media name
   * FEATURE: RSS AUTO-DISCOVERY (Sprint 9)
   * @param mediaName Name of the media outlet
   * @returns RSS URL if found, null otherwise
   */
  discoverRssUrl(mediaName: string): Promise<string | null>;
}
