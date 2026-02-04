/**
 * Tests para useRetryWithToast Hook - Step 2 Plan Mikado
 *
 * Valida:
 * - Operación exitosa en primer intento (sin retry)
 * - Retry con token refresh en error 401
 * - Toast de error tras agotar reintentos
 * - Retorna null en error no-retryable
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRetryWithToast } from '@/hooks/useRetryWithToast';
import { ProfileAPIError } from '@/lib/profile.api';
import { toast } from 'sonner';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetToken = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    getToken: mockGetToken,
  }),
}));

describe('useRetryWithToast Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // OPERACIÓN EXITOSA
  // ==========================================================================

  it('retorna resultado en operación exitosa sin reintentar', async () => {
    mockGetToken.mockResolvedValue('valid-token');

    const { result } = renderHook(() => useRetryWithToast());

    const operation = vi.fn().mockResolvedValue({ id: '123', name: 'Test' });

    let response: any;
    await act(async () => {
      response = await result.current.retryWithTokenRefresh(
        operation,
        'Error genérico'
      );
    });

    expect(response).toEqual({ id: '123', name: 'Test' });
    expect(mockGetToken).toHaveBeenCalledTimes(1);
    expect(mockGetToken).toHaveBeenCalledWith(false); // Sin force refresh en 1er intento
    expect(operation).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledWith('valid-token');
    expect(toast.error).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // RETRY EN 401
  // ==========================================================================

  it('reintenta con token refrescado en error 401', async () => {
    mockGetToken
      .mockResolvedValueOnce('expired-token')
      .mockResolvedValueOnce('fresh-token');

    const operation = vi
      .fn()
      .mockRejectedValueOnce(new ProfileAPIError(401, 'Unauthorized'))
      .mockResolvedValueOnce({ id: '123', name: 'Refreshed' });

    const { result } = renderHook(() => useRetryWithToast());

    let response: any;
    await act(async () => {
      response = await result.current.retryWithTokenRefresh(
        operation,
        'Error de sesión'
      );
    });

    expect(response).toEqual({ id: '123', name: 'Refreshed' });
    expect(mockGetToken).toHaveBeenCalledTimes(2);
    expect(mockGetToken).toHaveBeenNthCalledWith(2, true); // Force refresh en retry
    expect(operation).toHaveBeenCalledTimes(2);
    expect(toast.error).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // MAX RETRIES AGOTADOS
  // ==========================================================================

  it('muestra toast tras agotar reintentos en 401 persistente', async () => {
    mockGetToken.mockResolvedValue('always-expired-token');

    const operation = vi
      .fn()
      .mockRejectedValue(new ProfileAPIError(401, 'Unauthorized'));

    const { result } = renderHook(() => useRetryWithToast());

    let response: any;
    await act(async () => {
      response = await result.current.retryWithTokenRefresh(
        operation,
        'Tu sesión ha expirado'
      );
    });

    expect(response).toBeNull();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(
      'Tu sesión ha expirado',
      expect.objectContaining({
        action: expect.objectContaining({
          label: 'Iniciar sesión',
        }),
      })
    );
  });

  // ==========================================================================
  // ERROR NO-RETRYABLE
  // ==========================================================================

  it('retorna null en error no-retryable (500) sin reintentar', async () => {
    mockGetToken.mockResolvedValue('valid-token');

    const operation = vi
      .fn()
      .mockRejectedValue(new ProfileAPIError(500, 'Server Error'));

    const { result } = renderHook(() => useRetryWithToast());

    let response: any;
    await act(async () => {
      response = await result.current.retryWithTokenRefresh(
        operation,
        'Error del servidor'
      );
    });

    expect(response).toBeNull();
    expect(operation).toHaveBeenCalledTimes(1); // NO reintenta
    expect(toast.error).toHaveBeenCalledWith(
      'Error del servidor',
      expect.anything()
    );
  });

  // ==========================================================================
  // TOKEN NULL
  // ==========================================================================

  it('retorna null si getToken devuelve null', async () => {
    mockGetToken.mockResolvedValue(null);

    const operation = vi.fn();

    const { result } = renderHook(() => useRetryWithToast());

    let response: any;
    await act(async () => {
      response = await result.current.retryWithTokenRefresh(
        operation,
        'Sin autenticación'
      );
    });

    expect(response).toBeNull();
    expect(operation).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'Sin autenticación',
      expect.anything()
    );
  });
});
