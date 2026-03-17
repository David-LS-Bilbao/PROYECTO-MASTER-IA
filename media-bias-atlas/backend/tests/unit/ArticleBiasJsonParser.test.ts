import { describe, expect, it } from 'vitest';
import { ArticleBiasJsonParser } from '../../src/application/parsers/ArticleBiasJsonParser';
import { IdeologyLabel } from '../../src/domain/entities/ArticleBiasAnalysis';

describe('ArticleBiasJsonParser', () => {
  const parser = new ArticleBiasJsonParser();

  it('parsea JSON valido incluso si llega en bloque markdown', () => {
    const parsed = parser.parse(`
      \`\`\`json
      {
        "ideologyLabel": "CENTER",
        "confidence": 0.42,
        "summary": "Titular con framing moderado.",
        "reasoningShort": "Usa un tono informativo y poco cargado."
      }
      \`\`\`
    `);

    expect(parsed.ideologyLabel).toBe(IdeologyLabel.CENTER);
    expect(parsed.confidence).toBe(0.42);
  });

  it('rechaza payloads con schema invalido o claves extra', () => {
    expect(() => parser.parse(`
      {
        "ideologyLabel": "LEFT",
        "confidence": "0.8",
        "summary": "Resumen",
        "reasoningShort": "Motivo",
        "extra": true
      }
    `)).toThrow('Payload de sesgo invalido');
  });
});
