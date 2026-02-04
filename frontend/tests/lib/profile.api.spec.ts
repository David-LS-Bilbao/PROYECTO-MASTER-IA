/**
 * Tests para Profile API Layer - Step 1 Plan Mikado
 *
 * Valida:
 * - getUserProfile retorna perfil en 200
 * - getUserProfile lanza ProfileAPIError en error HTTP
 * - updateUserProfile envia PATCH con body correcto
 * - updateUserProfile lanza ProfileAPIError en error de red
 * - ProfileAPIError contiene statusCode tipado
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getUserProfile,
  updateUserProfile,
  ProfileAPIError,
} from '@/lib/profile.api';

// ============================================================================
// MOCKS
// ============================================================================

const originalFetch = global.fetch;

const MOCK_PROFILE = {
  id: 'user-uuid-123',
  email: 'test@example.com',
  name: 'Test User',
  picture: null,
  plan: 'FREE' as const,
  preferences: { categories: ['Política', 'Tecnología'] },
  usageStats: {
    articlesAnalyzed: 10,
    searchesPerformed: 5,
    chatMessages: 3,
  },
  counts: { favorites: 2, searchHistory: 4, chats: 1 },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
};

describe('Profile API Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ==========================================================================
  // ProfileAPIError
  // ==========================================================================

  describe('ProfileAPIError', () => {
    it('debe contener statusCode y message', () => {
      const error = new ProfileAPIError(401, 'Unauthorized');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ProfileAPIError);
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
      expect(error.name).toBe('ProfileAPIError');
    });
  });

  // ==========================================================================
  // getUserProfile
  // ==========================================================================

  describe('getUserProfile', () => {
    it('retorna UserProfile en respuesta 200 OK', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: MOCK_PROFILE,
        }),
      });

      const result = await getUserProfile('valid-token-123');

      expect(result).toEqual(MOCK_PROFILE);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Verificar headers de autorización
      const [url, options] = (global.fetch as any).mock.calls[0];
      expect(url).toContain('/api/user/me');
      expect(options.headers.Authorization).toBe('Bearer valid-token-123');
    });

    it('lanza ProfileAPIError con statusCode en 401', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: vi.fn().mockResolvedValue('Token expired'),
      });

      await expect(getUserProfile('expired-token')).rejects.toThrow(
        ProfileAPIError
      );

      try {
        await getUserProfile('expired-token');
      } catch (error) {
        expect(error).toBeInstanceOf(ProfileAPIError);
        expect((error as ProfileAPIError).statusCode).toBe(401);
      }
    });

    it('lanza ProfileAPIError con statusCode en 500', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('Server error'),
      });

      await expect(getUserProfile('valid-token')).rejects.toThrow(
        ProfileAPIError
      );

      try {
        await getUserProfile('valid-token');
      } catch (error) {
        expect((error as ProfileAPIError).statusCode).toBe(500);
      }
    });
  });

  // ==========================================================================
  // updateUserProfile
  // ==========================================================================

  describe('updateUserProfile', () => {
    it('envia PATCH con body correcto y retorna perfil actualizado', async () => {
      const updatedProfile = { ...MOCK_PROFILE, name: 'Updated Name' };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: updatedProfile,
        }),
      });

      const result = await updateUserProfile('valid-token', {
        name: 'Updated Name',
      });

      expect(result).toEqual(updatedProfile);

      // Verificar método PATCH y body
      const [url, options] = (global.fetch as any).mock.calls[0];
      expect(url).toContain('/api/user/me');
      expect(options.method).toBe('PATCH');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers.Authorization).toBe('Bearer valid-token');
      expect(JSON.parse(options.body)).toEqual({ name: 'Updated Name' });
    });

    it('envia preferences en el body', async () => {
      const updatedProfile = {
        ...MOCK_PROFILE,
        preferences: { categories: ['Deportes'] },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: updatedProfile,
        }),
      });

      await updateUserProfile('valid-token', {
        preferences: { categories: ['Deportes'] },
      });

      const [, options] = (global.fetch as any).mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({
        preferences: { categories: ['Deportes'] },
      });
    });

    it('lanza ProfileAPIError en error HTTP', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: vi.fn().mockResolvedValue('Not allowed'),
      });

      await expect(
        updateUserProfile('valid-token', { name: 'Test' })
      ).rejects.toThrow(ProfileAPIError);

      try {
        await updateUserProfile('valid-token', { name: 'Test' });
      } catch (error) {
        expect((error as ProfileAPIError).statusCode).toBe(403);
      }
    });

    it('lanza ProfileAPIError en fallo de red', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(
        updateUserProfile('valid-token', { name: 'Test' })
      ).rejects.toThrow();
    });
  });
});
