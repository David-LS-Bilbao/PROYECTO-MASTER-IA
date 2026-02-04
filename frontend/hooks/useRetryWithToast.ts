/**
 * useRetryWithToast - Step 2 Plan Mikado
 *
 * Hook para reintentar operaciones API con refresh de token en 401.
 * Muestra toast de error al usuario cuando se agotan los reintentos.
 *
 * Reutilizable en: profile, search, chat, o cualquier flujo autenticado.
 */

import { useAuth } from '@/context/AuthContext';
import { ProfileAPIError } from '@/lib/profile.api';
import { toast } from 'sonner';

const MAX_RETRIES = 2;

export function useRetryWithToast() {
  const { getToken } = useAuth();

  /**
   * Ejecuta una operación con retry automático en 401.
   *
   * @param operation - Función que recibe un token y retorna una Promise
   * @param errorMessage - Mensaje de error para el usuario
   * @returns Resultado de la operación o null si falló
   */
  const retryWithTokenRefresh = async <T,>(
    operation: (token: string) => Promise<T>,
    errorMessage: string,
  ): Promise<T | null> => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const forceRefresh = attempt > 0;
        const token = await getToken(forceRefresh);

        if (!token) {
          toast.error(errorMessage, {
            action: {
              label: 'Iniciar sesión',
              onClick: () => { window.location.href = '/login'; },
            },
          });
          return null;
        }

        return await operation(token);
      } catch (error) {
        // Si es 401 y quedan reintentos, retry con token refrescado
        if (
          error instanceof ProfileAPIError &&
          error.statusCode === 401 &&
          attempt < MAX_RETRIES - 1
        ) {
          continue;
        }

        // Error final: agotar reintentos o error no-retryable
        toast.error(errorMessage, {
          action: {
            label: 'Iniciar sesión',
            onClick: () => { window.location.href = '/login'; },
          },
        });
        return null;
      }
    }

    return null;
  };

  return { retryWithTokenRefresh };
}
