/**
 * Grounding Chat Prompt Configuration
 * 
 * Chat con Google Search Grounding (noticias en tiempo real)
 * Versión actual: v1 (formato simple de conversación)
 * 
 * NOTA: El prompt es simple porque Google Search hace el "grounding" automático
 * No necesitamos instrucciones complejas aquí.
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
 * @param messages - Historial de mensajes (user/assistant)
 * @returns Array de partes del prompt para Gemini
 */
export function buildGroundingChatPrompt(messages: Array<{ role: string; content: string }>): string[] {
  const conversationParts: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      conversationParts.push(`Usuario: ${msg.content}`);
    } else if (msg.role === 'assistant') {
      conversationParts.push(`Asistente: ${msg.content}`);
    }
  }

  return conversationParts;
}
