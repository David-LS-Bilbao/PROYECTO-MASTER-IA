/**
 * Barrel export for all Gemini prompts
 * Centraliza importaciones de prompts
 */

export { ANALYSIS_PROMPT, MAX_ARTICLE_CONTENT_LENGTH } from './analysis.prompt';
export { buildRagChatPrompt, MAX_RAG_RESPONSE_WORDS } from './rag-chat.prompt';
export { buildGroundingChatPrompt, MAX_CHAT_HISTORY_MESSAGES } from './grounding-chat.prompt';
export { buildRssDiscoveryPrompt } from './rss-discovery.prompt';

/**
 * Límite de caracteres para texto de embedding.
 * El modelo text-embedding-004 tiene límite de ~8000 tokens.
 */
export const MAX_EMBEDDING_TEXT_LENGTH = 6000;
