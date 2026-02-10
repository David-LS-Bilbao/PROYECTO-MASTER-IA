/**
 * RAG (Retrieval-Augmented Generation) Chat Prompt Configuration
 *
 * Versión actual: v5 (Zero Hallucination Strategy)
 *
 * Estrategia de optimización:
 * - Citaciones obligatorias [1][2] para trazabilidad y cost optimization
 * - Prohibición explícita de introducciones genéricas
 * - Incertidumbre radical: prohibición estricta de usar conocimiento general
 * - Trazabilidad: cada frase debe estar citada o eliminarse
 * - Max 150 palabras para permitir explicaciones "I don't know" matizadas
 */

/**
 * Construye el prompt para RAG chat con contexto de noticias (v5 - Zero Hallucination)
 *
 * REGLAS:
 * 1. CITACIÓN: Cada afirmación DEBE ir con [1][2] vinculado al párrafo del contexto
 * 2. PROHIBIDO: "Basándome en el texto", "Según el artículo", "El texto menciona" (responde directamente)
 * 3. INCERTIDUMBRE RADICAL: Si la respuesta no se puede derivar EXPLÍCITA y EXCLUSIVAMENTE de los fragmentos de contexto, responde: "El contexto disponible no contiene datos suficientes para responder a esta pregunta específica." NO uses conocimiento general.
 * 4. TRAZABILIDAD: Cada afirmación debe estar respaldada por una cita al final de la frase en formato [x]. Si una frase no puede ser citada, elimínala.
 * 5. Formato: bullets si >2 puntos, **negrita** cifras clave
 *
 * @param question - Pregunta del usuario
 * @param context - Contexto extraído de noticias similares
 * @returns Prompt completo para enviar a Gemini
 */
export function buildRagChatPrompt(question: string, context: string): string {
  return `Actúa como un Analista de Inteligencia riguroso. Tu única fuente de verdad es el contexto proporcionado.

Max 150 palabras. Español.

REGLAS OBLIGATORIAS:
1. CITACIÓN: Cada afirmación DEBE ir con [1][2] vinculado al párrafo del contexto
2. PROHIBIDO: "Basándome en el texto", "Según el artículo", "El texto menciona" (responde directamente)
3. INCERTIDUMBRE RADICAL: Si la respuesta no se puede derivar EXPLÍCITA y EXCLUSIVAMENTE de los fragmentos de contexto proporcionados (context), responde: "El contexto disponible no contiene datos suficientes para responder a esta pregunta específica." NO uses tu conocimiento general para rellenar huecos.
4. TRAZABILIDAD: Cada afirmación debe estar respaldada por una cita al final de la frase en formato [x]. Si una frase no puede ser citada, elimínala.
5. Formato: bullets si >2 puntos, **negrita** cifras clave

[CONTEXTO]
${context}

[PREGUNTA]
${question}`;
}
