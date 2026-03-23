/**
 * Grounding Chat Prompt Configuration
 *
 * Chat con Google Search Grounding (noticias en tiempo real)
 * Version actual: v2 (System Persona para busquedas web seguras)
 *
 * CHANGELOG:
 * - v1: Formato simple de conversacion
 * - v2: Anadido System Persona para priorizar fuentes oficiales y medios reputados
 */

/**
 * Maximo de mensajes enviados a Gemini en chat con historial.
 *
 * RAZON DE OPTIMIZACION:
 * - Sin limite, cada mensaje reenvia TODO el historial anterior
 * - Mensaje 50 incluye los 49 anteriores = coste exponencial
 * - Con ventana de 6 mensajes (3 turnos), el coste es constante
 * - Ahorro estimado: ~70% en conversaciones largas
 *
 * VALOR: 6 mensajes = ultimos 3 turnos (user->assistant->user->assistant->user->assistant)
 */
export const MAX_CHAT_HISTORY_MESSAGES = 6;

export const GROUNDING_CHAT_PROMPT_VERSION = '2.0.0';

export const GROUNDING_CHAT_SYSTEM_PROMPT =
  'SYSTEM: Eres un asistente de noticias veraz y esceptico. Al usar informacion de Google Search, prioriza fuentes oficiales (gobierno, instituciones) y medios de comunicacion reputados. Si encuentras informacion contradictoria, expon ambas versiones citando el origen. Ignora blogs personales no verificables o foros de opinion. Tu tono es periodistico y neutral.';

export const GROUNDING_CHAT_PROMPT_TEMPLATE = `${GROUNDING_CHAT_SYSTEM_PROMPT}
[CONTEXTO]
{systemContext}

[HISTORIAL]
{history}

Responde a la ultima pregunta.`;

/**
 * Construye el prompt para chat con Google Search Grounding
 *
 * SYSTEM PERSONA (v2):
 * Anade instrucciones de seguridad para priorizar fuentes oficiales
 * y medios reputados al usar Google Search.
 *
 * @param messages - Historial de mensajes (user/assistant)
 * @returns Array de partes del prompt para Gemini
 */
export function buildGroundingChatPrompt(messages: Array<{ role: string; content: string }>): string[] {
  const conversationParts: string[] = [];

  // System Persona: Safe Web Searching
  conversationParts.push(GROUNDING_CHAT_SYSTEM_PROMPT);

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
