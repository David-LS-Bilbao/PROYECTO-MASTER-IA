import { afterEach, describe, expect, it, vi } from 'vitest';
import { APIError, analyzeArticleWithMode } from '@/lib/api';

describe('analyzeArticleWithMode error handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('propaga PAYWALL_BLOCKED como APIError con errorCode', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        error: {
          code: 'PAYWALL_BLOCKED',
          message:
            'Articulo de pago o suscripcion al medio. No se puede realizar el analisis sin el texto completo.',
        },
      }),
    } as Response);

    let caughtError: unknown;
    try {
      await analyzeArticleWithMode(
        '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        'token-test',
        'moderate',
        'standard'
      );
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(APIError);
    expect((caughtError as APIError).errorCode).toBe('PAYWALL_BLOCKED');
  });
});
