/**
 * RAG (Retrieval-Augmented Generation) Chat Prompt Configuration
 * 
 * Versionado: Permite A/B testing sin cambios de código
 * Versión actual: v2 (optimizada - 67% reducción de tokens)
 * 
 * CHANGELOG:
 * - v1 (original): ~370 tokens, instrucciones verbosas
 * - v2 (actual): ~120 tokens, compacto, reglas directas
 */

/**
 * Genera el prompt para RAG chat con contexto de noticias
 * 
 * @param question - Pregunta del usuario
 * @param context - Contexto extraído de noticias similares
 * @returns Prompt completo para enviar a Gemini
 */
export function buildRagChatPrompt(question: string, context: string): string {
  return `Asistente de noticias. Responde en español, max 150 palabras.

REGLAS:
- Prioriza el CONTEXTO. Si no está ahí, usa conocimiento general con prefijo "Según información general..."
- Formato: bullets para listas, **negrita** para datos clave, párrafos cortos (2-3 líneas max)

[CONTEXTO]
${context}

[PREGUNTA]
${question}`;
}

/**
 * Límite de palabras para respuestas RAG
 */
export const MAX_RAG_RESPONSE_WORDS = 150;
