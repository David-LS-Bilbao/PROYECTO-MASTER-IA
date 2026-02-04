/**
 * useProfileAuth - Step 5 Plan Mikado
 *
 * Hook para protección de ruta del perfil.
 * Redirige a /login si el usuario no está autenticado.
 *
 * Reutilizable en cualquier página protegida.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export function useProfileAuth() {
  const { user, loading, getToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  return { user, authLoading: loading, getToken };
}
