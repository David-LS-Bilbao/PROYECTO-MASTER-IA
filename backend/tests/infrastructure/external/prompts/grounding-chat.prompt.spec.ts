/**
 * Grounding Chat Prompt Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { buildGroundingChatPrompt, MAX_CHAT_HISTORY_MESSAGES } from '../../../../src/infrastructure/external/prompts/grounding-chat.prompt';

// ============================================================================
// TESTS
// ============================================================================

describe('grounding-chat.prompt', () => {
  it('MAX_CHAT_HISTORY_MESSAGES es 6', () => {
    expect(MAX_CHAT_HISTORY_MESSAGES).toBe(6);
  });

  it('construye prompt con system persona y mensajes', () => {
    const messages = [
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: 'Respuesta' },
    ];

    const parts = buildGroundingChatPrompt(messages);

    expect(parts[0]).toContain('SYSTEM:');
    expect(parts[1]).toBe('Usuario: Hola');
    expect(parts[2]).toBe('Asistente: Respuesta');
  });
});
