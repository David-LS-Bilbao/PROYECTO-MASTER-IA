/**
 * useProfileAuth - Step 5 Plan Mikado + Sprint 29 (Persistent Sessions)
 *
 * Hook para protección de ruta del perfil.
 * Redirige a /login si el usuario no está autenticado.
 *
 * MEJORA Sprint 29:
 * - Espera a que AuthContext termine de verificar localStorage
 * - Previene redirecciones prematuras cuando hay sesión persistente
 * - Solo redirige si loading=false (verificación completa) y user=null
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
    // CRÍTICO: Solo redirigir si la verificación de sesión ha terminado
    // loading=true significa que Firebase está verificando localStorage
    // No redirigir hasta que loading=false, para dar tiempo a restaurar sesión
    if (!loading && !user) {
      console.log('⚠️ useProfileAuth: Usuario no autenticado → redirigiendo a /login');
      router.push('/login');
    } else if (!loading && user) {
      console.log('✅ useProfileAuth: Usuario autenticado:', user.email);
    }
  }, [loading, user, router]);

  return { user, authLoading: loading, getToken };
}
