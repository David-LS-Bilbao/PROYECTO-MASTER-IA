/**
 * Tests para useProfileAuth Hook - Step 5 Plan Mikado
 *
 * Valida:
 * - Redirige a /login cuando no hay usuario
 * - No redirige mientras auth está cargando
 * - No redirige cuando el usuario está autenticado
 * - Retorna user, authLoading y getToken
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProfileAuth } from '@/hooks/useProfileAuth';

// ============================================================================
// MOCKS
// ============================================================================

const mockPush = vi.fn();
const mockGetToken = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/context/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

describe('useProfileAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // REDIRECCIÓN SIN USUARIO
  // ==========================================================================

  it('redirige a /login cuando no hay usuario y auth no está cargando', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      getToken: mockGetToken,
      logout: vi.fn(),
    });

    renderHook(() => useProfileAuth());

    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  // ==========================================================================
  // NO REDIRIGE DURANTE CARGA
  // ==========================================================================

  it('no redirige mientras auth está cargando', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      getToken: mockGetToken,
      logout: vi.fn(),
    });

    renderHook(() => useProfileAuth());

    expect(mockPush).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // NO REDIRIGE CON USUARIO
  // ==========================================================================

  it('no redirige cuando el usuario está autenticado', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: '123', email: 'test@test.com' } as any,
      loading: false,
      getToken: mockGetToken,
      logout: vi.fn(),
    });

    renderHook(() => useProfileAuth());

    expect(mockPush).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // RETORNA VALORES CORRECTOS
  // ==========================================================================

  it('retorna user, authLoading y getToken', () => {
    const mockUser = { uid: '123', email: 'test@test.com' } as any;
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      getToken: mockGetToken,
      logout: vi.fn(),
    });

    const { result } = renderHook(() => useProfileAuth());

    expect(result.current.user).toBe(mockUser);
    expect(result.current.authLoading).toBe(false);
    expect(result.current.getToken).toBe(mockGetToken);
  });
});
