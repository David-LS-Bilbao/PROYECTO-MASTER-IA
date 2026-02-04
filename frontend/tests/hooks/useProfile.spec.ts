/**
 * Tests para useProfile Hook - Step 6 Plan Mikado
 *
 * Valida:
 * - Carga el perfil cuando hay usuario y auth no está cargando
 * - No carga perfil si no hay usuario
 * - No carga perfil mientras auth está cargando
 * - Guarda cambios correctamente
 * - Maneja error en save (toast.error)
 * - Retorna null si getToken devuelve null al guardar
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetToken = vi.fn();
const mockRetryWithTokenRefresh = vi.fn();

vi.mock('@/hooks/useRetryWithToast', () => ({
  useRetryWithToast: () => ({
    retryWithTokenRefresh: mockRetryWithTokenRefresh,
  }),
}));

vi.mock('@/lib/profile.api', () => ({
  getUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
}));

import { updateUserProfile } from '@/lib/profile.api';
const mockUpdateUserProfile = vi.mocked(updateUserProfile);

const mockUser = { uid: '123', email: 'test@test.com' } as any;

const mockProfile = {
  id: 'profile-1',
  email: 'test@test.com',
  name: 'Test User',
  plan: 'FREE' as const,
  preferences: { categories: ['Política', 'Economía'] },
  usageStats: { articlesAnalyzed: 10, searchesPerformed: 5, chatMessages: 3 },
  counts: { favorites: 2 },
  createdAt: '2026-01-15T00:00:00Z',
};

describe('useProfile Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue('valid-token');
  });

  // ==========================================================================
  // CARGA DE PERFIL
  // ==========================================================================

  it('carga el perfil cuando hay usuario y auth no está cargando', async () => {
    mockRetryWithTokenRefresh.mockResolvedValue(mockProfile);

    const { result } = renderHook(() =>
      useProfile(mockUser, false, mockGetToken)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toEqual(mockProfile);
    expect(mockRetryWithTokenRefresh).toHaveBeenCalledWith(
      expect.any(Function),
      'Error al cargar el perfil'
    );
  });

  it('no carga perfil si no hay usuario', async () => {
    const { result } = renderHook(() =>
      useProfile(null, false, mockGetToken)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toBeNull();
    expect(mockRetryWithTokenRefresh).not.toHaveBeenCalled();
  });

  it('no carga perfil mientras auth está cargando', () => {
    const { result } = renderHook(() =>
      useProfile(mockUser, true, mockGetToken)
    );

    expect(result.current.loading).toBe(true);
    expect(mockRetryWithTokenRefresh).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // SAVE
  // ==========================================================================

  it('guarda cambios correctamente', async () => {
    const updatedProfile = { ...mockProfile, name: 'Updated' };
    mockRetryWithTokenRefresh.mockResolvedValue(mockProfile);
    mockUpdateUserProfile.mockResolvedValue(updatedProfile);

    const { result } = renderHook(() =>
      useProfile(mockUser, false, mockGetToken)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.save({ name: 'Updated' });
    });

    expect(mockGetToken).toHaveBeenCalled();
    expect(mockUpdateUserProfile).toHaveBeenCalledWith('valid-token', {
      name: 'Updated',
    });
    expect(result.current.profile).toEqual(updatedProfile);
    expect(toast.success).toHaveBeenCalledWith('Perfil actualizado correctamente');
  });

  it('muestra toast.error si getToken devuelve null al guardar', async () => {
    mockRetryWithTokenRefresh.mockResolvedValue(mockProfile);
    mockGetToken.mockResolvedValue(null); // getToken devuelve null para save

    const { result } = renderHook(() =>
      useProfile(mockUser, false, mockGetToken)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.save({ name: 'Test' });
    });

    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo obtener el token de autenticación'
    );
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
  });

  it('muestra toast.error si updateUserProfile lanza error', async () => {
    mockRetryWithTokenRefresh.mockResolvedValue(mockProfile);
    mockUpdateUserProfile.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() =>
      useProfile(mockUser, false, mockGetToken)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.save({ name: 'Test' });
    });

    expect(toast.error).toHaveBeenCalledWith('Error al actualizar el perfil');
    expect(result.current.saving).toBe(false);
  });

  // ==========================================================================
  // AUTH TOKEN
  // ==========================================================================

  it('expone authToken tras cargar el perfil', async () => {
    mockRetryWithTokenRefresh.mockImplementation(async (operation: any) => {
      return operation('captured-token');
    });

    const { result } = renderHook(() =>
      useProfile(mockUser, false, mockGetToken)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.authToken).toBe('captured-token');
  });
});
