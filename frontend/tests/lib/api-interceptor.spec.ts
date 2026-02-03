/**
 * Tests para API Interceptor - Auto-Logout en 401
 * 
 * Valida que:
 * - Detecta respuestas 401
 * - Ejecuta signOut de Firebase
 * - Redirige a /login
 * - Lanza UnauthorizedError
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithAuth, UnauthorizedError, isUnauthorizedError } from '@/lib/api-interceptor';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// ============================================================================
// MOCKS
// ============================================================================

// Mock de Firebase Auth
vi.mock('firebase/auth', () => ({
  signOut: vi.fn(),
}));

// Mock de Firebase config
vi.mock('@/lib/firebase', () => ({
  auth: { currentUser: null },
}));

// Mock de fetch global
const originalFetch = global.fetch;

describe('API Interceptor - Auto-Logout en 401', () => {
  let mockLocation: any;

  beforeEach(() => {
    // Mock de window.location
    mockLocation = {
      href: '',
      pathname: '/profile',
    };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
      configurable: true,
    });

    // Limpiar mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restaurar fetch
    global.fetch = originalFetch;
  });

  // ==========================================================================
  // DETECCIÓN DE 401
  // ==========================================================================

  describe('Detección de 401 Unauthorized', () => {
    it('debe detectar 401 y lanzar UnauthorizedError', async () => {
      // Mock de fetch que devuelve 401
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        statusText: 'Unauthorized',
        ok: false,
      });

      await expect(
        fetchWithAuth('https://api.example.com/user/me')
      ).rejects.toThrow(UnauthorizedError);

      await expect(
        fetchWithAuth('https://api.example.com/user/me')
      ).rejects.toThrow('Sesión expirada. Por favor, inicia sesión nuevamente.');
    });

    it('debe ejecutar signOut de Firebase cuando detecta 401', async () => {
      // Mock de fetch que devuelve 401
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        statusText: 'Unauthorized',
        ok: false,
      });

      try {
        await fetchWithAuth('https://api.example.com/user/me');
      } catch (error) {
        // Error esperado
      }

      // Verificar que se llamó a signOut
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(signOut).toHaveBeenCalledWith(auth);
    });

    it('debe redirigir a /login cuando detecta 401', async () => {
      // Mock de fetch que devuelve 401
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        statusText: 'Unauthorized',
        ok: false,
      });

      try {
        await fetchWithAuth('https://api.example.com/user/me');
      } catch (error) {
        // Error esperado
      }

      // Verificar redirección
      expect(mockLocation.href).toBe('/login');
    });

    it('NO debe redirigir si ya está en /login (evitar loop infinito)', async () => {
      // Establecer que ya estamos en /login
      mockLocation.pathname = '/login';

      // Mock de fetch que devuelve 401
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        statusText: 'Unauthorized',
        ok: false,
      });

      try {
        await fetchWithAuth('https://api.example.com/user/me');
      } catch (error) {
        // Error esperado
      }

      // NO debe cambiar href porque ya estamos en /login
      expect(mockLocation.href).toBe('');
    });
  });

  // ==========================================================================
  // RESPUESTAS NO-401
  // ==========================================================================

  describe('Respuestas exitosas (no 401)', () => {
    it('debe retornar la respuesta normal si el status es 200', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'success' }),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const response = await fetchWithAuth('https://api.example.com/user/me');

      expect(response.status).toBe(200);
      expect(signOut).not.toHaveBeenCalled();
      expect(mockLocation.href).toBe('');
    });

    it('debe retornar la respuesta sin interceptar si es 500 (server error)', async () => {
      const mockResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        ok: false,
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const response = await fetchWithAuth('https://api.example.com/user/me');

      expect(response.status).toBe(500);
      expect(signOut).not.toHaveBeenCalled();
      expect(mockLocation.href).toBe('');
    });

    it('debe retornar la respuesta sin interceptar si es 403 (forbidden)', async () => {
      const mockResponse = {
        status: 403,
        statusText: 'Forbidden',
        ok: false,
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const response = await fetchWithAuth('https://api.example.com/user/me');

      expect(response.status).toBe(403);
      expect(signOut).not.toHaveBeenCalled();
      expect(mockLocation.href).toBe('');
    });
  });

  // ==========================================================================
  // SKIP AUTH CHECK
  // ==========================================================================

  describe('Opción skipAuthCheck', () => {
    it('debe permitir saltar el auto-logout con skipAuthCheck: true', async () => {
      // Mock de fetch que devuelve 401
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        statusText: 'Unauthorized',
        ok: false,
      });

      const response = await fetchWithAuth('https://api.example.com/user/me', {
        skipAuthCheck: true,
      });

      expect(response.status).toBe(401);
      expect(signOut).not.toHaveBeenCalled();
      expect(mockLocation.href).toBe('');
    });
  });

  // ==========================================================================
  // MANEJO DE ERRORES DE SIGNOUT
  // ==========================================================================

  describe('Manejo de errores en signOut', () => {
    it('debe lanzar UnauthorizedError incluso si signOut falla', async () => {
      // Mock de signOut que lanza error
      vi.mocked(signOut).mockRejectedValueOnce(new Error('Firebase signOut failed'));

      // Mock de fetch que devuelve 401
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        statusText: 'Unauthorized',
        ok: false,
      });

      await expect(
        fetchWithAuth('https://api.example.com/user/me')
      ).rejects.toThrow(UnauthorizedError);

      // Debe haber intentado hacer signOut
      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // HELPER: isUnauthorizedError
  // ==========================================================================

  describe('Helper isUnauthorizedError', () => {
    it('debe retornar true para instancias de UnauthorizedError', () => {
      const error = new UnauthorizedError();
      expect(isUnauthorizedError(error)).toBe(true);
    });

    it('debe retornar false para otros tipos de Error', () => {
      const error = new Error('Generic error');
      expect(isUnauthorizedError(error)).toBe(false);
    });

    it('debe retornar false para valores no-Error', () => {
      expect(isUnauthorizedError('string error')).toBe(false);
      expect(isUnauthorizedError(null)).toBe(false);
      expect(isUnauthorizedError(undefined)).toBe(false);
      expect(isUnauthorizedError(42)).toBe(false);
    });
  });

  // ==========================================================================
  // INTEGRACIÓN: Flujo completo
  // ==========================================================================

  describe('Flujo completo de auto-logout', () => {
    it('debe ejecutar todo el flujo: detectar 401 → signOut → redirect → throw', async () => {
      // Mock de fetch que devuelve 401
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        statusText: 'Unauthorized',
        ok: false,
      });

      let caughtError: any = null;

      try {
        await fetchWithAuth('https://api.example.com/user/me', {
          headers: { Authorization: 'Bearer expired-token' },
        });
      } catch (error) {
        caughtError = error;
      }

      // 1. Debe haber lanzado UnauthorizedError
      expect(caughtError).toBeInstanceOf(UnauthorizedError);
      expect(caughtError.message).toBe('Sesión expirada. Por favor, inicia sesión nuevamente.');

      // 2. Debe haber ejecutado signOut
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(signOut).toHaveBeenCalledWith(auth);

      // 3. Debe haber redirigido a /login
      expect(mockLocation.href).toBe('/login');
    });
  });

  // ==========================================================================
  // CASOS DE USO REALES
  // ==========================================================================

  describe('Casos de uso reales', () => {
    it('debe manejar token expirado en getUserProfile', async () => {
      // Simular respuesta 401 del backend
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        statusText: 'Unauthorized',
        ok: false,
        text: vi.fn().mockResolvedValue(JSON.stringify({
          success: false,
          error: 'Token de autenticación inválido o expirado',
        })),
      });

      await expect(
        fetchWithAuth('http://localhost:3000/api/user/me', {
          headers: { Authorization: 'Bearer expired-token-123' },
        })
      ).rejects.toThrow(UnauthorizedError);

      expect(signOut).toHaveBeenCalledTimes(1);
      expect(mockLocation.href).toBe('/login');
    });

    it('debe manejar token inválido en analyzeArticle', async () => {
      // Simular respuesta 401 del backend
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        statusText: 'Unauthorized',
        ok: false,
        json: vi.fn().mockResolvedValue({
          success: false,
          error: 'Token de autenticación no proporcionado',
        }),
      });

      await expect(
        fetchWithAuth('http://localhost:3000/api/analyze/article', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer invalid-token',
          },
          body: JSON.stringify({ articleId: '123' }),
        })
      ).rejects.toThrow(UnauthorizedError);

      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });
});
