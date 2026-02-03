/**
 * API Interceptor - Auto-Logout on 401 Unauthorized
 * 
 * Proporciona un wrapper para fetch que automáticamente:
 * - Detecta respuestas 401 (token expirado/inválido)
 * - Ejecuta logout del AuthContext
 * - Redirige a /login
 * 
 * @module lib/api-interceptor
 */

import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/**
 * Error personalizado para errores de autenticación
 */
export class UnauthorizedError extends Error {
  constructor(message: string = 'Sesión expirada. Por favor, inicia sesión nuevamente.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Opciones para el wrapper de fetch con interceptor
 */
export interface FetchOptions extends RequestInit {
  skipAuthCheck?: boolean; // Si true, no ejecuta logout automático en 401
}

/**
 * Wrapper de fetch con interceptor de 401
 * 
 * Detecta respuestas 401 y automáticamente:
 * 1. Cierra la sesión de Firebase
 * 2. Redirige a /login
 * 3. Lanza UnauthorizedError
 * 
 * @param url - URL del endpoint
 * @param options - Opciones de fetch (incluye skipAuthCheck)
 * @returns Response de fetch
 * @throws UnauthorizedError si el status es 401
 * 
 * @example
 * ```typescript
 * // Uso en funciones API
 * export async function getUserProfile(token: string): Promise<UserProfile> {
 *   const res = await fetchWithAuth(`${API_URL}/api/user/me`, {
 *     headers: { 'Authorization': `Bearer ${token}` }
 *   });
 *   
 *   return res.json();
 * }
 * ```
 */
export async function fetchWithAuth(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { skipAuthCheck = false, ...fetchOptions } = options;

  // Ejecutar fetch normal
  const response = await fetch(url, fetchOptions);

  // Si es 401 y no se debe saltar el check
  if (response.status === 401 && !skipAuthCheck) {
    console.warn('⚠️ 401 Unauthorized detectado - Ejecutando auto-logout');

    try {
      // 1. Cerrar sesión de Firebase
      await signOut(auth);
      console.log('✅ Sesión cerrada correctamente');
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
    }

    // 2. Redirigir a login (si estamos en el browser)
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      
      // Evitar redirección infinita si ya estamos en /login
      if (currentPath !== '/login') {
        console.log('🔄 Redirigiendo a /login...');
        window.location.href = '/login';
      }
    }

    // 3. Lanzar error personalizado
    throw new UnauthorizedError();
  }

  return response;
}

/**
 * Helper: Verifica si un error es UnauthorizedError
 * 
 * @param error - Error a verificar
 * @returns true si es UnauthorizedError
 * 
 * @example
 * ```typescript
 * try {
 *   await fetchWithAuth(url, options);
 * } catch (error) {
 *   if (isUnauthorizedError(error)) {
 *     // Ya se ejecutó logout y redirección
 *     console.log('Usuario no autorizado');
 *   } else {
 *     // Otro tipo de error
 *     throw error;
 *   }
 * }
 * ```
 */
export function isUnauthorizedError(error: unknown): error is UnauthorizedError {
  return error instanceof UnauthorizedError;
}
