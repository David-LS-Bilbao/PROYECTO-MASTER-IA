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

  it('detecta metadata nested con string truthy y recorre objetos internos', () => {
    const result = detectPaywall({
      sourceDomain: 'elpais.com',
      metadataFlags: {
        content: {
          flags: {
            isSuscriberContent: 'si',
          },
        },
      },
      extractedText: 'Texto de ejemplo',
      snippet: 'Snippet',
    });

    expect(result.accessStatus).toBe('PAYWALLED');
    expect(result.analysisBlocked).toBe(true);
  });

  it('maneja metadata como array con primitvos sin bloquear por falso positivo', () => {
    const result = detectPaywall({
      sourceDomain: 'example.com',
      metadataFlags: [42, null, { nested: { isSubscriberContent: 'no' } }] as any,
      extractedText: 'Texto abierto con acceso general y sin bloqueo editorial',
      snippet: 'Snippet informativo suficientemente largo '.repeat(12),
      extractionFailed: false,
    });

    expect(result.accessStatus).toBe('UNKNOWN');
    expect(result.analysisBlocked).toBe(false);
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

  it('bloquea por keyword en rawContent cuando extractedText no aporta señal', () => {
    const result = detectPaywall({
      sourceDomain: 'example.com',
      extractedText: 'Contenido normal sin palabra clave',
      rawContent: 'Contenido exclusivo. Inicia sesión para seguir leyendo.',
      snippet: 'Resumen',
    });

    expect(result.accessStatus).toBe('PAYWALLED');
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

  it('si metadata no es subscriber y no hay señales fuertes devuelve UNKNOWN', () => {
    const result = detectPaywall({
      sourceDomain: null,
      metadataFlags: { isSubscriberContent: 'no', extra: { nested: true } },
      extractedText: 'Texto breve sin palabra de pago',
      snippet: '',
      extractionFailed: false,
    });

    expect(result.accessStatus).toBe('UNKNOWN');
    expect(result.analysisBlocked).toBe(false);
  });

  it('si hay dominio probable pero snippet no es corto y extraido existe, no bloquea', () => {
    const result = detectPaywall({
      sourceDomain: 'subdomain.elmundo.es',
      extractedText: 'Texto suficientemente largo sin keywords de pago y con contexto real '.repeat(3),
      snippet: 'Snippet '.repeat(80),
      extractionFailed: false,
    });

    expect(result.accessStatus).toBe('UNKNOWN');
    expect(result.analysisBlocked).toBe(false);
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
