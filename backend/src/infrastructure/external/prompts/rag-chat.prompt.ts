/**
 * RAG (Retrieval-Augmented Generation) Chat Prompt Configuration
 *
 * Versión actual: v4 (citación obligatoria + silencio positivo)
 *
 * Estrategia de optimización:
 * - Citaciones obligatorias [1][2] para trazabilidad y cost optimization
 * - Prohibición explícita de introducciones genéricas
 * - Silencio positivo para preguntas irrelevantes
 * - Max 120 palabras para reducir tokens de salida
 */

/**
 * Construye el prompt para RAG chat con contexto de noticias (v4 - activa)
 *
 * REGLAS:
 * 1. CITACIÓN: Cada afirmación DEBE ir con [1][2] vinculado al párrafo del contexto
 * 2. PROHIBIDO: "Basándome en el texto", "Según el artículo", "El texto menciona" (responde directamente)
 * 3. SILENCIO POSITIVO: Si pregunta irrelevante → responde SOLO: "No hay información en este artículo para responder esa pregunta."
 * 4. Formato: bullets si >2 puntos, **negrita** cifras clave
 *
 * @param question - Pregunta del usuario
 * @param context - Contexto extraído de noticias similares
 * @returns Prompt completo para enviar a Gemini
 */
export function buildRagChatPrompt(question: string, context: string): string {
  return `Max 120 palabras. Español.

REGLAS OBLIGATORIAS:
1. CITACIÓN: Cada afirmación DEBE ir con [1][2] vinculado al párrafo del contexto
2. PROHIBIDO: "Basándome en el texto", "Según el artículo", "El texto menciona" (responde directamente)
3. SILENCIO POSITIVO: Si pregunta irrelevante → responde SOLO: "No hay información en este artículo para responder esa pregunta."
4. Formato: bullets si >2 puntos, **negrita** cifras clave

[CONTEXTO]
${context}

[PREGUNTA]
${question}`;
}
