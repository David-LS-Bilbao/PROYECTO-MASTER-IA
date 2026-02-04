/**
 * RAG (Retrieval-Augmented Generation) Chat Prompt Configuration
 * 
 * Versionado: Permite A/B testing sin cambios de código
 * Versión actual: v4 (citación obligatoria + silencio positivo)
 * 
 * CHANGELOG:
 * - v1 (original): ~370 tokens entrada, respuestas verbosas
 * - v2 (optimizada): ~120 tokens entrada, max 150 palabras salida
 * - v3: ~110 tokens entrada, citación numérica, errores concisos
 * - v4 (actual): citaciones obligatorias [1][2], prohibición de introducciones, silencio positivo
 */

/**
 * V2 - Optimizada para reducción de tokens de entrada
 */
export function buildRagChatPromptV2(question: string, context: string): string {
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
 * V3 - Optimizada para minimizar tokens de SALIDA (citación numérica)
 * Ahorro estimado: 40-60% tokens de salida vs V2
 */
export function buildRagChatPromptV3(question: string, context: string): string {
  return `Asistente. Responde español, max 120 palabras. USA CITACIÓN NUMÉRICA [1].

REGLAS:
- Cita con [1][2] (NO repitas frases largas del contexto)
- Si info NO en contexto: responde "INFO_NA" o "Información no disponible en el artículo"
- NO disculpas largas, NO "lo siento", NO "desafortunadamente"
- Formato: bullets si >2 puntos, **negrita** para cifras/nombres clave

[CONTEXTO]
${context}

[PREGUNTA]
${question}`;
}

/**
 * V4 - Citaciones obligatorias + Silencio Positivo para preguntas irrelevantes
 * Prohibición explícita de introducciones genéricas
 */
export function buildRagChatPromptV4(question: string, context: string): string {
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

/**
 * Genera el prompt para RAG chat con contexto de noticias
 * 
 * @param question - Pregunta del usuario
 * @param context - Contexto extraído de noticias similares
 * @returns Prompt completo para enviar a Gemini
 */
export function buildRagChatPrompt(question: string, context: string): string {
  return buildRagChatPromptV4(question, context);
}

/**
 * Límite de palabras para respuestas RAG
 */
export const MAX_RAG_RESPONSE_WORDS = 120; // Reducido de 150 a 120 (V3)
