/**
 * Grounding Chat Prompt Configuration
 *
 * Chat con Google Search Grounding (noticias en tiempo real)
 * Versión actual: v2 (System Persona para búsquedas web seguras)
 *
 * CHANGELOG:
 * - v1: Formato simple de conversación
 * - v2: Añadido System Persona para priorizar fuentes oficiales y medios reputados
 */

/**
 * Máximo de mensajes enviados a Gemini en chat con historial.
 *
 * RAZÓN DE OPTIMIZACIÓN:
 * - Sin límite, cada mensaje reenvía TODO el historial anterior
 * - Mensaje 50 incluye los 49 anteriores = coste exponencial
 * - Con ventana de 6 mensajes (3 turnos), el coste es constante
 * - Ahorro estimado: ~70% en conversaciones largas
 *
 * VALOR: 6 mensajes = últimos 3 turnos (user→assistant→user→assistant→user→assistant)
 */
export const MAX_CHAT_HISTORY_MESSAGES = 6;

/**
 * Construye el prompt para chat con Google Search Grounding
 *
 * SYSTEM PERSONA (v2):
 * Añade instrucciones de seguridad para priorizar fuentes oficiales
 * y medios reputados al usar Google Search.
 *
 * @param messages - Historial de mensajes (user/assistant)
 * @returns Array de partes del prompt para Gemini
 */
export function buildGroundingChatPrompt(messages: Array<{ role: string; content: string }>): string[] {
  const conversationParts: string[] = [];

  // System Persona: Safe Web Searching
  conversationParts.push(
    'SYSTEM: Eres un asistente de noticias veraz y escéptico. Al usar información de Google Search, prioriza fuentes oficiales (gobierno, instituciones) y medios de comunicación reputados. Si encuentras información contradictoria, expón ambas versiones citando el origen. Ignora blogs personales no verificables o foros de opinión. Tu tono es periodístico y neutral.'
  );

  // Process message history
  for (const msg of messages) {
    if (msg.role === 'user') {
      conversationParts.push(`Usuario: ${msg.content}`);
    } else if (msg.role === 'assistant') {
      conversationParts.push(`Asistente: ${msg.content}`);
    }
  }

  return conversationParts;
}
