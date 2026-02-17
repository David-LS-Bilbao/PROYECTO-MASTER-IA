import { describe, expect, it } from 'vitest';
import { detectPaywall } from '../../src/application/services/paywall-detector';

describe('detectPaywall', () => {
  it('bloquea por metadata flag de suscriptor', () => {
    const result = detectPaywall({
      sourceDomain: 'elpais.com',
      metadataFlags: { isSubscriberContent: true },
      extractedText: 'Texto cualquiera',
      snippet: 'Snippet corto',
    });

    expect(result.accessStatus).toBe('PAYWALLED');
    expect(result.analysisBlocked).toBe(true);
    expect(result.accessReason).toContain('metadata_subscriber_flag');
  });

  it('bloquea por keyword de suscripcion en extractedText', () => {
    const result = detectPaywall({
      sourceDomain: 'example.com',
      extractedText: 'Para seguir leyendo, suscribete y accede al contenido exclusivo.',
      snippet: 'Resumen',
    });

    expect(result.accessStatus).toBe('PAYWALLED');
    expect(result.analysisBlocked).toBe(true);
    expect(result.accessReason).toContain('keyword:');
  });

  it('marca RESTRICTED si extractor falla + snippet corto + dominio probable paywall', () => {
    const result = detectPaywall({
      sourceDomain: 'www.elmundo.es',
      extractedText: '',
      snippet: 'Titular breve.',
      extractionFailed: true,
    });

    expect(result.accessStatus).toBe('RESTRICTED');
    expect(result.analysisBlocked).toBe(true);
    expect(result.confidence).toBe('medium');
  });

  it('bloquea RESTRICTED para abc.es con snippet corto y sin texto extraido', () => {
    const result = detectPaywall({
      sourceDomain: 'abc.es',
      extractedText: '',
      snippet: 'Titular corto de portada.',
      extractionFailed: false,
    });

    expect(result.accessStatus).toBe('RESTRICTED');
    expect(result.analysisBlocked).toBe(true);
  });

  it('no bloquea un articulo normal con texto completo', () => {
    const result = detectPaywall({
      sourceDomain: 'example.com',
      extractedText: 'Texto normal '.repeat(120),
      snippet: 'Snippet informativo',
      extractionFailed: false,
    });

    expect(result.accessStatus).toBe('PUBLIC');
    expect(result.analysisBlocked).toBe(false);
  });
});
