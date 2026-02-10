/**
 * RSS Discovery Prompt Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { buildRssDiscoveryPrompt, buildLocationSourcesPrompt } from '../../../../src/infrastructure/external/prompts/rss-discovery.prompt';

describe('rss-discovery.prompt', () => {
  it('buildRssDiscoveryPrompt incluye reglas de formato y el nombre del medio', () => {
    const prompt = buildRssDiscoveryPrompt('El Diario');

    expect(prompt).toContain("INPUT: 'El Diario'");
    expect(prompt).toContain('OUTPUT: URL feed RSS oficial');
    expect(prompt).toContain('.xml');
    expect(prompt).toContain('/feed/');
    expect(prompt).toContain('null');
  });

  it('buildLocationSourcesPrompt incluye ciudad y reglas estrictas', () => {
    const prompt = buildLocationSourcesPrompt('Bilbao');

    expect(prompt).toContain('"Bilbao"');
    expect(prompt).toContain('FORMATO DE SALIDA (JSON estricto)');
    expect(prompt).toContain('NO predecir URLs RSS');
    expect(prompt).toContain('devuelve array');
  });
});
